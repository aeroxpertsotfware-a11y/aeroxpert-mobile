package com.anonymous.uasmobile.dji

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class DJITelemetryPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
    val modules = mutableListOf<NativeModule>()

    try {
      modules.add(DJITelemetryModule(reactContext))
    } catch (error: Throwable) {
      modules.add(
        DJITelemetryUnavailableModule(
          reactContext,
          error.message ?: error.javaClass.simpleName
        )
      )
    }

    modules.add(DJIAccountModule(reactContext))
    modules.add(DJIFlightLogSyncModule(reactContext))
    return modules
  }

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
    return emptyList()
  }
}
