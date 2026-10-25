package com.pmobile.app;

import android.app.AlertDialog;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.ServerPath;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "PMobileOta";
    private static final String NATIVE_WEB_BUNDLE_VERSION = "0.0.248";
    private static final ExecutorService OTA_MANIFEST_EXECUTOR =
        Executors.newSingleThreadExecutor();
    private final AtomicBoolean otaCheckRunning = new AtomicBoolean(false);
    private static final long OTA_CHECK_INTERVAL_MS = 5 * 60 * 1000L;
    private final Handler otaForegroundHandler = new Handler(Looper.getMainLooper());
    private long lastAutomaticOtaCheckMs = -OTA_CHECK_INTERVAL_MS;
    private boolean otaUpdateDialogVisible = false;
    private final Runnable otaForegroundCheck = new Runnable() {
        @Override public void run() {
            long now = SystemClock.elapsedRealtime();
            if (now - lastAutomaticOtaCheckMs >= OTA_CHECK_INTERVAL_MS && !otaUpdateDialogVisible) {
                if (!otaCheckRunning.get()) {
                    lastAutomaticOtaCheckMs = now;
                    verificarOta(false);
                }
            }
            otaForegroundHandler.postDelayed(this, OTA_CHECK_INTERVAL_MS);
        }
    };


    private AlertDialog otaProgressDialog;
    private TextView otaStatusText;
    private ProgressBar otaProgressBar;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        try {
            OtaManager otaManager = new OtaManager(getApplicationContext());
            try {
                otaManager.healthCheckPendingCandidate();
            } catch (Exception healthCheckFailure) {
                Log.w(TAG, "Pending OTA candidate health check failed: "
                    + healthCheckFailure.getClass().getSimpleName());
            }

            java.io.File activeBundle = otaManager.getHealthyActiveBundle();
            if (activeBundle != null) {
                bridgeBuilder.setServerPath(new ServerPath(
                    ServerPath.PathType.BASE_PATH,
                    activeBundle.getAbsolutePath()
                ));
                Log.i(TAG, "Loading healthy OTA bundle: " + activeBundle.getName());
            }
        } catch (Exception otaSelectionFailure) {
            Log.w(TAG, "No healthy OTA bundle selected; using APK assets: "
                + otaSelectionFailure.getClass().getSimpleName());
        }

        super.onCreate(savedInstanceState);

        getBridge().getWebView().addJavascriptInterface(
            new OtaJsBridge(),
            "PMOBILE_OTA"
        );

    }


    @Override
    public void onResume() {
        super.onResume();
        otaForegroundHandler.removeCallbacks(otaForegroundCheck);
        otaForegroundHandler.postDelayed(otaForegroundCheck, 1500L);
    }

    @Override
    public void onPause() {
        otaForegroundHandler.removeCallbacks(otaForegroundCheck);
        super.onPause();
    }

    private final class OtaJsBridge {
        @JavascriptInterface
        public void procurarAtualizacoes() {
            if (!otaCheckRunning.compareAndSet(false, true)) {
                runOnUiThread(() -> new AlertDialog.Builder(MainActivity.this)
                    .setTitle("Atualização")
                    .setMessage("Já existe uma verificação de atualização em andamento.")
                    .setPositiveButton("OK", null)
                    .show()
                );
                return;
            }

            showOtaCheckProgress();
            OTA_MANIFEST_EXECUTOR.execute(() -> {
                try {
                    verificarOtaInterno(true);
                } finally {
                    otaCheckRunning.set(false);
                }
            });
        }
    }

    private void verificarOta(boolean manual) {
        if (!otaCheckRunning.compareAndSet(false, true)) {
            return;
        }

        if (manual) {
            showOtaCheckProgress();
        }

        OTA_MANIFEST_EXECUTOR.execute(() -> {
            try {
                verificarOtaInterno(manual);
            } finally {
                otaCheckRunning.set(false);
            }
        });
    }

    private void verificarOtaInterno(boolean manual) {
        try {
            OtaManager otaManager = new OtaManager(getApplicationContext());

            try {
                if (otaManager.healthCheckPendingCandidate()) {
                    Log.i(TAG, "Pending OTA candidate passed health check and was marked healthy");
                }
            } catch (Exception healthCheckFailure) {
                Log.w(TAG, "Pending OTA candidate health check failed: "
                    + healthCheckFailure.getClass().getSimpleName());
            }

            OtaManifest manifest = otaManager.fetchRemoteManifest(
                OtaManager.REMOTE_MANIFEST_URL
            );

            String nativeVersion = otaManager.getCurrentNativeVersion();
            if (!manifest.isCompatibleWithNativeVersion(nativeVersion)) {
                Log.i(TAG, "OTA manifest incompatible with native version; nativeVersion="
                    + nativeVersion);
                if (manual) {
                    showOtaCheckResult("A atualização disponível é incompatível com esta versão do aplicativo.");
                }
                return;
            }

            String currentWebVersion = otaManager.getActiveWebVersion();
            if (currentWebVersion == null || currentWebVersion.trim().isEmpty()) {
                currentWebVersion = NATIVE_WEB_BUNDLE_VERSION;
            }

            if (manifest.isNewerThan(currentWebVersion)) {
                final String updateFromVersion = currentWebVersion;
                closeOtaCheckProgress();

                showOtaUpdateDialog(
                    updateFromVersion,
                    manifest.getWebVersion(),
                    () -> baixarEAtivarOta(otaManager, manifest)
                );
                return;
            }

            if (manual) {
                closeOtaCheckProgress();
                showOtaCheckResult(
                    "Você já está usando a versão mais recente do PMOBILE."
                        + "\n\nVersão atual: " + currentWebVersion
                );
            }

        } catch (Exception exception) {
            Log.w(TAG, "Remote OTA manifest check failed: "
                + exception.getClass().getSimpleName());

            if (manual) {
                closeOtaCheckProgress();
                showOtaCheckResult(
                    "Não foi possível verificar atualizações agora."
                        + "\n\n" + String.valueOf(exception.getMessage())
                );
            }
        }
    }

    private void baixarEAtivarOta(OtaManager otaManager, OtaManifest manifest) {
        String otaStage = "download";

        try {
            OtaPackageDownloader downloader = new OtaPackageDownloader(
                otaManager.getStagingDir()
            );
            final int[] lastPercent = {-1};

            java.io.File temporaryPackage = downloader.download(
                manifest.getPackageLocation(),
                (downloadedBytes, totalBytes) -> {
                    int percent = -1;
                    if (totalBytes > 0) {
                        percent = (int) ((downloadedBytes * 100L) / totalBytes);
                    }

                    if (percent != lastPercent[0]) {
                        lastPercent[0] = percent;
                        updateOtaProgress(
                            percent >= 0
                                ? "Baixando atualização... " + percent + "%"
                                : "Baixando atualização...",
                            percent
                        );
                    }
                }
            );

            otaStage = "verificação SHA-256";
            updateOtaProgress("Verificando integridade da atualização...", 100);

            if (!downloader.verifySha256(
                    temporaryPackage,
                    manifest.getSha256())) {
                throw new java.io.IOException("A verificação SHA-256 falhou.");
            }

            java.io.File validatedPackage =
                downloader.promoteVerifiedPackage(temporaryPackage);

            updateOtaProgress("Preparando arquivos da atualização...", 100);
            otaStage = "preparação";
            java.io.File preparedPackage =
                downloader.prepareValidatedPackage(validatedPackage);

            updateOtaProgress("Validando arquivos da atualização...", 100);
            otaStage = "validação estrutural";
            java.io.File validatedPreparedPackage =
                downloader.validatePreparedPackage(preparedPackage);

            otaStage = "promoção para candidate";
            java.io.File candidatePackage =
                downloader.promoteValidatedPreparedPackage(validatedPreparedPackage);

            Log.i(TAG, "OTA candidate staged: " + candidatePackage.getName());

            updateOtaProgress("Ativando atualização...", 100);
            otaStage = "ativação";
            java.io.File activePackage =
                otaManager.activateSoleCandidate(manifest.getWebVersion());

            Log.i(TAG, "OTA candidate persisted as active bundle: "
                + activePackage.getName());

            updateOtaProgress("Finalizando atualização...", 100);

            if (!otaManager.healthCheckPendingCandidate()) {
                throw new java.io.IOException("A atualização não passou na validação final.");
            }

            updateOtaProgress(
                "Atualização concluída! O aplicativo será reiniciado...",
                100
            );

            runOnUiThread(() -> new android.os.Handler(getMainLooper()).postDelayed(() -> {
                Intent restartIntent = new Intent(MainActivity.this, MainActivity.class);
                restartIntent.addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK
                        | Intent.FLAG_ACTIVITY_CLEAR_TASK
                );
                startActivity(restartIntent);
                finish();
            }, 1500));

        } catch (Exception downloadFailure) {
            final String failedOtaStage = otaStage;
            Log.w(TAG, "OTA package download or integrity check failed: "
                + downloadFailure.getClass().getSimpleName());

            closeOtaProgressDialog();

            runOnUiThread(() -> new AlertDialog.Builder(this)
                .setTitle("Atualização não concluída")
                .setMessage(
                    "Não foi possível concluir a atualização. "
                    + "A versão atual será mantida."
                    + "\n\nEtapa: " + failedOtaStage
                    + "\nErro: " + downloadFailure.getMessage()
                )
                .setPositiveButton("OK", null)
                .show()
            );
        }
    }

    private void showOtaCheckProgress() {
        runOnUiThread(() -> {
            if (otaProgressDialog != null && otaProgressDialog.isShowing()) {
                return;
            }

            LinearLayout layout = new LinearLayout(this);
            layout.setOrientation(LinearLayout.VERTICAL);
            layout.setPadding(48, 24, 48, 8);

            otaStatusText = new TextView(this);
            otaStatusText.setText("Procurando atualizações...");

            otaProgressBar = new ProgressBar(this);
            otaProgressBar.setIndeterminate(true);

            layout.addView(otaStatusText);
            layout.addView(otaProgressBar);

            otaProgressDialog = new AlertDialog.Builder(this)
                .setTitle("Atualizações")
                .setView(layout)
                .setCancelable(false)
                .show();
        });
    }

    private void showOtaCheckResult(String message) {
        runOnUiThread(() -> new AlertDialog.Builder(this)
            .setTitle("Atualizações")
            .setMessage(message)
            .setPositiveButton("OK", null)
            .show()
        );
    }

    private void showOtaProgressDialog(String newWebVersion) {
        runOnUiThread(() -> {
            LinearLayout layout = new LinearLayout(this);
            layout.setOrientation(LinearLayout.VERTICAL);
            layout.setPadding(48, 24, 48, 8);

            otaStatusText = new TextView(this);
            otaStatusText.setText("Preparando atualização...");

            otaProgressBar = new ProgressBar(
                this,
                null,
                android.R.attr.progressBarStyleHorizontal
            );
            otaProgressBar.setMax(100);
            otaProgressBar.setIndeterminate(true);

            layout.addView(otaStatusText);
            layout.addView(otaProgressBar);

            otaProgressDialog = new AlertDialog.Builder(this)
                .setTitle("Atualizando PMOBILE")
                .setView(layout)
                .setCancelable(false)
                .show();
        });
    }

    private void updateOtaProgress(String status, int percent) {
        runOnUiThread(() -> {
            if (otaStatusText != null) {
                otaStatusText.setText(status);
            }
            if (otaProgressBar != null) {
                if (percent >= 0) {
                    otaProgressBar.setIndeterminate(false);
                    otaProgressBar.setProgress(percent);
                } else {
                    otaProgressBar.setIndeterminate(true);
                }
            }
        });
    }

    private void closeOtaProgressDialog() {
        runOnUiThread(() -> {
            if (otaProgressDialog != null && otaProgressDialog.isShowing()) {
                otaProgressDialog.dismiss();
            }
            otaProgressDialog = null;
            otaStatusText = null;
            otaProgressBar = null;
        });
    }

    private void closeOtaCheckProgress() {
        closeOtaProgressDialog();
    }

    private void showOtaUpdateDialog(
            String currentWebVersion,
            String newWebVersion,
            Runnable onConfirm) {
        runOnUiThread(() -> {
            if (otaUpdateDialogVisible || isFinishing() || isDestroyed()) return;
            otaUpdateDialogVisible = true;
            new AlertDialog.Builder(this)
                .setTitle("Atualização disponível")
                .setMessage(
                    "Sua versão: " + currentWebVersion
                    + "\nNova versão: " + newWebVersion
                    + "\n\nDeseja atualizar agora?"
                )
                .setNegativeButton("Não", (dialog, which) -> otaUpdateDialogVisible = false)
                .setPositiveButton("Sim", (dialog, which) -> {
                    otaUpdateDialogVisible = false;
                    showOtaProgressDialog(newWebVersion);
                    OTA_MANIFEST_EXECUTOR.execute(onConfirm);
                })
                .setCancelable(false)
                .show();
        });
    }
}
