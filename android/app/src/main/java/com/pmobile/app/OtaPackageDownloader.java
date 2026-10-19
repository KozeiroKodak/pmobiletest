package com.pmobile.app;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
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

    /**
     * Verifies a downloaded temporary package against the manifest SHA-256.
     * The file remains a .part file when valid and is removed on any failure.
     */
    public boolean verifySha256(File temporaryFile, String expectedSha256) {
        boolean verified = false;
        try {
            if (temporaryFile == null || !temporaryFile.isFile()
                    || !isSha256Hex(expectedSha256)) {
                return false;
            }

            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            try (InputStream input = new java.io.FileInputStream(temporaryFile)) {
                byte[] buffer = new byte[BUFFER_SIZE];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    digest.update(buffer, 0, count);
                }
            }

            byte[] expected = decodeSha256(expectedSha256);
            verified = MessageDigest.isEqual(digest.digest(), expected);
            return verified;
        } catch (Exception failure) {
            return false;
        } finally {
            if (!verified && temporaryFile != null) {
                try {
                    if (temporaryFile.exists()) {
                        temporaryFile.delete();
                    }
                } catch (SecurityException ignored) {
                    // Best effort cleanup; a cleanup failure must not affect app startup.
                }
            }
        }
    }

    private static boolean isSha256Hex(String value) {
        if (value == null || value.length() != 64) {
            return false;
        }
        for (int i = 0; i < value.length(); i++) {
            char character = value.charAt(i);
            if (!((character >= '0' && character <= '9')
                    || (character >= 'a' && character <= 'f')
                    || (character >= 'A' && character <= 'F'))) {
                return false;
            }
        }
        return true;
    }

    private static byte[] decodeSha256(String value) {
        byte[] decoded = new byte[32];
        for (int i = 0; i < decoded.length; i++) {
            int high = Character.digit(value.charAt(i * 2), 16);
            int low = Character.digit(value.charAt(i * 2 + 1), 16);
            decoded[i] = (byte) ((high << 4) | low);
        }
        return decoded;
    }
}
