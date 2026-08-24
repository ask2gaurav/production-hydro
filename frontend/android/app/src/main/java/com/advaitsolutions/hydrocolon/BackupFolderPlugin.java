package com.advaitsolutions.hydrocolon;

import android.app.Activity;
import android.content.Intent;
import android.content.UriPermission;
import android.net.Uri;
import android.util.Base64;

import androidx.activity.result.ActivityResult;
import androidx.documentfile.provider.DocumentFile;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;
import java.util.List;

/**
 * Lets the operator pick a backup folder via Android's Storage Access Framework
 * (ACTION_OPEN_DOCUMENT_TREE). Unlike Directory.Data/Directory.External, files written
 * here are real shared storage and survive an app uninstall — the persisted URI grant
 * itself needs re-picking after a fresh install, but the files already there remain.
 * No manifest permission is involved anywhere in this flow.
 */
@CapacitorPlugin(name = "BackupFolder")
public class BackupFolderPlugin extends Plugin {

    @PluginMethod
    public void pickFolder(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(
                Intent.FLAG_GRANT_READ_URI_PERMISSION
                        | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                        | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
        );
        startActivityForResult(call, intent, "handlePickFolderResult");
    }

    @ActivityCallback
    private void handlePickFolderResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("Folder selection was cancelled");
            return;
        }
        Uri treeUri = result.getData().getData();
        if (treeUri == null) {
            call.reject("No folder was selected");
            return;
        }
        try {
            getContext().getContentResolver().takePersistableUriPermission(
                    treeUri,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            );
        } catch (SecurityException e) {
            call.reject("Failed to persist folder access: " + e.getMessage());
            return;
        }

        DocumentFile dir = DocumentFile.fromTreeUri(getContext(), treeUri);
        String displayName = (dir != null && dir.getName() != null) ? dir.getName() : treeUri.toString();

        JSObject data = new JSObject();
        data.put("uri", treeUri.toString());
        data.put("name", displayName);
        call.resolve(data);
    }

    @PluginMethod
    public void isAccessible(PluginCall call) {
        String uriString = call.getString("uri");
        JSObject data = new JSObject();
        if (uriString == null) {
            data.put("accessible", false);
            call.resolve(data);
            return;
        }
        boolean found = false;
        List<UriPermission> perms = getContext().getContentResolver().getPersistedUriPermissions();
        for (UriPermission p : perms) {
            if (p.getUri().toString().equals(uriString) && p.isWritePermission()) {
                found = true;
                break;
            }
        }
        data.put("accessible", found);
        call.resolve(data);
    }

    @PluginMethod
    public void writeFile(PluginCall call) {
        String uriString = call.getString("uri");
        String fileName = call.getString("fileName");
        String base64Data = call.getString("data");
        String mimeType = call.getString("mimeType", "application/octet-stream");

        if (uriString == null || fileName == null || base64Data == null) {
            call.reject("Missing 'uri', 'fileName', or 'data' parameter");
            return;
        }

        try {
            Uri treeUri = Uri.parse(uriString);
            DocumentFile dir = DocumentFile.fromTreeUri(getContext(), treeUri);
            if (dir == null || !dir.canWrite()) {
                call.reject("Backup folder is not accessible");
                return;
            }

            // Overwrite semantics: remove any existing child with this name, then create fresh —
            // SAF has no built-in "truncate on create", so this avoids ending up with duplicates.
            DocumentFile existing = dir.findFile(fileName);
            if (existing != null) {
                existing.delete();
            }
            DocumentFile newFile = dir.createFile(mimeType, fileName);
            if (newFile == null) {
                call.reject("Failed to create file in backup folder");
                return;
            }

            byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
            try (OutputStream out = getContext().getContentResolver().openOutputStream(newFile.getUri(), "wt")) {
                if (out == null) {
                    call.reject("Failed to open output stream for backup folder file");
                    return;
                }
                out.write(bytes);
            }

            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to write file to backup folder: " + e.getMessage());
        }
    }
}
