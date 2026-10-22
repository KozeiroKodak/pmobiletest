package com.pmobile.app;

import org.json.JSONException;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.Charset;
import javax.net.ssl.HttpsURLConnection;

/** Retrieves and parses an OTA manifest. Call from a worker thread. */
public final class OtaManifestFetcher {

    /** Maximum accepted manifest size (256 KiB). */
    public static final int MAX_MANIFEST_BYTES = 256 * 1024;
    private static final int CONNECT_TIMEOUT_MS = 15000;
    private static final int READ_TIMEOUT_MS = 15000;
    private static final Charset UTF_8 = Charset.forName("UTF-8");

    private final URL manifestUrl;

    /** The endpoint is supplied by the app configuration and must use HTTPS. */
    public OtaManifestFetcher(String manifestUrl) throws IOException {
        if (manifestUrl == null) {
            throw new IllegalArgumentException("Manifest URL is required");
        }
        URL parsed = new URL(manifestUrl);
        if (!(parsed.openConnection() instanceof HttpsURLConnection)) {
            throw new IllegalArgumentException("OTA manifest URL must use HTTPS");
        }
        this.manifestUrl = parsed;
    }

    /** Fetches a successful HTTPS response and delegates structural validation to OtaManifest. */
    public OtaManifest fetch() throws IOException, JSONException {
        HttpsURLConnection connection = null;
        try {
            connection = (HttpsURLConnection) manifestUrl.openConnection();
            connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
            connection.setReadTimeout(READ_TIMEOUT_MS);
            connection.setInstanceFollowRedirects(false);
            connection.setRequestMethod("GET");
            connection.setRequestProperty("Accept", "application/json");

            int status = connection.getResponseCode();
            if (status < HttpURLConnection.HTTP_OK || status >= HttpURLConnection.HTTP_MULT_CHOICE) {
                throw new IOException("OTA manifest request failed with HTTP status " + status);
            }
            long contentLength = connection.getContentLengthLong();
            if (contentLength > MAX_MANIFEST_BYTES) {
                throw new IOException("OTA manifest response exceeds size limit");
            }

            String json;
            try (InputStream input = connection.getInputStream()) {
                json = readBounded(input);
            }
            return OtaManifest.fromJson(json);
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
    }

    private static String readBounded(InputStream input) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[4096];
        int total = 0;
        int count;
        while ((count = input.read(buffer)) != -1) {
            if (total > MAX_MANIFEST_BYTES - count) {
                throw new IOException("OTA manifest response exceeds size limit");
            }
            output.write(buffer, 0, count);
            total += count;
        }
        return new String(output.toByteArray(), UTF_8);
    }
}
