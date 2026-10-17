package com.pmobile.app;

import android.content.Context;

import java.io.File;

public class OtaManager {

    private static final String OTA_DIR = "pmobile-ota";
    private static final String VERSIONS_DIR = "versions";
    private static final String STAGING_DIR = "staging";

    private final File otaDir;
    private final File versionsDir;
    private final File stagingDir;

    public OtaManager(Context context) {
        File filesDir = context.getFilesDir();

        this.otaDir = new File(filesDir, OTA_DIR);
        this.versionsDir = new File(otaDir, VERSIONS_DIR);
        this.stagingDir = new File(otaDir, STAGING_DIR);
    }

    public void ensureDirectories() {
        createDirectory(otaDir);
        createDirectory(versionsDir);
        createDirectory(stagingDir);
    }

    private void createDirectory(File directory) {
        if (directory.exists()) {
            if (!directory.isDirectory()) {
                throw new IllegalStateException(
                    "OTA path exists but is not a directory: " + directory.getAbsolutePath()
                );
            }
            return;
        }

        if (!directory.mkdirs() && !directory.isDirectory()) {
            throw new IllegalStateException(
                "Unable to create OTA directory: " + directory.getAbsolutePath()
            );
        }
    }

    public File getOtaDir() {
        return otaDir;
    }

    public File getVersionsDir() {
        return versionsDir;
    }

    public File getStagingDir() {
        return stagingDir;
    }
}
