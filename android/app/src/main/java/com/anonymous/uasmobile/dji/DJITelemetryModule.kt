package com.anonymous.uasmobile.dji

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.hardware.usb.UsbManager
import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import dji.common.battery.BatteryState
import dji.common.error.DJIError
import dji.common.flightcontroller.FlightControllerState
import dji.sdk.base.BaseComponent
import dji.sdk.base.BaseProduct
import dji.sdk.battery.Battery
import dji.sdk.flightcontroller.FlightController
import dji.sdk.products.Aircraft
import dji.sdk.sdkmanager.DJISDKInitEvent
import dji.sdk.sdkmanager.DJISDKManager
import kotlin.math.sqrt

class DJITelemetryModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext),
  LifecycleEventListener {

  private val mainHandler = Handler(Looper.getMainLooper())
  private var registered = false
  private var listening = false
  private var flightController: FlightController? = null
  private var battery: Battery? = null
  private var lastLat: Double? = null
  private var lastLng: Double? = null
  private var lastAltitude: Double? = null
  private var lastBatteryPercent: Int? = null
  private var lastSpeed: Double? = null

  private val sdkCallback = object : DJISDKManager.SDKManagerCallback {
    override fun onRegister(error: DJIError?) {
      val ok = error == null || error.description?.contains("success", ignoreCase = true) == true
      registered = ok
      sendStatus(if (ok) "registered" else "register_failed", error?.description ?: error?.toString())
      if (ok) {
        startProductConnection()
      }
    }

    override fun onProductDisconnect() {
      sendStatus("product_disconnected")
      clearListeners()
    }

    override fun onProductConnect(product: BaseProduct?) {
      sendStatus("product_connected", product?.model?.displayName)
      bindProduct(product)
    }

    override fun onProductChanged(product: BaseProduct?) {
      bindProduct(product)
    }

    override fun onComponentChange(
      key: BaseProduct.ComponentKey?,
      oldComponent: BaseComponent?,
      newComponent: BaseComponent?
    ) {
      bindProduct(DJISDKManager.getInstance().product)
    }

    override fun onInitProcess(event: DJISDKInitEvent?, totalProcess: Int) {
      sendStatus("sdk_init_progress", "${event?.toString() ?: "unknown"}:$totalProcess")
    }

    override fun onDatabaseDownloadProgress(current: Long, total: Long) {
      sendStatus("sdk_db_progress", "$current/$total")
    }
  }

  private val usbReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      when (intent?.action) {
        UsbManager.ACTION_USB_ACCESSORY_ATTACHED,
        UsbManager.ACTION_USB_DEVICE_ATTACHED -> {
          sendStatus("usb_attached")
          if (listening) startProductConnection()
        }
        UsbManager.ACTION_USB_ACCESSORY_DETACHED,
        UsbManager.ACTION_USB_DEVICE_DETACHED -> {
          sendStatus("usb_detached")
          clearListeners()
        }
      }
    }
  }

  init {
    reactContext.addLifecycleEventListener(this)
  }

  override fun getName(): String = "DjiTelemetry"

  @ReactMethod
  fun startTelemetry(promise: Promise) {
    listening = true
    sendStatus("starting")
    registerUsbReceiver()
    registerSdk()
    promise.resolve(true)
  }

  @ReactMethod
  fun stopTelemetry(promise: Promise) {
    listening = false
    clearListeners()
    unregisterUsbReceiver()
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

  override fun onHostResume() {
    if (listening) registerUsbReceiver()
  }

  override fun onHostPause() = Unit

  override fun onHostDestroy() {
    listening = false
    clearListeners()
    unregisterUsbReceiver()
  }

  private fun registerUsbReceiver() {
    try {
      val filter = IntentFilter().apply {
        addAction(UsbManager.ACTION_USB_ACCESSORY_ATTACHED)
        addAction(UsbManager.ACTION_USB_ACCESSORY_DETACHED)
        addAction(UsbManager.ACTION_USB_DEVICE_ATTACHED)
        addAction(UsbManager.ACTION_USB_DEVICE_DETACHED)
      }
      reactContext.registerReceiver(usbReceiver, filter)
    } catch (_: Exception) {
    }
  }

  private fun unregisterUsbReceiver() {
    try {
      reactContext.unregisterReceiver(usbReceiver)
    } catch (_: Exception) {
    }
  }

  private fun registerSdk() {
    mainHandler.post {
      if (!listening) return@post
      try {
        val apiKey = getDjiApiKey()
        if (apiKey.isBlank() || apiKey == "\${DJI_API_KEY}") {
          sendStatus("api_key_missing", "Configura la DJI_API_KEY antes de generar el APK.")
          return@post
        }

        sendStatus("registering_sdk")
        if (registered) {
          sendStatus("sdk_already_registered")
          startProductConnection()
          return@post
        }

        DJISDKManager.getInstance().registerApp(reactContext.applicationContext, sdkCallback)
        sendStatus("register_app_called")
      } catch (error: Throwable) {
        sendStatus("sdk_unavailable", error.message ?: error.toString())
      }
    }
  }

  private fun getDjiApiKey(): String {
    return try {
      val appInfo = reactContext.packageManager.getApplicationInfo(
        reactContext.packageName,
        PackageManager.GET_META_DATA
      )
      appInfo.metaData?.getString("com.dji.sdk.API_KEY")?.trim() ?: ""
    } catch (_: Throwable) {
      ""
    }
  }

  private fun startProductConnection() {
    try {
      sendStatus("connecting_product")
      DJISDKManager.getInstance().startConnectionToProduct()
      scheduleProductProbe(1)
    } catch (error: Throwable) {
      sendStatus("connection_start_failed", error.message ?: error.toString())
    }
  }

  private fun scheduleProductProbe(attempt: Int) {
    if (!listening || attempt > 15) return
    mainHandler.postDelayed({
      if (!listening) return@postDelayed
      bindProduct(DJISDKManager.getInstance().product)
      if (flightController == null || battery == null) {
        scheduleProductProbe(attempt + 1)
      }
    }, 2000L)
  }

  private fun bindProduct(product: BaseProduct?) {
    mainHandler.post {
      try {
        if (product == null) {
          sendStatus("waiting_product")
          return@post
        }

        sendStatus("product_ready", product.model?.displayName ?: product.javaClass.simpleName)
        if (product !is Aircraft) {
          sendStatus("not_aircraft", product.model?.displayName ?: product.javaClass.simpleName)
          return@post
        }

        flightController = product.flightController
        battery = product.battery

        attachFlightControllerCallback()
        attachBatteryCallback()
      } catch (error: Throwable) {
        sendStatus("bind_failed", error.message ?: error.toString())
      }
    }
  }

  private fun attachFlightControllerCallback() {
    val fc = flightController ?: return
    try {
      fc.setStateCallback { state ->
        updateFromFlightState(state)
      }
      sendStatus("flight_controller_listening")
    } catch (error: Throwable) {
      sendStatus("flight_controller_failed", error.message ?: error.toString())
    }
  }

  private fun attachBatteryCallback() {
    val bat = battery ?: return
    try {
      bat.setStateCallback { state ->
        updateFromBatteryState(state)
      }
      sendStatus("battery_listening")
    } catch (error: Throwable) {
      sendStatus("battery_failed", error.message ?: error.toString())
    }
  }

  private fun clearListeners() {
    try {
      flightController?.setStateCallback(null)
    } catch (_: Throwable) {
    }
    try {
      battery?.setStateCallback(null)
    } catch (_: Throwable) {
    }
    flightController = null
    battery = null
  }

  private fun updateFromFlightState(state: FlightControllerState) {
    try {
      val location = state.aircraftLocation
      lastLat = location?.latitude
      lastLng = location?.longitude
      lastAltitude = location?.altitude?.toDouble()

      val vx = state.velocityX.toDouble()
      val vy = state.velocityY.toDouble()
      val vz = state.velocityZ.toDouble()
      lastSpeed = sqrt(vx * vx + vy * vy + vz * vz)
      emitTelemetry()
    } catch (error: Throwable) {
      sendStatus("flight_state_parse_failed", error.message ?: error.toString())
    }
  }

  private fun updateFromBatteryState(state: BatteryState) {
    lastBatteryPercent = state.chargeRemainingInPercent
    emitTelemetry()
  }

  private fun emitTelemetry() {
    val payload = Arguments.createMap().apply {
      putDouble("timestamp", System.currentTimeMillis().toDouble())
      if (lastLat != null) putDouble("lat", lastLat!!)
      if (lastLng != null) putDouble("lng", lastLng!!)
      if (lastAltitude != null) putDouble("altitude", lastAltitude!!)
      if (lastBatteryPercent != null) putInt("batteryPercent", lastBatteryPercent!!)
      if (lastSpeed != null) putDouble("speed", lastSpeed!!)
    }
    sendEvent("DJI_TELEMETRY", payload)
  }

  private fun sendStatus(status: String, message: String? = null) {
    val payload = Arguments.createMap().apply {
      putString("status", status)
      if (message != null) putString("message", message)
      putDouble("timestamp", System.currentTimeMillis().toDouble())
    }
    sendEvent("DJI_STATUS", payload)
  }

  private fun sendEvent(name: String, payload: Any) {
    if (!reactContext.hasActiveReactInstance()) return
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(name, payload)
  }
}
