package com.local.pokedextracker;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Intent;
import android.content.UriPermission;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.provider.OpenableColumns;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Linked save folders for the web layer (src/lib/save/android-folders.ts): the system
 * folder picker with a persisted READ grant, a scan for files that could be saves, and
 * reading them. Read only — the write permission is never asked for or taken, so this
 * app can't change an emulator's or a save editor's files.
 *
 * Also receives a single save handed over by another app ("Open with" / "Share",
 * the intent filters in AndroidManifest.xml) as the retained event "saveFileReceived".
 *
 * The rules of what a scan keeps mirror src/lib/save/folder-scan.ts.
 */
@CapacitorPlugin(name = "SaveFolders")
public class SaveFoldersPlugin extends Plugin {

    static final long MIN_SAVE_BYTES = 128 * 1024;
    static final long MAX_SAVE_BYTES = 2 * 1024 * 1024;
    static final int MAX_CANDIDATES = 500;
    static final int MAX_ENTRIES = 5000;
    static final int DEFAULT_DEPTH = 4;
    static final Set<String> SKIP_FOLDERS = new HashSet<>(
        Arrays.asList("states", "cheats", "config", "cores", "shaders", "screenshots", "thumbnails", "system", "playlists")
    );
    static final Set<String> SAVE_EXTENSIONS = new HashSet<>(Arrays.asList("sav", "srm", "dsv", "dat", "bin"));
    static final String SHORTCUT_SCHEME = "pokedextracker";

    private final ExecutorService io = Executors.newSingleThreadExecutor();

    @Override
    public void load() {
        Activity activity = getActivity();
        if (activity != null) handleIncoming(activity.getIntent());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        handleIncoming(intent);
    }

    // ── Picking and listing folders ─────────────────────────────────────────

    @PluginMethod
    public void pickFolder(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(call, intent, "onFolderPicked");
    }

    @ActivityCallback
    private void onFolderPicked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
            call.reject("No folder was picked", "cancelled");
            return;
        }
        Uri tree = data.getData();
        try {
            // Read only: the write flag is never taken
            getContext().getContentResolver().takePersistableUriPermission(tree, Intent.FLAG_GRANT_READ_URI_PERMISSION);
        } catch (SecurityException e) {
            call.reject("Android didn't allow this folder to be kept", "failed", e);
            return;
        }
        call.resolve(folderJson(tree));
    }

    @PluginMethod
    public void listFolders(PluginCall call) {
        JSArray folders = new JSArray();
        for (UriPermission permission : getContext().getContentResolver().getPersistedUriPermissions()) {
            Uri uri = permission.getUri();
            if (permission.isReadPermission() && DocumentsContract.isTreeUri(uri)) folders.put(folderJson(uri));
        }
        JSObject ret = new JSObject();
        ret.put("folders", folders);
        call.resolve(ret);
    }

    @PluginMethod
    public void releaseFolder(PluginCall call) {
        String treeUri = call.getString("treeUri");
        if (treeUri == null) {
            call.reject("treeUri is required", "failed");
            return;
        }
        try {
            getContext().getContentResolver().releasePersistableUriPermission(Uri.parse(treeUri), Intent.FLAG_GRANT_READ_URI_PERMISSION);
        } catch (SecurityException ignored) {
            // Already gone
        }
        call.resolve();
    }

    private JSObject folderJson(Uri tree) {
        JSObject folder = new JSObject();
        folder.put("treeUri", tree.toString());
        folder.put("name", folderName(tree));
        return folder;
    }

    /** "primary:Saves/nds" → "Saves/nds"; another volume keeps its id ("1A2B-3C4D: Saves") */
    private static String folderName(Uri tree) {
        String id;
        try {
            id = DocumentsContract.getTreeDocumentId(tree);
        } catch (IllegalArgumentException e) {
            return tree.getLastPathSegment();
        }
        int colon = id.indexOf(':');
        if (colon < 0) return id;
        String volume = id.substring(0, colon);
        String path = id.substring(colon + 1);
        if (volume.equals("primary")) return path.isEmpty() ? "Internal storage" : path;
        return path.isEmpty() ? volume : volume + ": " + path;
    }

    // ── Scanning ────────────────────────────────────────────────────────────

    @PluginMethod
    public void scan(PluginCall call) {
        String treeUri = call.getString("treeUri");
        int maxDepth = call.getInt("maxDepth", DEFAULT_DEPTH);
        if (treeUri == null) {
            call.reject("treeUri is required", "failed");
            return;
        }
        io.execute(() -> {
            try {
                Uri tree = Uri.parse(treeUri);
                ScanState state = new ScanState();
                walk(tree, DocumentsContract.getTreeDocumentId(tree), "", 1, maxDepth, state);
                JSObject ret = new JSObject();
                ret.put("files", state.files);
                ret.put("truncated", state.truncated);
                call.resolve(ret);
            } catch (SecurityException e) {
                call.reject("Access to this folder was taken back", "gone", e);
            } catch (Exception e) {
                call.reject("The folder couldn't be read", "failed", e);
            }
        });
    }

    private static class ScanState {
        final JSArray files = new JSArray();
        int candidates = 0;
        int visited = 0;
        boolean truncated = false;
    }

    private void walk(Uri tree, String parentId, String path, int depth, int maxDepth, ScanState state) {
        Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, parentId);
        String[] projection = {
            DocumentsContract.Document.COLUMN_DOCUMENT_ID,
            DocumentsContract.Document.COLUMN_DISPLAY_NAME,
            DocumentsContract.Document.COLUMN_MIME_TYPE,
            DocumentsContract.Document.COLUMN_SIZE,
            DocumentsContract.Document.COLUMN_LAST_MODIFIED,
        };
        try (Cursor cursor = getContext().getContentResolver().query(children, projection, null, null, null)) {
            if (cursor == null) return;
            while (cursor.moveToNext()) {
                if (++state.visited > MAX_ENTRIES || state.candidates >= MAX_CANDIDATES) {
                    state.truncated = true;
                    return;
                }
                String id = cursor.getString(0);
                String name = cursor.getString(1);
                String mime = cursor.getString(2);
                long size = cursor.isNull(3) ? -1 : cursor.getLong(3);
                long modified = cursor.isNull(4) ? 0 : cursor.getLong(4);
                if (name == null || id == null) continue;
                String at = path.isEmpty() ? name : path + "/" + name;
                if (DocumentsContract.Document.MIME_TYPE_DIR.equals(mime)) {
                    if (depth < maxDepth && isScannedFolder(name)) walk(tree, id, at, depth + 1, maxDepth, state);
                    continue;
                }
                if (!isSaveCandidate(name, size)) continue;
                JSObject file = new JSObject();
                file.put("uri", DocumentsContract.buildDocumentUriUsingTree(tree, id).toString());
                file.put("name", name);
                file.put("path", at);
                file.put("size", size);
                file.put("lastModified", modified);
                state.files.put(file);
                state.candidates++;
            }
        }
    }

    static boolean isScannedFolder(String name) {
        return !name.startsWith(".") && !SKIP_FOLDERS.contains(name.toLowerCase(Locale.ROOT));
    }

    static boolean isSaveCandidate(String name, long size) {
        if (name.startsWith(".") || size < MIN_SAVE_BYTES || size > MAX_SAVE_BYTES) return false;
        int dot = name.lastIndexOf('.');
        return dot <= 0 || SAVE_EXTENSIONS.contains(name.substring(dot + 1).toLowerCase(Locale.ROOT));
    }

    // ── Reading ─────────────────────────────────────────────────────────────

    @PluginMethod
    public void stat(PluginCall call) {
        String uri = call.getString("uri");
        if (uri == null) {
            call.reject("uri is required", "failed");
            return;
        }
        io.execute(() -> {
            try {
                long[] info = statOf(Uri.parse(uri));
                if (info == null) {
                    call.reject("The file is gone", "gone");
                    return;
                }
                JSObject ret = new JSObject();
                ret.put("size", info[0]);
                ret.put("lastModified", info[1]);
                call.resolve(ret);
            } catch (SecurityException e) {
                call.reject("Access to this file was taken back", "gone", e);
            } catch (Exception e) {
                call.reject("The file couldn't be checked", "failed", e);
            }
        });
    }

    @PluginMethod
    public void read(PluginCall call) {
        String uri = call.getString("uri");
        if (uri == null) {
            call.reject("uri is required", "failed");
            return;
        }
        io.execute(() -> {
            try {
                Uri document = Uri.parse(uri);
                long[] info = statOf(document);
                if (info == null) {
                    call.reject("The file is gone", "gone");
                    return;
                }
                if (info[0] > MAX_SAVE_BYTES) {
                    call.reject("That file is too big to be a save", "too_big");
                    return;
                }
                byte[] bytes = readCapped(getContext().getContentResolver(), document);
                if (bytes == null) {
                    call.reject("That file is too big to be a save", "too_big");
                    return;
                }
                JSObject ret = new JSObject();
                ret.put("data", Base64.encodeToString(bytes, Base64.NO_WRAP));
                ret.put("size", bytes.length);
                ret.put("lastModified", info[1]);
                call.resolve(ret);
            } catch (SecurityException | java.io.FileNotFoundException e) {
                call.reject("The file is gone, or access to it was taken back", "gone", e);
            } catch (Exception e) {
                call.reject("The file couldn't be read", "failed", e);
            }
        });
    }

    /** {size, lastModified}, or null when the document doesn't exist */
    private long[] statOf(Uri document) {
        String[] projection = { DocumentsContract.Document.COLUMN_SIZE, DocumentsContract.Document.COLUMN_LAST_MODIFIED };
        try (Cursor cursor = getContext().getContentResolver().query(document, projection, null, null, null)) {
            if (cursor == null || !cursor.moveToFirst()) return null;
            return new long[] { cursor.isNull(0) ? 0 : cursor.getLong(0), cursor.isNull(1) ? 0 : cursor.getLong(1) };
        }
    }

    /** The whole stream, or null when it is longer than a save can be */
    static byte[] readCapped(ContentResolver resolver, Uri uri) throws IOException {
        try (InputStream in = resolver.openInputStream(uri)) {
            if (in == null) throw new java.io.FileNotFoundException(uri.toString());
            ByteArrayOutputStream out = new ByteArrayOutputStream(512 * 1024);
            byte[] buffer = new byte[64 * 1024];
            long total = 0;
            int n;
            while ((n = in.read(buffer)) != -1) {
                total += n;
                if (total > MAX_SAVE_BYTES) return null;
                out.write(buffer, 0, n);
            }
            return out.toByteArray();
        }
    }

    // ── A save handed over by another app ───────────────────────────────────

    private void handleIncoming(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        Uri uri = null;
        if (Intent.ACTION_VIEW.equals(action)) {
            uri = intent.getData();
        } else if (Intent.ACTION_SEND.equals(action)) {
            uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
        }
        if (uri == null) return;
        String scheme = uri.getScheme();
        // Launcher shortcuts (pokedextracker://…) go to @capacitor/app's appUrlOpen instead
        if (scheme == null || SHORTCUT_SCHEME.equals(scheme)) return;
        if (!ContentResolver.SCHEME_CONTENT.equals(scheme) && !ContentResolver.SCHEME_FILE.equals(scheme)) return;
        final Uri incoming = uri;
        // Handled once: a recreated activity mustn't import it again
        intent.setAction(null);
        io.execute(() -> {
            JSObject event = new JSObject();
            event.put("name", displayName(incoming));
            try {
                byte[] bytes = readCapped(getContext().getContentResolver(), incoming);
                if (bytes == null) {
                    event.put("error", "too_big");
                } else {
                    event.put("data", Base64.encodeToString(bytes, Base64.NO_WRAP));
                    event.put("size", bytes.length);
                }
            } catch (Exception e) {
                event.put("error", "failed");
            }
            // Retained until the page listens, so a cold start doesn't lose it
            notifyListeners("saveFileReceived", event, true);
        });
    }

    private String displayName(Uri uri) {
        try (Cursor cursor = getContext().getContentResolver().query(uri, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null)) {
            if (cursor != null && cursor.moveToFirst() && !cursor.isNull(0)) return cursor.getString(0);
        } catch (Exception ignored) {
            // Fall back to the path
        }
        String last = uri.getLastPathSegment();
        return last != null ? last : "save.sav";
    }
}
