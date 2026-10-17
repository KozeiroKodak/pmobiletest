package com.pmobile.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        OtaManager otaManager = new OtaManager(getApplicationContext());
        otaManager.ensureDirectories();
    }
}
