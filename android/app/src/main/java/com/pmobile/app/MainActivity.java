package com.pmobile.app;

import android.app.AlertDialog;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;
import android.webkit.WebView;
import com.getcapacitor.ServerPath;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "PMobileOta";
    /** Baseline used when the APK's bundled web assets are active. */
    private static final String NATIVE_WEB_BUNDLE_VERSION = "0.0.0";
    private static final ExecutorService OTA_MANIFEST_EXECUTOR =
        Executors.newSingleThreadExecutor();

    private AlertDialog otaProgressDialog;
    private TextView otaStatusText;
    private ProgressBar otaProgressBar;
    private volatile boolean webHealthReceived = false;
    private volatile boolean activeOtaBundleSelected = false;
    private final Handler webHealthHandler = new Handler(Looper.getMainLooper());

    private void handleWebHealthFailure() {
        Log.w(TAG, "PMOBILE web health check failed");

        if (!activeOtaBundleSelected) {
            Log.w(TAG, "APK assets are active; no OTA recovery required");
            return;
        }

        Toast.makeText(this, "Falha na atualização. Restaurando versão de segurança...", Toast.LENGTH_LONG).show();

        try {
            OtaManager otaManager = new OtaManager(getApplicationContext());
            String failedVersion = otaManager.getActiveVersion();
            String previousVersion = otaManager.getPreviousVersion();

            otaManager.markRecoveryPending();

            if (previousVersion != null && !previousVersion.trim().isEmpty()) {
                java.io.File rollbackBundle = otaManager.rollbackToPreviousVersion();
                Log.w(TAG, "OTA rollback activated: " + rollbackBundle.getName());
            } else {
                otaManager.fallbackToApkAssets();
                Log.w(TAG, "No previous OTA version available; falling back to APK assets");
            }

            try {
                otaManager.deleteFailedVersion(failedVersion);
                Log.w(TAG, "Failed OTA version removed: " + failedVersion);
            } catch (Exception cleanupFailure) {
                Log.e(TAG, "Unable to remove failed OTA version", cleanupFailure);
            }

            Intent restartIntent = new Intent(MainActivity.this, MainActivity.class);
            restartIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
            webHealthHandler.postDelayed(() -> {
                startActivity(restartIntent);
                finish();
            }, 3500);
        } catch (Exception recoveryFailure) {
            Log.e(TAG, "OTA web health recovery failed", recoveryFailure);
        }
    }

    private void checkWebHealth(WebView webView, long deadline) {
        webView.evaluateJavascript("window.PMOBILE_OK === true", value -> {
            if ("true".equals(value)) {
                webHealthReceived = true;
                Log.i(TAG, "PMOBILE health signal received");

                try {
                    OtaManager otaManager = new OtaManager(getApplicationContext());
                    if (otaManager.consumeRecoveryPending()) {
                        Toast.makeText(
                            MainActivity.this,
                            "Versão de segurança restaurada com sucesso.",
                            Toast.LENGTH_LONG
                        ).show();
                    }
                } catch (Exception recoveryStateFailure) {
                    Log.e(TAG, "Unable to consume OTA recovery state", recoveryStateFailure);
                }

                return;
            }

            if (System.currentTimeMillis() < deadline) {
                webHealthHandler.postDelayed(() -> checkWebHealth(webView, deadline), 500);
            } else {
                handleWebHealthFailure();
            }
        });
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        try {
            OtaManager otaManager = new OtaManager(getApplicationContext());
            try {
                otaManager.healthCheckPendingCandidate();
            } catch (Exception healthCheckFailure) {
                Log.w(TAG, "Pending OTA candidate health check failed: "
                    + healthCheckFailure.getClass().getSimpleName());
                try {
                    java.io.File rollbackBundle =
                        otaManager.rollbackToPreviousVersion();
                    Log.w(TAG, "OTA rollback activated: "
                        + rollbackBundle.getName());
                } catch (Exception rollbackFailure) {
                    Log.w(TAG, "OTA rollback failed; using APK assets: "
                        + rollbackFailure.getClass().getSimpleName());
                }
            }

            java.io.File activeBundle = otaManager.getHealthyActiveBundle();
            if (activeBundle != null) {
                activeOtaBundleSelected = true;
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

        bridge.addWebViewListener(new WebViewListener() {
            @Override
            public void onPageLoaded(WebView webView) {
                Log.i(TAG, "WebView page loaded"); checkWebHealth(webView, System.currentTimeMillis() + 10000);
            }

            @Override
            public void onReceivedError(WebView webView) {
                Log.w(TAG, "WebView load error");
            }
        });

        OTA_MANIFEST_EXECUTOR.execute(() -> {
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
                    return;
                }

                String currentWebVersion = otaManager.getActiveWebVersion();
                if (currentWebVersion == null || currentWebVersion.trim().isEmpty()) {
                    currentWebVersion = NATIVE_WEB_BUNDLE_VERSION;
                }

                if (manifest.isNewerThan(currentWebVersion)) {
                    Log.i(TAG, "OTA update available; currentWebVersion=" + currentWebVersion
                        + ", manifestWebVersion=" + manifest.getWebVersion());

                    final String updateFromVersion = currentWebVersion;

                    showOtaUpdateDialog(
                        updateFromVersion,
                        manifest.getWebVersion(),
                        () -> {
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

                                updateOtaProgress(
                                    "Verificando integridade da atualização...",
                                    100
                                );

                                if (downloader.verifySha256(
                                        temporaryPackage,
                                        manifest.getSha256())) {

                                    java.io.File validatedPackage =
                                        downloader.promoteVerifiedPackage(
                                            temporaryPackage
                                        );

                                    Log.i(TAG,
                                        "OTA package passed SHA-256 and was staged as validated: "
                                        + validatedPackage.getName());

                                    updateOtaProgress(
                                        "Preparando arquivos da atualização...",
                                        100
                                    );

                                    otaStage = "preparação";

                                    java.io.File preparedPackage =
                                        downloader.prepareValidatedPackage(validatedPackage);

                                    updateOtaProgress(
                                        "Validando arquivos da atualização...",
                                        100
                                    );

                                    otaStage = "validação estrutural";
                                    java.io.File validatedPreparedPackage =


                                    downloader.validatePreparedPackage(preparedPackage);

                                    Log.i(TAG,
                                        "Prepared OTA bundle passed structural validation: "
                                        + validatedPreparedPackage.getName());

                                    otaStage = "promoção para candidate";
                                    java.io.File candidatePackage =


                                    downloader.promoteValidatedPreparedPackage(validatedPreparedPackage);

                                    Log.i(TAG,
                                        "Prepared OTA bundle copied to candidate staging: "
                                        + candidatePackage.getName());

                                    updateOtaProgress(
                                        "Ativando atualização...",
                                        100
                                    );

                                    otaStage = "ativação";
                                    java.io.File activePackage =


                                    otaManager.activateSoleCandidate(
                                            manifest.getWebVersion(),
                                        candidatePackage
                                        );

                                    Log.i(TAG,
                                        "OTA candidate persisted as active bundle: "
                                        + activePackage.getName());

                                    try {
                                        updateOtaProgress(
                                            "Finalizando atualização...",
                                            100
                                        );

                                        if (otaManager.healthCheckPendingCandidate()) {
                                            Log.i(TAG,
                                                "Activated OTA candidate passed health check");

                                            updateOtaProgress(
                                                "Atualização concluída! O aplicativo será reiniciado...",
                                                100
                                            );

                                            runOnUiThread(() -> {
                                                new android.os.Handler(getMainLooper()).postDelayed(() -> {
                                                    Intent restartIntent = new Intent(
    MainActivity.this,
    MainActivity.class
);
restartIntent.addFlags(
    Intent.FLAG_ACTIVITY_NEW_TASK
        | Intent.FLAG_ACTIVITY_CLEAR_TASK
);
startActivity(restartIntent);
finish();
                                                }, 1500);
                                            });
                                        } else {
                                            closeOtaProgressDialog();
                                        }
                                    } catch (Exception healthCheckFailure) {
                                        Log.w(TAG,
                                            "Activated OTA candidate health check failed: "
                                            + healthCheckFailure.getClass().getSimpleName());
                                        closeOtaProgressDialog();
                                    }

                                } else {
                                    Log.w(TAG,
                                        "OTA temporary package rejected by SHA-256 integrity check");
                                }

                            } catch (Exception downloadFailure) {
                                final String failedOtaStage = otaStage;
                                Log.w(TAG,
                                    "OTA package download or integrity check failed: "
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
                    );

                } else {
                    Log.i(TAG, "No OTA update needed; currentWebVersion=" + currentWebVersion
                        + ", manifestWebVersion=" + manifest.getWebVersion());
                }
            } catch (Exception exception) {
                // The optional check must never affect startup or expose response contents.
                Log.w(TAG, "Remote OTA manifest check failed: "
                    + exception.getClass().getSimpleName());
            }
        });
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

    private void showOtaUpdateDialog(
            String currentWebVersion,
            String newWebVersion,
            Runnable onConfirm) {
        runOnUiThread(() -> {
            new AlertDialog.Builder(this)
                .setTitle("Atualização disponível")
                .setMessage(
                    "Sua versão: " + currentWebVersion
                    + "\nNova versão: " + newWebVersion
                    + "\n\nDeseja atualizar agora?"
                )
                .setNegativeButton("Não", null)
                .setPositiveButton("Sim", (dialog, which) -> {
                    showOtaProgressDialog(newWebVersion);
                    OTA_MANIFEST_EXECUTOR.execute(onConfirm);
                })
                .setCancelable(false)
                .show();
        });
    }

}
