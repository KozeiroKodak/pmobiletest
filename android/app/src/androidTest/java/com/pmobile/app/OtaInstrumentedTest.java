package com.pmobile.app;

import android.content.Context;
import android.content.ContextWrapper;
import android.content.SharedPreferences;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class OtaInstrumentedTest {
    private Context isolatedContext() {
        Context app = InstrumentationRegistry.getInstrumentation().getTargetContext();
        final String name = "ota-test-" + System.nanoTime();
        return new ContextWrapper(app) {
            @Override public Context getApplicationContext() { return this; }
            @Override public File getFilesDir() { File dir = new File(app.getCacheDir(), name); dir.mkdirs(); return dir; }
            @Override public SharedPreferences getSharedPreferences(String key, int mode) {
                return app.getSharedPreferences(name + "-" + key, mode);
            }
        };
    }
    private void candidate(OtaManager manager) throws Exception {
        manager.ensureDirectories();
        File dir = new File(manager.getStagingDir(), "test.candidate");
        assertTrue(dir.mkdirs());
        Files.write(new File(dir, "index.html").toPath(), "<!doctype html><title>OTA test</title>".getBytes(StandardCharsets.UTF_8));
    }
    @Test public void waitsForWebBootAndPreservesPreviousVersion() throws Exception {
        OtaManager manager = new OtaManager(isolatedContext());
        candidate(manager); manager.activateSoleCandidate("0.0.1");
        assertFalse(manager.confirmWebBoot("0.0.1"));
        assertNotNull(manager.getBundleForStartup()); assertFalse(manager.isCandidateHealthy());
        assertFalse(manager.confirmWebBoot("0.0.2"));
        assertTrue(manager.confirmWebBoot("0.0.1"));
        candidate(manager); manager.activateSoleCandidate("0.0.2");
        assertNotNull(manager.getBundleForStartup());
        assertTrue(manager.confirmWebBoot("0.0.2"));
        assertEquals("0.0.1", manager.getPreviousVersion());
        assertTrue(new File(manager.getVersionsDir(), "0.0.1/index.html").isFile());
        candidate(manager);
        try { manager.activateSoleCandidate("0.0.1"); fail("Fallback was replaced"); }
        catch (java.io.IOException expected) { }
        assertEquals("0.0.2", manager.getActiveVersion());
        assertTrue(new File(manager.getVersionsDir(), "0.0.1/index.html").isFile());
    }
    @Test public void restoresFallbackAfterUnconfirmedBoot() throws Exception {
        OtaManager manager = new OtaManager(isolatedContext());
        candidate(manager); manager.activateSoleCandidate("0.0.1");
        manager.getBundleForStartup(); manager.confirmWebBoot("0.0.1");
        candidate(manager); manager.activateSoleCandidate("0.0.2");
        assertNotNull(manager.getBundleForStartup());
        File fallback = manager.getBundleForStartup();
        assertNotNull(fallback); assertEquals("0.0.1", fallback.getName());
        assertEquals("0.0.1", manager.getActiveVersion());
        assertFalse(manager.getLastRecovery().isEmpty());
    }
    @Test public void restoresApkWhenFirstUpdateFails() throws Exception {
        OtaManager manager = new OtaManager(isolatedContext());
        candidate(manager); manager.activateSoleCandidate("0.0.1");
        assertNotNull(manager.getBundleForStartup());
        assertNull(manager.getBundleForStartup()); assertNull(manager.getActiveVersion());
        candidate(manager); manager.activateSoleCandidate("0.0.1");
        assertNotNull(manager.getBundleForStartup());
        assertTrue(manager.confirmWebBoot("0.0.1"));
    }
    @Test public void newerApkSupersedesOldOtaWithoutDeletingItsFiles() throws Exception {
        OtaManager manager = new OtaManager(isolatedContext());
        candidate(manager); manager.activateSoleCandidate("0.0.1");
        assertNull(manager.getBundleForStartup("0.0.2"));
        assertNull(manager.getActiveVersion()); assertNull(manager.getCandidateVersion());
        assertTrue(new File(manager.getVersionsDir(), "0.0.1/index.html").isFile());
    }
    @Test public void manifestKeepsLegacyFieldsAndRejectsHttp() throws Exception {
        JSONObject json = new JSONObject().put("webVersion", "0.0.400").put("nativeMinVersion", "1.0")
            .put("package", "https://example.com/ota.zip").put("sha256", new String(new char[64]).replace('\0','a'))
            .put("mandatory", false);
        OtaManifest manifest = OtaManifest.fromJson(json.toString());
        assertEquals("", manifest.getReleaseNotes()); assertEquals(0, manifest.getSizeBytes());
        json.put("package", "http://example.com/ota.zip");
        try { OtaManifest.fromJson(json.toString()); fail("HTTP accepted"); }
        catch (org.json.JSONException expected) { }
    }
    @Test public void rejectsCorruptDownloadsAndUnsafeArchivePaths() throws Exception {
        File staging = new File(isolatedContext().getFilesDir(), "staging");
        assertTrue(staging.mkdirs());
        OtaPackageDownloader downloader = new OtaPackageDownloader(staging);
        File bad = new File(staging, "bad.part");
        Files.write(bad.toPath(), "invalid".getBytes(StandardCharsets.UTF_8));
        assertFalse(downloader.verifySha256(bad, new String(new char[64]).replace('\0','a')));
        assertFalse(bad.exists());
        File unsafe = new File(staging, "unsafe.part");
        try (java.util.zip.ZipOutputStream zip = new java.util.zip.ZipOutputStream(new java.io.FileOutputStream(unsafe))) {
            zip.putNextEntry(new java.util.zip.ZipEntry("../outside.txt"));
            zip.write("test".getBytes(StandardCharsets.UTF_8)); zip.closeEntry();
        }
        byte[] digest = java.security.MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(unsafe.toPath()));
        StringBuilder hash = new StringBuilder(); for (byte b : digest) hash.append(String.format("%02x", b & 255));
        assertTrue(downloader.verifySha256(unsafe, hash.toString()));
        File verified = downloader.promoteVerifiedPackage(unsafe);
        try { downloader.prepareValidatedPackage(verified); fail("Archive traversal accepted"); }
        catch (java.io.IOException expected) { }
        assertFalse(new File(staging, "outside.txt").exists());
    }
    /** Opt-in real-network test; its package guard prevents running in the user's app. */
    @Test public void downloadsAndAppliesPublishedUpdate() throws Exception {
        org.junit.Assume.assumeTrue("true".equals(InstrumentationRegistry.getArguments().getString("otaNetworkTest")));
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertEquals("com.pmobile.preview", context.getPackageName());
        assertFalse("Unlock the phone before this test", ((android.app.KeyguardManager) context.getSystemService(Context.KEYGUARD_SERVICE)).isKeyguardLocked());
        assertTrue("Keep the phone screen on", ((android.os.PowerManager) context.getSystemService(Context.POWER_SERVICE)).isInteractive());
        android.app.Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
        android.content.Intent intent = new android.content.Intent(context, MainActivity.class).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
        MainActivity activity = (MainActivity) instrumentation.startActivitySync(intent);
        Class<?> bridgeClass = null;
        for (Class<?> inner : MainActivity.class.getDeclaredClasses()) if (inner.getSimpleName().equals("OtaJsBridge")) bridgeClass = inner;
        assertNotNull(bridgeClass);
        java.lang.reflect.Constructor<?> constructor = bridgeClass.getDeclaredConstructor(MainActivity.class);
        constructor.setAccessible(true); Object bridge = constructor.newInstance(activity);
        java.lang.reflect.Method snapshot = bridgeClass.getDeclaredMethod("obterEstado"); snapshot.setAccessible(true);
        snapshot.invoke(bridge); // Select the modern, non-modal API.
        java.lang.reflect.Method check = bridgeClass.getDeclaredMethod("procurarAtualizacoes"); check.setAccessible(true); check.invoke(bridge);
        JSONObject available = waitForState(bridge, snapshot, "available", 60000);
        String expected = available.getString("availableVersion");
        java.lang.reflect.Method download = bridgeClass.getDeclaredMethod("baixarAtualizacao"); download.setAccessible(true); download.invoke(bridge);
        waitForState(bridge, snapshot, "ready", 180000);
        OtaManager manager = new OtaManager(context);
        assertNotEquals(expected, manager.getActiveVersion()); // Download alone must not activate.
        java.lang.reflect.Method apply = bridgeClass.getDeclaredMethod("aplicarAtualizacao"); apply.setAccessible(true); apply.invoke(bridge);
        long limit = android.os.SystemClock.elapsedRealtime() + 55000;
        while (android.os.SystemClock.elapsedRealtime() < limit) {
            if (expected.equals(manager.getActiveVersion()) && manager.isCandidateHealthy() && manager.getCandidateVersion() == null) return;
            Thread.sleep(250);
        }
        fail("The updated WebView did not confirm its real boot");
    }
    private JSONObject waitForState(Object bridge, java.lang.reflect.Method snapshot, String expected, long timeout) throws Exception {
        long limit = android.os.SystemClock.elapsedRealtime() + timeout;
        JSONObject state = null;
        while (android.os.SystemClock.elapsedRealtime() < limit) {
            state = new JSONObject((String) snapshot.invoke(bridge));
            if (expected.equals(state.optString("state"))) return state;
            if ("error".equals(state.optString("state"))) fail(state.optString("message"));
            Thread.sleep(250);
        }
        fail("Expected " + expected + "; last state: " + state); return null;
    }
}
