package dev.kaffeallain.mboafit.beta;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GoogleAccountPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
