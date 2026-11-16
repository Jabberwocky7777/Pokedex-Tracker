package com.local.pokedextracker;

import android.app.Activity;
import android.content.Context;
import android.graphics.Point;
import android.hardware.display.DisplayManager;
import android.os.Build;
import android.util.DisplayMetrics;
import android.view.Display;
import android.view.Window;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.HashSet;
import java.util.Set;

/**
 * Window settings for a dual-screen handheld (src/lib/android-window.ts):
 *
 * - fullScreen: the page gets the whole screen. Edge to edge (drawn under where the
 *   bars and any camera cut-out are) with both system bars hidden; a swipe from the
 *   edge shows them for a moment. Android brings the bars back after the keyboard
 *   or a system dialog, so MainActivity applies it again whenever the window gets
 *   focus back.
 * - keepControllerOnGame: on a device such as the AYN Thor, touching this app on one
 *   screen can take the controller away from the game on the other. With it on, the
 *   window is made non-focusable: touch still works, the controller and the on-screen
 *   keyboard stay with the other app.
 * - initialScale: the web view's zoom, for the "Display size" setting when the page's
 *   own viewport scale isn't honoured.
 * - displayInfo: the screens Android reports and which one the app is on, for the
 *   Screens readout in Settings.
 */
@CapacitorPlugin(name = "AppWindow")
public class AppWindowPlugin extends Plugin {

    /** Whether the page has the whole screen (the "Show the status and navigation bars" setting, inverted) */
    static volatile boolean fullScreen = true;

    /** Applies fullScreen to the activity's window; call on the UI thread */
    static void applyFullScreen(Activity activity) {
        Window window = activity.getWindow();
        if (window == null) return;
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
        if (fullScreen) {
            WindowCompat.setDecorFitsSystemWindows(window, false);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                WindowManager.LayoutParams attributes = window.getAttributes();
                attributes.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
                window.setAttributes(attributes);
            }
            controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            controller.hide(WindowInsetsCompat.Type.systemBars());
        } else {
            WindowCompat.setDecorFitsSystemWindows(window, true);
            controller.show(WindowInsetsCompat.Type.systemBars());
        }
    }

    @PluginMethod
    public void setFullScreen(PluginCall call) {
        fullScreen = Boolean.TRUE.equals(call.getBoolean("full", true));
        Activity activity = getActivity();
        activity.runOnUiThread(() -> {
            applyFullScreen(activity);
            call.resolve();
        });
    }

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
        Activity activity = getActivity();
        activity.runOnUiThread(() -> {
            DisplayMetrics metrics = activity.getResources().getDisplayMetrics();
            Display current = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                ? activity.getDisplay()
                : activity.getWindowManager().getDefaultDisplay();
            JSObject ret = new JSObject();
            ret.put("displayId", current != null ? current.getDisplayId() : -1);
            ret.put("widthPx", metrics.widthPixels);
            ret.put("heightPx", metrics.heightPixels);
            ret.put("density", metrics.density);
            ret.put("hasFocus", activity.hasWindowFocus());
            ret.put(
                "notFocusable",
                (activity.getWindow().getAttributes().flags & WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE) != 0
            );
            ret.put("manufacturer", Build.MANUFACTURER);
            ret.put("model", Build.MODEL);
            ret.put("android", Build.VERSION.RELEASE);

            JSArray displays = new JSArray();
            DisplayManager manager = (DisplayManager) activity.getSystemService(Context.DISPLAY_SERVICE);
            if (manager != null) {
                Set<Integer> presentation = new HashSet<>();
                for (Display d : manager.getDisplays(DisplayManager.DISPLAY_CATEGORY_PRESENTATION)) {
                    presentation.add(d.getDisplayId());
                }
                for (Display d : manager.getDisplays()) {
                    Point size = new Point();
                    d.getRealSize(size);
                    JSObject item = new JSObject();
                    item.put("id", d.getDisplayId());
                    item.put("name", d.getName());
                    item.put("widthPx", size.x);
                    item.put("heightPx", size.y);
                    item.put("isDefault", d.getDisplayId() == Display.DEFAULT_DISPLAY);
                    item.put("presentation", presentation.contains(d.getDisplayId()));
                    item.put("on", d.getState() == Display.STATE_ON);
                    displays.put(item);
                }
            }
            ret.put("displays", displays);
            call.resolve(ret);
        });
    }
}
