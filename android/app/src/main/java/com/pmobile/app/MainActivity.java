package com.pmobile.app;

import android.app.AlertDialog;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.util.Base64;
import java.io.File;
import java.io.FileInputStream;
import java.io.RandomAccessFile;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
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
    private static final String NATIVE_WEB_BUNDLE_VERSION = "0.0.262";
    private static final ExecutorService OTA_MANIFEST_EXECUTOR =
        Executors.newSingleThreadExecutor();
    private static final ExecutorService ONEDRIVE_EXECUTOR =
        Executors.newCachedThreadPool();
    private static final long MAX_ONEDRIVE_FILE_BYTES = 100L * 1024L * 1024L;
    private static final int ONEDRIVE_CHUNK_BYTES = 128 * 1024;
    private final Map<String, OneDriveDownloadState> oneDriveDownloads =
        new ConcurrentHashMap<>();
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
        getBridge().getWebView().addJavascriptInterface(
            new OneDriveJsBridge(),
            "PMCOLETAS_ONEDRIVE"
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

    private static final class OneDriveDownloadState {
        final String id;
        final File file;
        volatile long totalBytes = -1L;
        volatile long downloadedBytes = 0L;
        volatile String status = "downloading";
        volatile String error = null;

        OneDriveDownloadState(String id, File file) {
            this.id = id;
            this.file = file;
        }
    }

    private final class OneDriveJsBridge {
        @JavascriptInterface
        public String iniciarDownload(String urlInformada) {
            try {
                URL url = validarUrlOneDrive(urlInformada);
                String id = UUID.randomUUID().toString();
                File dir = new File(getCacheDir(), "pmcoletas-onedrive");
                if (!dir.exists() && !dir.mkdirs()) {
                    throw new java.io.IOException("Não foi possível criar a área temporária do OneDrive.");
                }

                File destino = new File(dir, id + ".bin");
                OneDriveDownloadState state = new OneDriveDownloadState(id, destino);
                oneDriveDownloads.put(id, state);

                ONEDRIVE_EXECUTOR.execute(() -> executarDownloadOneDrive(url, state));
                return jsonDownloadState(state);
            } catch (Exception exception) {
                return "{\"ok\":false,\"error\":\"" + escaparJson(exception.getMessage()) + "\"}";
            }
        }

        @JavascriptInterface
        public String obterStatus(String id) {
            OneDriveDownloadState state = oneDriveDownloads.get(id);
            if (state == null) {
                return "{\"ok\":false,\"error\":\"Download não encontrado.\"}";
            }
            return jsonDownloadState(state);
        }

        @JavascriptInterface
        public String obterChunk(String id, long offset) {
            OneDriveDownloadState state = oneDriveDownloads.get(id);
            if (state == null) {
                return "{\"ok\":false,\"error\":\"Download não encontrado.\"}";
            }
            if (!"completed".equals(state.status)) {
                return "{\"ok\":false,\"error\":\"Download ainda não terminou.\"}";
            }

            try (RandomAccessFile input = new RandomAccessFile(state.file, "r")) {
                if (offset < 0L || offset > input.length()) {
                    throw new java.io.IOException("Offset inválido.");
                }

                input.seek(offset);
                int quantidade = (int) Math.min(ONEDRIVE_CHUNK_BYTES, input.length() - offset);
                byte[] buffer = new byte[quantidade];
                int lidos = input.read(buffer);

                if (lidos <= 0) {
                    oneDriveDownloads.remove(id);
                    if (state.file.exists()) state.file.delete();
                    return "{\"ok\":true,\"offset\":" + offset + ",\"nextOffset\":" + offset + ",\"done\":true,\"base64\":\"\"}";
                }

                String base64 = Base64.encodeToString(buffer, 0, lidos, Base64.NO_WRAP);
                long nextOffset = offset + lidos;
                boolean done = nextOffset >= input.length();

                if (done) {
                    oneDriveDownloads.remove(id);
                    if (state.file.exists()) state.file.delete();
                }

                return "{\"ok\":true,\"offset\":" + offset
                    + ",\"nextOffset\":" + nextOffset
                    + ",\"done\":" + done
                    + ",\"base64\":\"" + base64 + "\"}";
            } catch (Exception exception) {
                if (state.file.exists()) state.file.delete();
                oneDriveDownloads.remove(id);
                return "{\"ok\":false,\"error\":\"" + escaparJson(exception.getMessage()) + "\"}";
            }
        }

        @JavascriptInterface
        public String cancelarDownload(String id) {
            OneDriveDownloadState state = oneDriveDownloads.remove(id);
            if (state != null && state.file.exists()) {
                state.file.delete();
            }
            return "{\"ok\":true}";
        }
    }

    private void executarDownloadOneDrive(URL url, OneDriveDownloadState state) {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) url.openConnection();
            connection.setConnectTimeout(20000);
            connection.setReadTimeout(60000);
            connection.setInstanceFollowRedirects(true);
            connection.setRequestMethod("GET");
            connection.setRequestProperty("Accept",
                "application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/octet-stream,*/*");
            connection.setRequestProperty("Cache-Control", "no-cache");

            int status = connection.getResponseCode();
            if (status < 200 || status >= 300) {
                throw new java.io.IOException("OneDrive respondeu HTTP " + status + ".");
            }

            URL finalUrl = connection.getURL();
            validarHostOneDrive(finalUrl.getHost());

            long contentLength = connection.getContentLengthLong();
            if (contentLength > MAX_ONEDRIVE_FILE_BYTES) {
                throw new java.io.IOException("A planilha excede o limite de 50 MB.");
            }
            state.totalBytes = contentLength;

            try (
                java.io.InputStream input = connection.getInputStream();
                java.io.OutputStream output = new java.io.BufferedOutputStream(
                    new java.io.FileOutputStream(state.file)
                )
            ) {
                byte[] buffer = new byte[64 * 1024];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    state.downloadedBytes += count;
                    if (state.downloadedBytes > MAX_ONEDRIVE_FILE_BYTES) {
                        throw new java.io.IOException("A planilha excede o limite de 50 MB.");
                    }
                    output.write(buffer, 0, count);
                }
            }

            if (state.downloadedBytes <= 0L || !state.file.exists()) {
                throw new java.io.IOException("O OneDrive não retornou nenhum arquivo.");
            }

            state.status = "completed";
        } catch (Exception exception) {
            state.status = "error";
            state.error = exception.getMessage() != null
                ? exception.getMessage()
                : exception.getClass().getSimpleName();
            if (state.file.exists()) state.file.delete();
            Log.w(TAG, "Download nativo OneDrive falhou: " + state.error);
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private static URL validarUrlOneDrive(String urlInformada) throws java.io.IOException {
        if (urlInformada == null || urlInformada.trim().isEmpty()) {
            throw new java.io.IOException("Link do OneDrive não informado.");
        }
        URL url = new URL(urlInformada.trim());
        if (!"https".equalsIgnoreCase(url.getProtocol())) {
            throw new java.io.IOException("O link do OneDrive precisa usar HTTPS.");
        }
        validarHostOneDrive(url.getHost());
        return url;
    }

    private static void validarHostOneDrive(String hostInformado) throws java.io.IOException {
        String host = hostInformado == null ? "" : hostInformado.toLowerCase(java.util.Locale.US);
        boolean permitido =
            "1drv.ms".equals(host) ||
            "onedrive.live.com".equals(host) ||
            host.endsWith(".onedrive.live.com") ||
            host.endsWith(".sharepoint.com") ||
            host.endsWith(".1drv.com");

        if (!permitido) {
            throw new java.io.IOException("Redirecionamento para domínio não autorizado.");
        }
    }

    private static String jsonDownloadState(OneDriveDownloadState state) {
        String error = state.error == null ? "" : escaparJson(state.error);
        return "{\"ok\":true"
            + ",\"id\":\"" + state.id + "\""
            + ",\"status\":\"" + state.status + "\""
            + ",\"downloadedBytes\":" + state.downloadedBytes
            + ",\"totalBytes\":" + state.totalBytes
            + ",\"error\":\"" + error + "\"}";
    }

    private static String escaparJson(String valor) {
        if (valor == null) return "";
        return valor.replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\r", " ")
            .replace("\n", " ");
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
