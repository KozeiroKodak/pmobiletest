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

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.ServerPath;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "PMobileOta";
    private static final String NATIVE_WEB_BUNDLE_VERSION = BuildConfig.WEB_BUNDLE_VERSION;
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
    private final Runnable otaForegroundCheck = new Runnable() {
        @Override public void run() {
            long now = SystemClock.elapsedRealtime();
            if (now - lastAutomaticOtaCheckMs >= OTA_CHECK_INTERVAL_MS) {
                if (!otaCheckRunning.get()) {
                    lastAutomaticOtaCheckMs = now;
                    verificarOta(false);
                }
            }
            otaForegroundHandler.postDelayed(this, OTA_CHECK_INTERVAL_MS);
        }
    };



    @Override
    protected void onCreate(Bundle savedInstanceState) {
        try {
            OtaManager otaManager = new OtaManager(getApplicationContext());
            java.io.File activeBundle = otaManager.getBundleForStartup(NATIVE_WEB_BUNDLE_VERSION);
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
        final String startupCandidate = new OtaManager(getApplicationContext()).getCandidateVersion();
        new Handler(getMainLooper()).postDelayed(() -> {
            if (isFinishing() || isDestroyed() || startupCandidate == null) return;
            OtaManager manager = new OtaManager(getApplicationContext());
            if (startupCandidate.equals(manager.getCandidateVersion()) && !manager.isCandidateHealthy()) {
                try { manager.restorePreviousVersion(); recreate(); }
                catch (Exception failure) { Log.e(TAG, "Unable to restore OTA fallback", failure); }
            }
        }, 60000L);

    }

    @Override
    protected void load() {
        // Register before Capacitor starts loading the page, including OTA boots.
        android.webkit.WebView webView = findViewById(com.getcapacitor.android.R.id.webview);
        webView.addJavascriptInterface(new OtaJsBridge(), "PMOBILE_OTA");
        webView.addJavascriptInterface(new OneDriveJsBridge(), "PMCOLETAS_ONEDRIVE");
        super.load();
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


    private volatile boolean otaModernClient;
    private volatile OtaManifest availableManifest;
    private volatile String otaState = "idle";
    private String otaMessage = "Tudo pronto para verificar atualizações.";
    private int otaPercent = -1;
    private long otaDownloaded, otaTotal, otaCheckedAt;

    private android.content.SharedPreferences otaUiPreferences() {
        return getSharedPreferences("PMobileOtaUi", MODE_PRIVATE);
    }

    private String currentWebVersion() {
        String active = new OtaManager(getApplicationContext()).getActiveWebVersion();
        return active == null ? NATIVE_WEB_BUNDLE_VERSION : active;
    }

    private synchronized void setOtaState(String state, String message, int percent) {
        otaState = state; otaMessage = message; otaPercent = percent;
    }

    private synchronized String otaSnapshot() {
        try {
            OtaManager manager = new OtaManager(getApplicationContext());
            String ready = otaUiPreferences().getString("readyVersion", "");
            if ("idle".equals(otaState) && !ready.isEmpty() && manager.hasPreparedCandidate()) {
                setOtaState("ready", "Atualização pronta. Aplique quando terminar suas operações.", 100);
            }
            org.json.JSONObject json = new org.json.JSONObject();
            json.put("state", otaState).put("message", otaMessage).put("percent", otaPercent)
                .put("currentVersion", currentWebVersion()).put("nativeVersion", manager.getCurrentNativeVersion())
                .put("availableVersion", "ready".equals(otaState) ? ready : availableManifest == null ? "" : availableManifest.getWebVersion())
                .put("downloadedBytes", otaDownloaded).put("totalBytes", otaTotal)
                .put("checkedAt", otaCheckedAt > 0 ? otaCheckedAt : otaUiPreferences().getLong("checkedAt", 0)).put("recovery", manager.getLastRecovery())
                .put("releaseNotes", availableManifest == null ? "" : availableManifest.getReleaseNotes())
                .put("publishedAt", availableManifest == null ? "" : availableManifest.getPublishedAt());
            return json.toString();
        } catch (Exception failure) { return "{\"state\":\"error\",\"message\":\"Não foi possível ler o estado da atualização.\"}"; }
    }

    private final class OtaJsBridge {
        @JavascriptInterface public String obterEstado() { otaModernClient = true; return otaSnapshot(); }
        @JavascriptInterface public void procurarAtualizacoes() { verificarOta(true); }
        @JavascriptInterface public void baixarAtualizacao() { iniciarDownload(); }
        @JavascriptInterface public void aplicarAtualizacao() { aplicarPreparada(); }
        @JavascriptInterface public void confirmarInicializacao(String version) {
            OTA_MANIFEST_EXECUTOR.execute(() -> {
                try { new OtaManager(getApplicationContext()).confirmWebBoot(version); }
                catch (Exception failure) { Log.w(TAG, "OTA boot confirmation failed", failure); }
            });
        }
    }

    private void verificarOta(boolean manual) {
        if (!otaUiPreferences().getString("readyVersion", "").isEmpty()
                && new OtaManager(getApplicationContext()).hasPreparedCandidate()) {
            setOtaState("ready", "Atualização pronta. Aplique quando terminar suas operações.", 100);
        }
        if ("ready".equals(otaState) || !otaCheckRunning.compareAndSet(false, true)) return;
        setOtaState("checking", "Procurando a versão mais recente…", -1);
        OTA_MANIFEST_EXECUTOR.execute(() -> {
            try {
                OtaManager manager = new OtaManager(getApplicationContext());
                OtaManifest manifest = manager.fetchRemoteManifest(OtaManager.REMOTE_MANIFEST_URL);
                otaCheckedAt = System.currentTimeMillis();
                otaUiPreferences().edit().putLong("checkedAt", otaCheckedAt).apply();
                if (!manifest.isCompatibleWithNativeVersion(manager.getCurrentNativeVersion())) {
                    setOtaState("incompatible", "Esta atualização precisa de um APK mais recente.", -1);
                    return;
                }
                if (manifest.isNewerThan(currentWebVersion())) {
                    availableManifest = manifest;
                    otaTotal = manifest.getSizeBytes();
                    setOtaState("available", "Uma nova versão está disponível para o seu PMobile.", -1);
                    if (!otaModernClient && manual) legacyDialog("Atualização disponível", "Versão " + manifest.getWebVersion(), "Baixar", this::iniciarDownload);
                } else {
                    availableManifest = null;
                    setOtaState("updated", "Seu PMobile está atualizado.", 100);
                    if (!otaModernClient && manual) legacyDialog("PMobile atualizado", "Versão " + currentWebVersion(), "OK", null);
                }
            } catch (Exception failure) {
                setOtaState("error", "Não foi possível verificar agora. Confira a conexão e tente novamente.", -1);
                if (!otaModernClient && manual) legacyDialog("Atualizações", otaMessage, "OK", null);
                Log.w(TAG, "OTA check failed", failure);
            } finally { otaCheckRunning.set(false); }
        });
    }

    private void iniciarDownload() {
        final OtaManifest manifest = availableManifest;
        if (manifest == null || "ready".equals(otaState) || !otaCheckRunning.compareAndSet(false, true)) return;
        setOtaState("downloading", "Baixando em segundo plano. Você pode continuar usando o aplicativo.", 0);
        otaDownloaded = 0;
        OTA_MANIFEST_EXECUTOR.execute(() -> {
            try {
                OtaManager manager = new OtaManager(getApplicationContext());
                manager.clearStaging();
                otaUiPreferences().edit().remove("readyVersion").apply();
                OtaPackageDownloader downloader = new OtaPackageDownloader(manager.getStagingDir());
                File downloaded = downloader.download(manifest.getPackageLocation(), (bytes, total) -> {
                    synchronized (MainActivity.this) {
                        otaDownloaded = bytes; otaTotal = total > 0 ? total : manifest.getSizeBytes();
                        otaPercent = otaTotal > 0 ? (int) Math.min(100, bytes * 100 / otaTotal) : -1;
                    }
                });
                setOtaState("verifying", "Conferindo a integridade dos arquivos…", -1);
                if (!downloader.verifySha256(downloaded, manifest.getSha256())) throw new java.io.IOException("SHA-256 mismatch");
                File verified = downloader.promoteVerifiedPackage(downloaded);
                setOtaState("preparing", "Preparando a atualização com segurança…", -1);
                File prepared = downloader.prepareValidatedPackage(verified);
                File validated = downloader.validatePreparedPackage(prepared);
                downloader.promoteValidatedPreparedPackage(validated);
                if (!otaUiPreferences().edit().putString("readyVersion", manifest.getWebVersion()).commit()) {
                    throw new java.io.IOException("Unable to persist ready version");
                }
                setOtaState("ready", "Tudo pronto. Salve seu trabalho e aplique quando preferir.", 100);
                if (!otaModernClient) legacyDialog("Atualização pronta", otaMessage, "Reiniciar e aplicar", this::aplicarPreparada);
            } catch (Exception failure) {
                setOtaState("error", "O download não foi concluído. A versão atual continua disponível. Tente novamente.", -1);
                if (!otaModernClient) legacyDialog("Atualização não concluída", otaMessage, "OK", null);
                Log.w(TAG, "OTA preparation failed", failure);
            } finally { otaCheckRunning.set(false); }
        });
    }

    private void aplicarPreparada() {
        if (!"ready".equals(otaState) || !otaCheckRunning.compareAndSet(false, true)) return;
        setOtaState("applying", "Aplicando atualização e reiniciando…", -1);
        OTA_MANIFEST_EXECUTOR.execute(() -> {
            try {
                String version = otaUiPreferences().getString("readyVersion", "");
                new OtaManager(getApplicationContext()).activateSoleCandidate(version);
                otaUiPreferences().edit().remove("readyVersion").apply();
                runOnUiThread(() -> {
                    Intent intent = new Intent(MainActivity.this, MainActivity.class);
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                    startActivity(intent); finish();
                });
            } catch (Exception failure) {
                setOtaState("error", "Não foi possível aplicar a atualização. A versão anterior está preservada.", -1);
                Log.w(TAG, "OTA activation failed", failure);
            } finally { otaCheckRunning.set(false); }
        });
    }

    private void legacyDialog(String title, String message, String action, Runnable callback) {
        runOnUiThread(() -> {
            if (isFinishing() || isDestroyed()) return;
            new AlertDialog.Builder(this).setTitle(title).setMessage(message)
                .setNegativeButton("Fechar", null)
                .setPositiveButton(action, (dialog, which) -> { if (callback != null) callback.run(); }).show();
        });
    }
}
