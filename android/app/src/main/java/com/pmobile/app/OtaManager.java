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
        "https://updates.pmobile.app/manifest.json";

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

}
