package com.pmobile.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;

import org.json.JSONException;

import java.io.File;
import java.io.IOException;

public class OtaManager {

    /** Central HTTPS endpoint for the optional startup manifest check. */
    public static final String REMOTE_MANIFEST_URL =
        "https://kozeirokodak.github.io/pmobiletest/ota/manifest.json";

    // ============================================================
    // DIRETÓRIOS DO OTA
    // ============================================================

    private static final String OTA_DIR = "pmobile-ota";
    private static final String VERSIONS_DIR = "versions";
    private static final String STAGING_DIR = "staging";


    // ============================================================
    // PERSISTÊNCIA DO ESTADO OTA
    // ============================================================

    private static final String PREFS_NAME = "PMobileOtaState";

    private static final String KEY_ACTIVE_VERSION =
        "activeVersion";

    private static final String KEY_PREVIOUS_VERSION =
        "previousVersion";

    private static final String KEY_CANDIDATE_VERSION =
        "candidateVersion";

    private static final String KEY_CANDIDATE_HEALTHY =
        "candidateHealthy";


    // ============================================================
    // DIRETÓRIOS
    // ============================================================

    private final File otaDir;
    private final File versionsDir;
    private final File stagingDir;


    // ============================================================
    // PREFERÊNCIAS
    // ============================================================

    private final SharedPreferences preferences;

    private final Context context;


    // ============================================================
    // CONSTRUTOR
    // ============================================================

    public OtaManager(Context context) {

        this.context = context.getApplicationContext();

        File filesDir =
            context.getFilesDir();

        this.otaDir =
            new File(
                filesDir,
                OTA_DIR
            );

        this.versionsDir =
            new File(
                otaDir,
                VERSIONS_DIR
            );

        this.stagingDir =
            new File(
                otaDir,
                STAGING_DIR
            );

        this.preferences =
            context.getSharedPreferences(
                PREFS_NAME,
                Context.MODE_PRIVATE
            );

    }

    /** Returns the version name declared by the installed native APK. */
    public String getCurrentNativeVersion() {
        try {
            PackageInfo packageInfo = context.getPackageManager().getPackageInfo(
                context.getPackageName(),
                0
            );
            if (packageInfo.versionName == null || packageInfo.versionName.trim().isEmpty()) {
                throw new IllegalStateException("Installed APK does not declare a version name");
            }
            return packageInfo.versionName;
        } catch (PackageManager.NameNotFoundException exception) {
            throw new IllegalStateException("Unable to read installed APK version", exception);
        }
    }

    /** Fetches and validates the configured remote manifest; invoke on a worker thread. */
    public OtaManifest fetchRemoteManifest(String manifestUrl) throws IOException, JSONException {
        return new OtaManifestFetcher(manifestUrl).fetch();
    }


    // ============================================================
    // GARANTIR ESTRUTURA DE DIRETÓRIOS
    // ============================================================

    public void ensureDirectories() {

        createDirectory(
            otaDir
        );

        createDirectory(
            versionsDir
        );

        createDirectory(
            stagingDir
        );

    }


    // ============================================================
    // CRIAR DIRETÓRIO
    // ============================================================

    private void createDirectory(
        File directory
    ) {

        if (
            directory.exists()
        ) {

            if (
                !directory.isDirectory()
            ) {

                throw new IllegalStateException(
                    "OTA path exists but is not a directory: "
                        + directory.getAbsolutePath()
                );

            }

            return;

        }

        if (
            !directory.mkdirs()
                && !directory.isDirectory()
        ) {

            throw new IllegalStateException(
                "Unable to create OTA directory: "
                    + directory.getAbsolutePath()
            );

        }

    }


    // ============================================================
    // DIRETÓRIO PRINCIPAL DO OTA
    // ============================================================

    public File getOtaDir() {

        return otaDir;

    }


    // ============================================================
    // DIRETÓRIO DAS VERSÕES
    // ============================================================

    public File getVersionsDir() {

        return versionsDir;

    }


    // ============================================================
    // DIRETÓRIO DE STAGING
    // ============================================================

    public File getStagingDir() {

        return stagingDir;

    }


    // ============================================================
    // VERSÃO OTA ATIVA
    // ============================================================
    //
    // null significa que nenhuma versão OTA está ativa.
    // Nesse caso o PMOBILE utiliza o bundle original do APK.
    //
    // ============================================================

    public String getActiveVersion() {

        return preferences.getString(
            KEY_ACTIVE_VERSION,
            null
        );

    }

    /**
     * Returns the active OTA web version. A null result means the original web
     * bundle packaged in the APK is active; its version is not tracked separately.
     * This reads the existing persisted activeVersion value without changing state.
     */
    public String getActiveWebVersion() {
        return getActiveVersion();
    }

    /** Returns the active bundle only when its persisted health state and files are valid. */
    public synchronized File getHealthyActiveBundle() throws IOException {
        String activeVersion = getActiveVersion();
        if (activeVersion == null || activeVersion.trim().isEmpty()
                || activeVersion.contains("/") || activeVersion.contains("\\")
                || activeVersion.equals(".") || activeVersion.equals("..")
                || !isCandidateHealthy()) {
            return null;
        }

        File activeBundle = new File(versionsDir, activeVersion);
        if (!isWithinDirectory(versionsDir, activeBundle) || !activeBundle.isDirectory()) {
            return null;
        }
        try {
            validateBundle(activeBundle);
        } catch (IOException invalidBundle) {
            return null;
        }
        if (!new File(activeBundle, "index.html").canRead()) {
            return null;
        }
        return activeBundle;
    }


    // ============================================================
    // VERSÃO OTA ANTERIOR
    // ============================================================
    //
    // Mantém a versão aprovada anterior para permitir rollback.
    //
    // ============================================================

    public String getPreviousVersion() {

        return preferences.getString(
            KEY_PREVIOUS_VERSION,
            null
        );

    }


    // ============================================================
    // VERSÃO OTA CANDIDATA
    // ============================================================
    //
    // Uma candidata foi instalada, mas ainda não foi considerada
    // uma versão saudável.
    //
    // ============================================================

    public String getCandidateVersion() {

        return preferences.getString(
            KEY_CANDIDATE_VERSION,
            null
        );

    }


    // ============================================================
    // ESTADO DE SAÚDE DA VERSÃO CANDIDATA
    // ============================================================

    public boolean isCandidateHealthy() {

        return preferences.getBoolean(
            KEY_CANDIDATE_HEALTHY,
            false
        );

    }

    /**
     * Revalidates a persisted pending candidate and marks it healthy only after
     * its bundle is readable and structurally valid. A failed check leaves the
     * pending state intact for a later rollback/fallback step.
     */
    public synchronized boolean healthCheckPendingCandidate() throws IOException {
        String candidateVersion = getCandidateVersion();
        if (candidateVersion == null || candidateVersion.trim().isEmpty()
                || isCandidateHealthy()) {
            return false;
        }
        if (!candidateVersion.equals(getActiveVersion())
                || candidateVersion.contains("/") || candidateVersion.contains("\\")
                || candidateVersion.equals(".") || candidateVersion.equals("..")) {
            throw new IOException("Pending OTA candidate state is invalid");
        }

        File candidateBundle = new File(versionsDir, candidateVersion);
        if (!isWithinDirectory(versionsDir, candidateBundle)
                || !candidateBundle.isDirectory()) {
            throw new IOException("Pending OTA candidate bundle is missing");
        }
        validateBundle(candidateBundle);

        File index = new File(candidateBundle, "index.html");
        if (!index.canRead()) {
            throw new IOException("OTA candidate index.html is not readable");
        }
        if (!preferences.edit().putBoolean(KEY_CANDIDATE_HEALTHY, true).commit()) {
            throw new IOException("Unable to persist healthy OTA candidate state");
        }

        // Only after the candidate is proven healthy do we remove obsolete OTA
        // bundles and staging leftovers. User data, WebView data and APK assets
        // live outside these directories and are never touched here.
        cleanupObsoleteOtaData(candidateVersion);

        return true;
    }

    /**
     * Removes only obsolete OTA bundles and temporary staging artifacts after
     * the active candidate has passed its health check. The active bundle is
     * always preserved; the previous version is removed only after the new
     * version is confirmed healthy.
     */
    private synchronized void cleanupObsoleteOtaData(String activeVersion) throws IOException {
        if (activeVersion == null || activeVersion.trim().isEmpty()
                || activeVersion.contains("/") || activeVersion.contains("\\")
                || activeVersion.equals(".") || activeVersion.equals("..")) {
            throw new IOException("Active OTA version is invalid for cleanup");
        }

        File activeBundle = new File(versionsDir, activeVersion);
        if (!isWithinDirectory(versionsDir, activeBundle) || !activeBundle.isDirectory()) {
            throw new IOException("Active OTA bundle is invalid for cleanup");
        }

        File[] versionBundles = versionsDir.listFiles(File::isDirectory);
        if (versionBundles != null) {
            for (File bundle : versionBundles) {
                if (!bundle.equals(activeBundle)) {
                    deleteRecursively(bundle, versionsDir);
                }
            }
        }

        File[] stagingEntries = stagingDir.listFiles();
        if (stagingEntries != null) {
            for (File entry : stagingEntries) {
                deleteRecursively(entry, stagingDir);
            }
        }

        if (!preferences.edit()
                .remove(KEY_PREVIOUS_VERSION)
                .remove(KEY_CANDIDATE_VERSION)
                .putString(KEY_ACTIVE_VERSION, activeVersion)
                .putBoolean(KEY_CANDIDATE_HEALTHY, true)
                .commit()) {
            throw new IOException("Unable to finalize OTA cleanup state");
        }
    }

    private static void deleteRecursively(File target, File allowedRoot) throws IOException {
        if (!isWithinDirectory(allowedRoot, target)) {
            throw new IOException("Refusing to delete OTA path outside allowed directory");
        }

        if (target.isDirectory()) {
            File[] children = target.listFiles();
            if (children == null) {
                throw new IOException("Unable to inspect OTA directory: " + target.getName());
            }
            for (File child : children) {
                deleteRecursively(child, allowedRoot);
            }
        }

        if (!target.delete() && target.exists()) {
            throw new IOException("Unable to remove OTA path: " + target.getAbsolutePath());
        }
    }

    /**
     * Activates the only staged candidate for the supplied manifest version.
     * The candidate is moved into versions/ before the active state is committed,
     * keeping the previous version directory available for a later rollback.
     */
    public synchronized File activateSoleCandidate(String version) throws IOException {
        if (version == null || version.trim().isEmpty()
                || version.contains("/") || version.contains("\\")
                || version.equals(".") || version.equals("..")) {
            throw new IOException("OTA candidate version is invalid");
        }
        ensureDirectories();

        File[] candidates = stagingDir.listFiles(file -> file.isDirectory()
            && file.getName().endsWith(".candidate"));
        if (candidates == null || candidates.length != 1) {
            throw new IOException("Expected exactly one OTA candidate bundle");
        }
        File candidate = candidates[0];
        if (!isWithinDirectory(stagingDir, candidate)) {
            throw new IOException("OTA candidate is outside staging");
        }
        validateBundle(candidate);

        File activeBundle = new File(versionsDir, version);
        if (activeBundle.exists()) {
            throw new IOException("OTA version already exists");
        }
        if (!candidate.renameTo(activeBundle)) {
            throw new IOException("Unable to move OTA candidate into versions");
        }

        String oldActiveVersion = getActiveVersion();
        SharedPreferences.Editor editor = preferences.edit()
            .putString(KEY_ACTIVE_VERSION, version)
            .putString(KEY_CANDIDATE_VERSION, version)
            .putBoolean(KEY_CANDIDATE_HEALTHY, false);
        if (oldActiveVersion != null && !oldActiveVersion.trim().isEmpty()) {
            editor.putString(KEY_PREVIOUS_VERSION, oldActiveVersion);
        }
        if (!editor.commit()) {
            if (!activeBundle.renameTo(candidate)) {
                throw new IOException("Unable to restore OTA candidate after state commit failure");
            }
            throw new IOException("Unable to persist active OTA state");
        }
        return activeBundle;
    }

    private static void validateBundle(File bundle) throws IOException {
        File[] contents = bundle.listFiles();
        File index = new File(bundle, "index.html");
        if (!bundle.isDirectory() || contents == null || contents.length == 0 || !index.isFile()
                || index.length() == 0 || !isWithinDirectory(bundle, index)) {
            throw new IOException("OTA candidate bundle has invalid structure");
        }
    }

    private static boolean isWithinDirectory(File directory, File file) throws IOException {
        String root = directory.getCanonicalPath() + File.separator;
        return file.getCanonicalPath().startsWith(root);
    }

}
