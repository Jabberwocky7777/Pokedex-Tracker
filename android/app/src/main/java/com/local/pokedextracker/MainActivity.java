package com.local.pokedextracker;

import android.os.Bundle;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.MotionEvent;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import java.util.Locale;

/**
 * The app's one activity. Besides Capacitor's web view it registers the in-repo
 * plugins and turns a game controller's buttons into something the page can use:
 * a web view treats face buttons as unknown keys.
 *
 * - D-pad: left to the web view (arrow keys and its own focus movement)
 * - A: Enter on the focused element
 * - B, X, Y, L1, R1, Start, Select: the "padbutton" window event, handled by
 *   src/lib/android-controls.ts (B is the same as Back there). Consumed here, so an
 *   unhandled B never falls back to a second Back press.
 * - Right stick: the "padscroll" window event ({ x, y } from -1 to 1)
 */
public class MainActivity extends BridgeActivity {

    private float lastScrollX = 0;
    private float lastScrollY = 0;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SaveFoldersPlugin.class);
        registerPlugin(AppWindowPlugin.class);
        super.onCreate(savedInstanceState);
    }

    private static String padButton(int keyCode) {
        switch (keyCode) {
            case KeyEvent.KEYCODE_BUTTON_B:
                return "B";
            case KeyEvent.KEYCODE_BUTTON_X:
                return "X";
            case KeyEvent.KEYCODE_BUTTON_Y:
                return "Y";
            case KeyEvent.KEYCODE_BUTTON_L1:
                return "L1";
            case KeyEvent.KEYCODE_BUTTON_R1:
                return "R1";
            case KeyEvent.KEYCODE_BUTTON_START:
                return "Start";
            case KeyEvent.KEYCODE_BUTTON_SELECT:
                return "Select";
            default:
                return null;
        }
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        int code = event.getKeyCode();
        Bridge bridge = getBridge();
        if (bridge == null) return super.dispatchKeyEvent(event);

        if (code == KeyEvent.KEYCODE_BUTTON_A) {
            // Activate the focused element: the page sees Enter
            KeyEvent enter = new KeyEvent(
                event.getDownTime(),
                event.getEventTime(),
                event.getAction(),
                KeyEvent.KEYCODE_ENTER,
                event.getRepeatCount(),
                event.getMetaState()
            );
            return super.dispatchKeyEvent(enter);
        }

        String button = padButton(code);
        if (button == null) return super.dispatchKeyEvent(event);
        if (event.getAction() == KeyEvent.ACTION_DOWN && event.getRepeatCount() == 0) {
            bridge.triggerWindowJSEvent("padbutton", "{ \"button\": \"" + button + "\" }");
        }
        return true;
    }

    @Override
    public boolean dispatchGenericMotionEvent(MotionEvent event) {
        Bridge bridge = getBridge();
        boolean joystick = (event.getSource() & InputDevice.SOURCE_JOYSTICK) == InputDevice.SOURCE_JOYSTICK;
        if (bridge == null || !joystick || event.getAction() != MotionEvent.ACTION_MOVE) {
            return super.dispatchGenericMotionEvent(event);
        }
        // The right stick is AXIS_Z / AXIS_RZ on most controllers; a small dead zone
        float x = deadZone(event.getAxisValue(MotionEvent.AXIS_Z));
        float y = deadZone(event.getAxisValue(MotionEvent.AXIS_RZ));
        if (x != lastScrollX || y != lastScrollY) {
            lastScrollX = x;
            lastScrollY = y;
            bridge.triggerWindowJSEvent(
                "padscroll",
                String.format(Locale.ROOT, "{ \"x\": %.2f, \"y\": %.2f }", x, y)
            );
        }
        return super.dispatchGenericMotionEvent(event);
    }

    private static float deadZone(float value) {
        if (Math.abs(value) < 0.2f) return 0;
        // Steps of a tenth, so a resting stick doesn't send a stream of tiny changes
        return Math.round(value * 10) / 10f;
    }
}
