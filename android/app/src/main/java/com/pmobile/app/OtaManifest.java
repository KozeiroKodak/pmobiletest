package com.pmobile.app;

import org.json.JSONException;
import org.json.JSONObject;

/** Validated metadata describing one remotely published OTA web bundle. */
public final class OtaManifest {

    private final String webVersion;
    private final String nativeMinVersion;
    private final String packageLocation;
    private final String sha256;
    private final boolean mandatory;

    private OtaManifest(
        String webVersion,
        String nativeMinVersion,
        String packageLocation,
        String sha256,
        boolean mandatory
    ) {
        this.webVersion = webVersion;
        this.nativeMinVersion = nativeMinVersion;
        this.packageLocation = packageLocation;
        this.sha256 = sha256;
        this.mandatory = mandatory;
    }

    /** Parses and validates the required manifest fields from a JSON object. */
    public static OtaManifest fromJson(String json) throws JSONException {
        JSONObject object = new JSONObject(json);
        String webVersion = requiredString(object, "webVersion");
        String nativeMinVersion = requiredString(object, "nativeMinVersion");
        String packageLocation = requiredString(object, "package");
        String sha256 = requiredString(object, "sha256");
        if (!object.has("mandatory") || object.isNull("mandatory")
            || !(object.opt("mandatory") instanceof Boolean)) {
            throw new JSONException("Field 'mandatory' must be a boolean");
        }

        try {
            OtaVersion.parse(webVersion);
            OtaVersion.parse(nativeMinVersion);
        } catch (IllegalArgumentException exception) {
            throw new JSONException(exception.getMessage());
        }
        if (!sha256.matches("(?i)[0-9a-f]{64}")) {
            throw new JSONException("Field 'sha256' must contain 64 hexadecimal characters");
        }

        return new OtaManifest(
            webVersion,
            nativeMinVersion,
            packageLocation,
            sha256,
            object.getBoolean("mandatory")
        );
    }

    private static String requiredString(JSONObject object, String key) throws JSONException {
        Object value = object.opt(key);
        if (!(value instanceof String) || ((String) value).trim().isEmpty()) {
            throw new JSONException("Field '" + key + "' must be a non-empty string");
        }
        return (String) value;
    }

    public String getWebVersion() { return webVersion; }
    public String getNativeMinVersion() { return nativeMinVersion; }
    public String getPackageLocation() { return packageLocation; }
    public String getSha256() { return sha256; }
    public boolean isMandatory() { return mandatory; }

    public boolean isNewerThan(String currentWebVersion) {
        return OtaVersion.parse(webVersion).compareTo(OtaVersion.parse(currentWebVersion)) > 0;
    }

    /** Returns whether the installed native APK meets this manifest's minimum version. */
    public boolean isCompatibleWithNativeVersion(String currentNativeVersion) {
        return OtaVersion.parse(currentNativeVersion)
            .compareTo(OtaVersion.parse(nativeMinVersion)) >= 0;
    }
}
