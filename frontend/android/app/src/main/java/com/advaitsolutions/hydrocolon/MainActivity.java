package com.advaitsolutions.hydrocolon;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(EspServerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
