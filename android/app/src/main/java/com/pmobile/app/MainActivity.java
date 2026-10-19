package com.pmobile.app;

import android.os.Bundle;
import android.util.Log;

import com.getcapacitor.BridgeActivity;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "PMobileOta";
    /** Baseline used when the APK's bundled web assets are active. */
    private static final String NATIVE_WEB_BUNDLE_VERSION = "0.0.0";
    private static final ExecutorService OTA_MANIFEST_EXECUTOR =
        Executors.newSingleThreadExecutor();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        OTA_MANIFEST_EXECUTOR.execute(() -> {
            try {
                OtaManager otaManager = new OtaManager(getApplicationContext());
                OtaManifest manifest = otaManager.fetchRemoteManifest(
                    OtaManager.REMOTE_MANIFEST_URL
                );

                String nativeVersion = otaManager.getCurrentNativeVersion();
                if (!manifest.isCompatibleWithNativeVersion(nativeVersion)) {
                    Log.i(TAG, "OTA manifest incompatible with native version; nativeVersion="
                        + nativeVersion);
                    return;
                }

                String currentWebVersion = otaManager.getActiveWebVersion();
                if (currentWebVersion == null || currentWebVersion.trim().isEmpty()) {
                    currentWebVersion = NATIVE_WEB_BUNDLE_VERSION;
                }

                if (manifest.isNewerThan(currentWebVersion)) {
                    Log.i(TAG, "OTA update available; currentWebVersion=" + currentWebVersion
                        + ", manifestWebVersion=" + manifest.getWebVersion());
                    try {
                        OtaPackageDownloader downloader = new OtaPackageDownloader(
                            otaManager.getStagingDir()
                        );
                        java.io.File temporaryPackage = downloader.download(
                            manifest.getPackageLocation()
                        );
                        if (downloader.verifySha256(temporaryPackage, manifest.getSha256())) {
                            java.io.File validatedPackage = downloader.promoteVerifiedPackage(
                                temporaryPackage
                            );
                            Log.i(TAG, "OTA package passed SHA-256 and was staged as validated: "
                                + validatedPackage.getName());
                            java.io.File preparedPackage = downloader.prepareValidatedPackage();
                            Log.i(TAG, "Validated OTA package prepared for controlled installation: "
                                + preparedPackage.getName());
                        } else {
                            Log.w(TAG, "OTA temporary package rejected by SHA-256 integrity check");
                        }
                    } catch (Exception downloadFailure) {
                        Log.w(TAG, "OTA package download or integrity check failed: "
                            + downloadFailure.getClass().getSimpleName());
                    }
                } else {
                    Log.i(TAG, "No OTA update needed; currentWebVersion=" + currentWebVersion
                        + ", manifestWebVersion=" + manifest.getWebVersion());
                }
            } catch (Exception exception) {
                // The optional check must never affect startup or expose response contents.
                Log.w(TAG, "Remote OTA manifest check failed: "
                    + exception.getClass().getSimpleName());
            }
        });
    }
}
