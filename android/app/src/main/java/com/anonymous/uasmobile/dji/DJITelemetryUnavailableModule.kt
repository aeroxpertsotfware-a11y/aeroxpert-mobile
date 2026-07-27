package com.anonymous.uasmobile.dji

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

class DJITelemetryUnavailableModule(
  private val reactContext: ReactApplicationContext,
  private val reason: String
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "DjiTelemetry"

  @ReactMethod
  fun startTelemetry(promise: Promise) {
    sendStatus("sdk_unavailable", reason)
    promise.resolve(false)
  }

  @ReactMethod
  fun stopTelemetry(promise: Promise) {
    promise.resolve(true)
  }

  @ReactMethod
  fun addListener(eventName: String) {
    // Required by NativeEventEmitter.
  }

  @ReactMethod
  fun removeListeners(count: Int) {
    // Required by NativeEventEmitter.
  }

  private fun sendStatus(status: String, message: String? = null) {
    val payload = Arguments.createMap().apply {
      putString("status", status)
      if (!message.isNullOrBlank()) putString("message", message)
      putDouble("timestamp", System.currentTimeMillis().toDouble())
    }
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("DJI_STATUS", payload)
  }
}
