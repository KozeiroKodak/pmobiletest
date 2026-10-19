package com.pmobile.app;

import android.os.Bundle;
import android.util.Log;

import com.getcapacitor.BridgeActivity;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "PMobileOta";
    private static final ExecutorService OTA_MANIFEST_EXECUTOR =
        Executors.newSingleThreadExecutor();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        OtaManager otaManager = new OtaManager(getApplicationContext());
        otaManager.ensureDirectories();

        OTA_MANIFEST_EXECUTOR.execute(() -> {
            try {
                OtaManifest manifest = otaManager.fetchRemoteManifest(
                    OtaManager.REMOTE_MANIFEST_URL
                );
                Log.i(TAG, "Remote OTA manifest validated; webVersion="
                    + manifest.getWebVersion());
            } catch (Exception exception) {
                // The optional check must never affect startup or expose response contents.
                Log.w(TAG, "Remote OTA manifest check failed: "
                    + exception.getClass().getSimpleName());
            }
        });
    }
}
