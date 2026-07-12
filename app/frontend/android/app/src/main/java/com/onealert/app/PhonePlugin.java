package com.onealert.app;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.telephony.TelephonyManager;
import androidx.core.app.ActivityCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "PhonePlugin",
    permissions = {
        @Permission(
            alias = "phone",
            strings = {
                Manifest.permission.READ_PHONE_STATE,
                Manifest.permission.READ_PHONE_NUMBERS
            }
        )
    }
)
public class PhonePlugin extends Plugin {

    @PluginMethod
    public void getPhoneNumber(PluginCall call) {
        if (getPermissionState("phone") != com.getcapacitor.PermissionState.GRANTED) {
            requestPermissionForAlias("phone", call, "phonePermsCallback");
        } else {
            fetchNumber(call);
        }
    }

    @PermissionCallback
    private void phonePermsCallback(PluginCall call) {
        if (getPermissionState("phone") == com.getcapacitor.PermissionState.GRANTED) {
            fetchNumber(call);
        } else {
            call.reject("Permission denied for phone number");
        }
    }

    private void fetchNumber(PluginCall call) {
        try {
            Context context = getContext();
            TelephonyManager tMgr = (TelephonyManager) context.getSystemService(Context.TELEPHONY_SERVICE);
            
            // Check again for safety
            if (ActivityCompat.checkSelfPermission(context, Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED) {
                call.reject("Permission missing");
                return;
            }
            
            String mPhoneNumber = tMgr.getLine1Number();
            JSObject ret = new JSObject();
            if (mPhoneNumber != null && !mPhoneNumber.isEmpty()) {
                ret.put("number", mPhoneNumber);
            } else {
                ret.put("number", "");
            }
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to get phone number", e);
        }
    }
}
