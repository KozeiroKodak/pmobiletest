package com.pmobile.app;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashSet;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.Map;
import javax.net.ssl.HttpsURLConnection;

/** Downloads an OTA package to an untrusted temporary file in staging. */
public final class OtaPackageDownloader {

    /** Maximum package download size (100 MiB). */
    public static final long MAX_PACKAGE_BYTES = 100L * 1024L * 1024L;
    private static final int CONNECT_TIMEOUT_MS = 15000;
    private static final int READ_TIMEOUT_MS = 30000;
    private static final int BUFFER_SIZE = 8192;
    private static final int MAX_ARCHIVE_ENTRIES = 10000;

    private final File stagingDir;
    private final Map<String, byte[]> verifiedPackages = new HashMap<>();

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

            String canonicalPath = temporaryFile.getCanonicalPath();
            byte[] expected = decodeSha256(expectedSha256);
            byte[] actual = digest.digest();
            if (MessageDigest.isEqual(actual, expected)) {
                verifiedPackages.put(canonicalPath, actual);
                verified = true;
            }
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

    /**
     * Promotes a package previously verified by this downloader to a validated
     * staging artifact. The move stays within staging, so rename is atomic when
     * supported by the filesystem. This does not install or activate the package.
     */
    public File promoteVerifiedPackage(File temporaryFile) throws IOException {
        if (temporaryFile == null || !temporaryFile.isFile()) {
            throw new IOException("Verified OTA package is unavailable");
        }

        String canonicalPath = temporaryFile.getCanonicalPath();
        byte[] verifiedDigest = verifiedPackages.get(canonicalPath);
        if (verifiedDigest == null || !isWithinStaging(temporaryFile)) {
            throw new IOException("OTA package has not passed SHA-256 verification");
        }

        // Ensure the file has not changed since the successful verification.
        byte[] currentDigest = calculateSha256(temporaryFile);
        if (!MessageDigest.isEqual(verifiedDigest, currentDigest)) {
            verifiedPackages.remove(canonicalPath);
            throw new IOException("Verified OTA package changed before promotion");
        }

        if (!temporaryFile.getName().endsWith(".part")) {
            throw new IOException("OTA package is not in temporary state");
        }
        File validatedFile = new File(
            stagingDir,
            temporaryFile.getName().substring(0, temporaryFile.getName().length() - 5)
                + ".validated"
        );
        if (validatedFile.exists()) {
            throw new IOException("Validated OTA package already exists");
        }
        if (!temporaryFile.renameTo(validatedFile)) {
            throw new IOException("Unable to promote OTA package");
        }

        verifiedPackages.remove(canonicalPath);
        return validatedFile;
    }

    /**
     * Extracts the sole validated OTA archive into a separate prepared directory.
     * The validated archive is retained and no active WebView files are touched.
     */
    public File prepareValidatedPackage() throws IOException {
        File validatedPackage = findSoleValidatedPackage();
        String name = validatedPackage.getName();
        File preparedDir = new File(stagingDir,
            name.substring(0, name.length() - ".validated".length()) + ".prepared");
        if (preparedDir.exists()) {
            throw new IOException("Prepared OTA package already exists");
        }

        File temporaryDir = new File(stagingDir, name + ".extracting");
        if (temporaryDir.exists() || !temporaryDir.mkdir()) {
            throw new IOException("Unable to create temporary OTA extraction directory");
        }
        boolean complete = false;
        try {
            extractArchive(validatedPackage, temporaryDir);
            if (!temporaryDir.renameTo(preparedDir)) {
                throw new IOException("Unable to finalize prepared OTA package");
            }
            complete = true;
            return preparedDir;
        } finally {
            if (!complete) {
                deleteTree(temporaryDir);
            }
        }
    }

    private File findSoleValidatedPackage() throws IOException {
        File[] candidates = stagingDir.listFiles(file -> file.isFile()
            && file.getName().endsWith(".validated"));
        if (candidates == null || candidates.length != 1) {
            throw new IOException("Expected exactly one validated OTA package");
        }
        File candidate = candidates[0];
        if (!isWithinStaging(candidate) || candidate.length() > MAX_PACKAGE_BYTES) {
            throw new IOException("Validated OTA package is outside staging or too large");
        }
        return candidate;
    }

    private static void extractArchive(File archive, File destination) throws IOException {
        Set<String> paths = new HashSet<>();
        int entries = 0;
        long extractedBytes = 0;
        byte[] buffer = new byte[BUFFER_SIZE];
        try (ZipInputStream input = new ZipInputStream(new FileInputStream(archive))) {
            ZipEntry entry;
            while ((entry = input.getNextEntry()) != null) {
                if (++entries > MAX_ARCHIVE_ENTRIES) {
                    throw new IOException("OTA archive contains too many entries");
                }
                String entryName = entry.getName();
                File output = resolveArchiveEntry(destination, entryName);
                if (!paths.add(entryName) || !isWithinDirectory(destination, output)) {
                    throw new IOException("OTA archive contains an unsafe or duplicate path");
                }
                if (entry.isDirectory()) {
                    if (!output.isDirectory() && !output.mkdirs()) {
                        throw new IOException("Unable to create OTA directory");
                    }
                } else {
                    File parent = output.getParentFile();
                    if (parent == null || (!parent.isDirectory() && !parent.mkdirs())) {
                        throw new IOException("Unable to create OTA extraction path");
                    }
                    try (FileOutputStream fileOutput = new FileOutputStream(output, false)) {
                        int count;
                        while ((count = input.read(buffer)) != -1) {
                            if (extractedBytes > MAX_PACKAGE_BYTES - count) {
                                throw new IOException("Extracted OTA package exceeds size limit");
                            }
                            fileOutput.write(buffer, 0, count);
                            extractedBytes += count;
                        }
                    }
                }
                input.closeEntry();
            }
        }
        if (entries == 0) {
            throw new IOException("Validated OTA archive is empty or invalid");
        }
    }

    private static File resolveArchiveEntry(File destination, String entryName) throws IOException {
        if (entryName == null || entryName.isEmpty() || entryName.indexOf('\\') >= 0
                || entryName.startsWith("/") || entryName.matches("^[A-Za-z]:.*")) {
            throw new IOException("OTA archive contains an invalid path");
        }
        String[] segments = entryName.split("/", -1);
        for (String segment : segments) {
            if (segment.equals("..") || segment.isEmpty() && !entryName.endsWith("/")) {
                throw new IOException("OTA archive contains an invalid path");
            }
        }
        return new File(destination, entryName);
    }

    private static boolean isWithinDirectory(File directory, File file) throws IOException {
        String root = directory.getCanonicalPath() + File.separator;
        return file.getCanonicalPath().startsWith(root);
    }

    private static void deleteTree(File file) {
        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children != null) {
                for (File child : children) {
                    deleteTree(child);
                }
            }
        }
        if (file.exists()) {
            file.delete();
        }
    }

    private boolean isWithinStaging(File file) throws IOException {
        String stagingPath = stagingDir.getCanonicalPath() + File.separator;
        return file.getCanonicalPath().startsWith(stagingPath);
    }

    private static byte[] calculateSha256(File file) throws IOException {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            try (InputStream input = new java.io.FileInputStream(file)) {
                byte[] buffer = new byte[BUFFER_SIZE];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    digest.update(buffer, 0, count);
                }
            }
            return digest.digest();
        } catch (java.security.NoSuchAlgorithmException impossible) {
            throw new IOException("SHA-256 is unavailable", impossible);
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
