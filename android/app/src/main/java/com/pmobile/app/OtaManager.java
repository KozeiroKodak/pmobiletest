package com.pmobile.app;

import android.content.Context;
import android.content.SharedPreferences;

import java.io.File;

public class OtaManager {

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


    // ============================================================
    // CONSTRUTOR
    // ============================================================

    public OtaManager(Context context) {

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
