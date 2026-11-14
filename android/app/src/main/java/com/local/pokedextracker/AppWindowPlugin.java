package com.local.pokedextracker;

import android.app.Activity;
import android.view.WindowManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Window settings for a dual-screen handheld (src/lib/android-window.ts):
 *
 * - keepControllerOnGame: on a device such as the AYN Thor, touching this app on one
 *   screen can take the controller away from the game on the other. With it on, the
 *   window is made non-focusable: touch still works, the controller and the on-screen
 *   keyboard stay with the other app.
 * - initialScale: the web view's zoom, for the "Display size" setting when the page's
 *   own viewport scale isn't honoured.
 */
@CapacitorPlugin(name = "AppWindow")
public class AppWindowPlugin extends Plugin {

    @PluginMethod
    public void setKeepControllerOnGame(PluginCall call) {
        boolean keep = Boolean.TRUE.equals(call.getBoolean("keep", false));
        Activity activity = getActivity();
        activity.runOnUiThread(() -> {
            if (keep) activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE);
            else activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE);
            call.resolve();
        });
    }

    @PluginMethod
    public void setInitialScale(PluginCall call) {
        // A percentage; 0 is the web view's default
        int percent = call.getInt("percent", 0);
        getActivity().runOnUiThread(() -> {
            getBridge().getWebView().setInitialScale(percent);
            call.resolve();
        });
    }

    @PluginMethod
    public void displayInfo(PluginCall call) {
        // For docs/android.md's measurements and the first-run screen step: which display, how dense
        Activity activity = getActivity();
        android.util.DisplayMetrics metrics = activity.getResources().getDisplayMetrics();
        JSObject ret = new JSObject();
        android.view.Display display = android.os.Build.VERSION.SDK_INT >= 30
            ? activity.getDisplay()
            : activity.getWindowManager().getDefaultDisplay();
        ret.put("displayId", display != null ? display.getDisplayId() : -1);
        ret.put("widthPx", metrics.widthPixels);
        ret.put("heightPx", metrics.heightPixels);
        ret.put("density", metrics.density);
        android.hardware.display.DisplayManager manager =
            (android.hardware.display.DisplayManager) activity.getSystemService(android.content.Context.DISPLAY_SERVICE);
        ret.put("displayCount", manager != null ? manager.getDisplays().length : 1);
        call.resolve(ret);
    }
}
