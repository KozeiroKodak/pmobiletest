package com.pmobile.app;

import android.app.Activity;
import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import org.json.JSONObject;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** APK updates use a separate OTA feed. The system package installer always asks the user. */
public final class NativeOtaUpdater {
    private static final String MANIFEST_URL =
        "https://kozeirokodak.github.io/pmobiletest/ota/native-manifest.json";
    private static final String PACKAGE_NAME = "com.pmobile.app";
    private static final String EXPECTED_CERT = 
        "d73f1b234895f85b8e96321b95000cb18947b7c335e1b949b148e77a095c4a98";
    private static final long MAX_APK = 150L * 1024 * 1024;
    private final Context context;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private volatile String state = "idle";
    private volatile String message = "";
    private volatile int percent = -1;
    private volatile JSONObject release;
    private volatile File verifiedApk;
    private volatile boolean busy;

    public NativeOtaUpdater(Context context) { this.context = context.getApplicationContext(); }
    public synchronized JSONObject snapshot() {
        JSONObject out = new JSONObject();
        try {
            out.put("state", state).put("message", message).put("percent", percent)
                .put("currentVersionCode", installedVersionCode());
            if (release != null) {
                out.put("availableVersionCode", release.optLong("versionCode"))
                   .put("availableVersion", release.optString("versionName"))
                   .put("releaseNotes", release.optString("releaseNotes", ""));
            }
        } catch (Exception ignored) {}
        return out;
    }
    public void checkAsync() {
        synchronized (this) {
            if (busy || "downloading".equals(state) || "ready".equals(state)) return;
            busy = true; state = "checking"; message = "Verificando versão Android…";
        }
        executor.execute(() -> {
            try {
                JSONObject root = new JSONObject(readManifest());
                if (root.optInt("schemaVersion") != 1 || !PACKAGE_NAME.equals(root.optString("packageName"))) {
                    throw new IllegalArgumentException("Manifesto Android incompatível.");
                }
                JSONObject next = root.optJSONObject("release");
                if (next == null || next.optLong("versionCode") <= installedVersionCode()) {
                    release = null; verifiedApk = null; state = "updated";
                    message = "Aplicativo Android atualizado."; percent = 100;
                    return;
                }
                validateRelease(next);
                release = next; verifiedApk = null; state = "available";
                message = "Nova versão Android disponível: " + next.getString("versionName");
                percent = 0;
            } catch (Exception e) {
                state = "error";
                message = "Falha ao verificar atualização Android. Tente novamente.";
                android.util.Log.w("PMobileNativeOta", "Check failed", e);
            } finally {
                synchronized (this) { busy = false; }
            }
        });
    }
    public void downloadAsync() {
        synchronized (this) {
            if (busy || release == null || !"available".equals(state)) return;
            busy = true; state = "downloading"; percent = 0;
            message = "Baixando atualização Android…";
        }
        executor.execute(() -> {
            File temp = null;
            try {
                JSONObject target = release;
                validateRelease(target);
                File dir = new File(context.getCacheDir(), "native-ota");
                if (!dir.isDirectory() && !dir.mkdirs()) throw new java.io.IOException("Cache unavailable");
                temp = new File(dir, "pmobile-" + target.getLong("versionCode") + ".part");
                File apk = new File(dir, "pmobile-" + target.getLong("versionCode") + ".apk");
                if (apk.exists() && !apk.delete()) throw new java.io.IOException("Stale APK cannot be removed");
                URL url = new URL(target.getString("url"));
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                try {
                    conn.setConnectTimeout(15000); conn.setReadTimeout(30000);
                    conn.setInstanceFollowRedirects(true);
                    int response = conn.getResponseCode();
                    if (response < 200 || response >= 300 || !"https".equalsIgnoreCase(conn.getURL().getProtocol())) {
                        throw new java.io.IOException("Invalid APK response");
                    }
                    long expected = target.getLong("sizeBytes");
                    if (conn.getContentLengthLong() > MAX_APK) throw new java.io.IOException("APK too large");
                    MessageDigest sha = MessageDigest.getInstance("SHA-256");
                    long total = 0;
                    try (InputStream in = conn.getInputStream(); FileOutputStream out = new FileOutputStream(temp)) {
                        byte[] chunk = new byte[32768]; int n;
                        while ((n = in.read(chunk)) != -1) {
                            total += n;
                            if (total > MAX_APK) throw new java.io.IOException("APK too large");
                            out.write(chunk, 0, n); sha.update(chunk, 0, n);
                            percent = (int)Math.min(99, total * 100 / expected);
                        }
                        out.getFD().sync();
                    }
                    if (total != expected || !hex(sha.digest()).equals(target.getString("sha256").toLowerCase())) {
                        throw new SecurityException("APK size/checksum mismatch");
                    }
                } finally { conn.disconnect(); }
                if (!temp.renameTo(apk)) throw new java.io.IOException("APK promotion failed");
                verifyApk(apk, target);
                verifiedApk = apk;
                state = "ready"; message = "APK conferido. Confirme a instalação no Android."; percent = 100;
            } catch (Exception e) {
                if (temp != null) temp.delete();
                verifiedApk = null; state = "error";
                message = "Falha no download ou verificação do APK. Nada foi instalado.";
                android.util.Log.e("PMobileNativeOta", "Download failed", e);
            } finally {
                synchronized (this) { busy = false; }
            }
        });
    }
    private String readManifest() throws Exception {
        URL source = new URL(MANIFEST_URL + "?t=" + System.currentTimeMillis());
        HttpURLConnection connection = (HttpURLConnection) source.openConnection();
        try {
            connection.setConnectTimeout(15000); connection.setReadTimeout(15000);
            connection.setRequestProperty("Cache-Control", "no-cache");
            int response = connection.getResponseCode();
            if (response != 200 || !"https".equalsIgnoreCase(connection.getURL().getProtocol())) {
                throw new java.io.IOException("Invalid manifest response");
            }
            try (InputStream in = connection.getInputStream()) {
                java.io.ByteArrayOutputStream output = new java.io.ByteArrayOutputStream();
                byte[] block = new byte[4096]; int n; int total = 0;
                while ((n = in.read(block)) != -1) {
                    total += n; if (total > 65536) throw new java.io.IOException("Manifest too large");
                    output.write(block, 0, n);
                }
                return new String(output.toByteArray(), StandardCharsets.UTF_8);
            }
        } finally { connection.disconnect(); }
    }
    private void validateRelease(JSONObject next) throws Exception {
        long code = next.getLong("versionCode");
        String name = next.getString("versionName");
        String url = next.getString("url");
        String sha = next.getString("sha256");
        String signer = next.getString("signingCertSha256");
        long size = next.getLong("sizeBytes");
        if (code <= installedVersionCode() || name.isEmpty() || size <= 0 || size > MAX_APK ||
            !sha.matches("(?i)[0-9a-f]{64}") || !EXPECTED_CERT.equalsIgnoreCase(signer) ||
            !url.startsWith("https://github.com/KozeiroKodak/pmobiletest/releases/download/pmobile-native-") ||
            !url.endsWith(".apk")) throw new SecurityException("Invalid native release metadata");
    }
    private long installedVersionCode() throws Exception {
        PackageInfo installed = context.getPackageManager().getPackageInfo(PACKAGE_NAME, 0);
        return Build.VERSION.SDK_INT >= 28 ? installed.getLongVersionCode() : installed.versionCode;
    }
    private void verifyApk(File apk, JSONObject target) throws Exception {
        PackageManager pm = context.getPackageManager();
        PackageInfo archive = pm.getPackageArchiveInfo(apk.getAbsolutePath(), PackageManager.GET_SIGNATURES);
        PackageInfo installed = pm.getPackageInfo(PACKAGE_NAME, PackageManager.GET_SIGNATURES);
        if (archive == null || !PACKAGE_NAME.equals(archive.packageName) || archive.signatures == null ||
            installed.signatures == null || archive.signatures.length != 1 || installed.signatures.length != 1) {
            throw new SecurityException("Unexpected package identity");
        }
        long code = Build.VERSION.SDK_INT >= 28 ? archive.getLongVersionCode() : archive.versionCode;
        if (code != target.getLong("versionCode") || code <= installedVersionCode()) {
            throw new SecurityException("VersionCode mismatch or downgrade");
        }
        String actual = fingerprint(archive.signatures[0]);
        String current = fingerprint(installed.signatures[0]);
        if (!EXPECTED_CERT.equalsIgnoreCase(actual) || !actual.equalsIgnoreCase(current)) {
            throw new SecurityException("Installed and downloaded APK certificates differ");
        }
    }
    private static String fingerprint(Signature signature) throws Exception {
        return hex(MessageDigest.getInstance("SHA-256").digest(signature.toByteArray()));
    }
    private static String hex(byte[] data) {
        StringBuilder out = new StringBuilder(data.length * 2);
        for (byte b : data) out.append(String.format(java.util.Locale.ROOT, "%02x", b & 0xff));
        return out.toString();
    }
    /** Invoke on UI thread only. The operating system owns the final install confirmation. */
    public void install(Activity activity) {
        if (!"ready".equals(state) || verifiedApk == null || !verifiedApk.isFile()) return;
        try {
            verifyApk(verifiedApk, release);
            if (Build.VERSION.SDK_INT >= 26 && !activity.getPackageManager().canRequestPackageInstalls()) {
                message = "Autorize instalação desta fonte no Android e toque novamente em Instalar.";
                Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + activity.getPackageName()));
                activity.startActivity(settings);
                return;
            }
            Uri uri = FileProvider.getUriForFile(activity, activity.getPackageName() + ".fileprovider", verifiedApk);
            Intent intent = new Intent(Intent.ACTION_INSTALL_PACKAGE);
            intent.setData(uri);
            intent.setClipData(ClipData.newRawUri("PMobile", uri));
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.putExtra(Intent.EXTRA_RETURN_RESULT, false);
            activity.startActivity(intent);
            message = "Confirme a atualização no instalador Android.";
        } catch (Exception e) {
            state = "error"; message = "Não foi possível abrir o instalador Android.";
            android.util.Log.e("PMobileNativeOta", "Installer failed", e);
        }
    }
}
