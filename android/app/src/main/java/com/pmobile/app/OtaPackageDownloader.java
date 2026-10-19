package com.pmobile.app;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import javax.net.ssl.HttpsURLConnection;

/** Downloads an OTA package to an untrusted temporary file in staging. */
public final class OtaPackageDownloader {

    /** Maximum package download size (100 MiB). */
    public static final long MAX_PACKAGE_BYTES = 100L * 1024L * 1024L;
    private static final int CONNECT_TIMEOUT_MS = 15000;
    private static final int READ_TIMEOUT_MS = 30000;
    private static final int BUFFER_SIZE = 8192;

    private final File stagingDir;

    public OtaPackageDownloader(File stagingDir) {
        if (stagingDir == null) {
            throw new IllegalArgumentException("OTA staging directory is required");
        }
        this.stagingDir = stagingDir;
    }

    /** Downloads a successful HTTPS response into a uniquely named .part file. */
    public File download(String packageLocation) throws IOException {
        if (packageLocation == null || packageLocation.trim().isEmpty()) {
            throw new IOException("OTA package URL is missing");
        }

        URL packageUrl = new URL(packageLocation);
        if (!(packageUrl.openConnection() instanceof HttpsURLConnection)) {
            throw new IOException("OTA package URL must use HTTPS");
        }

        if (!stagingDir.isDirectory() && !stagingDir.mkdirs() && !stagingDir.isDirectory()) {
            throw new IOException("Unable to prepare OTA staging directory");
        }

        File temporaryFile = File.createTempFile("ota-", ".part", stagingDir);
        HttpsURLConnection connection = null;
        boolean complete = false;
        try {
            connection = (HttpsURLConnection) packageUrl.openConnection();
            connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
            connection.setReadTimeout(READ_TIMEOUT_MS);
            connection.setInstanceFollowRedirects(false);
            connection.setRequestMethod("GET");
            connection.setRequestProperty("Accept", "application/octet-stream");

            int status = connection.getResponseCode();
            if (status < HttpURLConnection.HTTP_OK || status >= HttpURLConnection.HTTP_MULT_CHOICE) {
                throw new IOException("OTA package request failed with HTTP status " + status);
            }
            long contentLength = connection.getContentLengthLong();
            if (contentLength > MAX_PACKAGE_BYTES) {
                throw new IOException("OTA package exceeds size limit");
            }

            try (InputStream input = connection.getInputStream();
                 FileOutputStream output = new FileOutputStream(temporaryFile, false)) {
                byte[] buffer = new byte[BUFFER_SIZE];
                long total = 0;
                int count;
                while ((count = input.read(buffer)) != -1) {
                    if (total > MAX_PACKAGE_BYTES - count) {
                        throw new IOException("OTA package exceeds size limit");
                    }
                    output.write(buffer, 0, count);
                    total += count;
                }
                output.flush();
            }
            complete = true;
            return temporaryFile;
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
            if (!complete && temporaryFile.exists() && !temporaryFile.delete()) {
                // Best effort cleanup; do not replace the original failure.
            }
        }
    }
}
