package com.anonymous.uasmobile.stream

import android.app.Activity
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.os.Build
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class ScreenBroadcastModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext), ActivityEventListener {

  companion object {
    private const val REQUEST_CAPTURE = 7314
  }

  private var pendingUrl = ""
  private var pendingTitle = "Transmisión S-GO"
  private var pendingSessionId = ""
  private var pendingPromise: Promise? = null

  init {
    reactContext.addActivityEventListener(this)
  }

  override fun getName() = "ScreenBroadcast"

  @ReactMethod
  fun getDeviceInfo(promise: Promise) {
    val model = Build.MODEL.orEmpty()
    val manufacturer = Build.MANUFACTURER.orEmpty()
    val brand = Build.BRAND.orEmpty()
    val product = Build.PRODUCT.orEmpty()
    val fingerprint = "$manufacturer $brand $model $product".lowercase()
    val isRcPlus = fingerprint.contains("dji") &&
      (fingerprint.contains("rc plus") || fingerprint.contains("rcplus"))
    val isRcProEnterprise = fingerprint.contains("rm510b") ||
      (fingerprint.contains("dji") && fingerprint.contains("rc pro enterprise"))
    promise.resolve(Arguments.createMap().apply {
      putString("manufacturer", manufacturer)
      putString("brand", brand)
      putString("model", model)
      putString("product", product)
      putString("deviceName", Build.DEVICE.orEmpty())
      putBoolean("isRcPlus", isRcPlus)
      putBoolean("isRcProEnterprise", isRcProEnterprise)
      putBoolean("isSupportedController", isRcPlus || isRcProEnterprise)
      putInt("androidApi", Build.VERSION.SDK_INT)
    })
  }

  @ReactMethod
  fun getStatus(promise: Promise) {
    promise.resolve(ScreenBroadcastService.statusMap())
  }

  @ReactMethod
  fun start(rtmpUrl: String, title: String, sessionId: String, promise: Promise) {
    if (!rtmpUrl.startsWith("rtmp://") && !rtmpUrl.startsWith("rtmps://")) {
      promise.reject("INVALID_RTMP", "La dirección de transmisión no es válida.")
      return
    }
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "Abre S-GO para autorizar la captura de pantalla.")
      return
    }
    if (pendingPromise != null) {
      promise.reject("BUSY", "Ya existe una autorización de pantalla pendiente.")
      return
    }
    pendingUrl = rtmpUrl
    pendingTitle = title.ifBlank { "Transmisión S-GO" }
    pendingSessionId = sessionId
    pendingPromise = promise
    val manager = activity.getSystemService(Activity.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
    activity.startActivityForResult(manager.createScreenCaptureIntent(), REQUEST_CAPTURE)
  }

  @ReactMethod
  fun stop(promise: Promise) {
    ScreenBroadcastService.stop(reactContext)
    promise.resolve(true)
  }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode != REQUEST_CAPTURE) return
    val promise = pendingPromise
    pendingPromise = null
    if (resultCode != Activity.RESULT_OK || data == null) {
      promise?.reject("CAPTURE_DENIED", "No se autorizó compartir la pantalla.")
      return
    }
    try {
      ScreenBroadcastService.start(reactContext, resultCode, data, pendingUrl, pendingTitle, pendingSessionId)
      promise?.resolve(true)
    } catch (error: Throwable) {
      promise?.reject("START_FAILED", error.message, error)
    }
  }

  override fun onNewIntent(intent: Intent) = Unit
}
