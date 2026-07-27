package com.anonymous.uasmobile.dji

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import dji.common.error.DJIError
import dji.common.useraccount.UserAccountState
import dji.common.util.CommonCallbacks
import dji.sdk.useraccount.UserAccountManager

class DJIAccountModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "DjiAccount"

  @ReactMethod
  fun getStatus(promise: Promise) {
    resolveStatus(promise)
  }

  @ReactMethod
  fun login(promise: Promise) {
    val activity = reactContext.currentActivity
    if (activity == null || activity.isFinishing) {
      promise.reject("DJI_ACTIVITY_REQUIRED", "No hay una actividad activa para abrir el login de DJI.")
      return
    }

    activity.runOnUiThread {
      try {
        UserAccountManager.getInstance().logIntoDJIUserAccount(
          activity,
          object : CommonCallbacks.CompletionCallbackWith<UserAccountState> {
            override fun onSuccess(userAccountState: UserAccountState?) {
              resolveStatus(promise)
            }

            override fun onFailure(error: DJIError?) {
              promise.reject(
                "DJI_LOGIN_FAILED",
                error?.description ?: error?.toString() ?: "No se pudo iniciar sesion en DJI."
              )
            }
          }
        )
      } catch (error: Throwable) {
        promise.reject("DJI_LOGIN_EXCEPTION", error.message ?: error.toString())
      }
    }
  }

  @ReactMethod
  fun logout(promise: Promise) {
    try {
      UserAccountManager.getInstance().logoutOfDJIUserAccount(
        object : CommonCallbacks.CompletionCallback<DJIError> {
          override fun onResult(error: DJIError?) {
            if (error != null) {
              promise.reject(
                "DJI_LOGOUT_FAILED",
                error.description ?: error.toString()
              )
              return
            }
            resolveStatus(promise)
          }
        }
      )
    } catch (error: Throwable) {
      promise.reject("DJI_LOGOUT_EXCEPTION", error.message ?: error.toString())
    }
  }

  private fun resolveStatus(promise: Promise) {
    val manager = try {
      UserAccountManager.getInstance()
    } catch (error: Throwable) {
      promise.reject("DJI_ACCOUNT_UNAVAILABLE", error.message ?: error.toString())
      return
    }

    val state = try {
      manager.userAccountState
    } catch (_: Throwable) {
      UserAccountState.UNKNOWN
    }

    val payload = Arguments.createMap().apply {
      putBoolean("available", true)
      putString("state", state.name)
      putBoolean("loggedIn", state != UserAccountState.NOT_LOGGED_IN && state != UserAccountState.UNKNOWN)
    }

    manager.getLoggedInDJIUserAccountName(
      object : CommonCallbacks.CompletionCallbackWith<String> {
        override fun onSuccess(name: String?) {
          payload.putString("accountName", name ?: "")
          promise.resolve(payload)
        }

        override fun onFailure(error: DJIError?) {
          payload.putString("message", error?.description ?: error?.toString() ?: "")
          promise.resolve(payload)
        }
      }
    )
  }
}
