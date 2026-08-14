package com.anonymous.uasmobile.stream

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.anonymous.uasmobile.MainActivity
import com.anonymous.uasmobile.R
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.pedro.common.ConnectChecker
import com.pedro.encoder.input.sources.audio.NoAudioSource
import com.pedro.encoder.input.sources.video.NoVideoSource
import com.pedro.encoder.input.sources.video.ScreenSource
import com.pedro.library.generic.GenericStream

class ScreenBroadcastService : Service(), ConnectChecker {
  companion object {
    private const val CHANNEL_ID = "sgo_screen_broadcast"
    private const val NOTIFICATION_ID = 7315
    private const val ACTION_START = "com.anonymous.uasmobile.stream.START"
    private const val ACTION_STOP = "com.anonymous.uasmobile.stream.STOP"
    private const val EXTRA_RESULT_CODE = "resultCode"
    private const val EXTRA_RESULT_DATA = "resultData"
    private const val EXTRA_RTMP_URL = "rtmpUrl"
    private const val EXTRA_TITLE = "title"
    private const val EXTRA_SESSION_ID = "sessionId"

    @Volatile private var state = "idle"
    @Volatile private var detail = ""
    @Volatile private var bitrate = 0L
    @Volatile private var activeSessionId = ""

    fun start(context: Context, resultCode: Int, data: Intent, url: String, title: String, sessionId: String) {
      val intent = Intent(context, ScreenBroadcastService::class.java).apply {
        action = ACTION_START
        putExtra(EXTRA_RESULT_CODE, resultCode)
        putExtra(EXTRA_RESULT_DATA, data)
        putExtra(EXTRA_RTMP_URL, url)
        putExtra(EXTRA_TITLE, title)
        putExtra(EXTRA_SESSION_ID, sessionId)
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent)
      else context.startService(intent)
    }

    fun stop(context: Context) {
      context.startService(Intent(context, ScreenBroadcastService::class.java).apply { action = ACTION_STOP })
    }

    fun statusMap(): WritableMap = Arguments.createMap().apply {
      putString("state", state)
      putString("detail", detail)
      putDouble("bitrate", bitrate.toDouble())
      putBoolean("isStreaming", state == "connecting" || state == "live" || state == "reconnecting")
      putString("sessionId", activeSessionId)
    }
  }

  private var stream: GenericStream? = null
  private var projection: MediaProjection? = null

  override fun onCreate() {
    super.onCreate()
    val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      manager.createNotificationChannel(NotificationChannel(
        CHANNEL_ID,
        "Transmisión de pantalla S-GO",
        NotificationManager.IMPORTANCE_LOW
      ))
    }
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_STOP -> stopBroadcast()
      ACTION_START -> startBroadcast(intent)
    }
    return START_NOT_STICKY
  }

  @Suppress("DEPRECATION")
  private fun projectionData(intent: Intent): Intent? =
    if (Build.VERSION.SDK_INT >= 33) intent.getParcelableExtra(EXTRA_RESULT_DATA, Intent::class.java)
    else intent.getParcelableExtra(EXTRA_RESULT_DATA)

  private fun startBroadcast(intent: Intent) {
    val url = intent.getStringExtra(EXTRA_RTMP_URL).orEmpty()
    val title = intent.getStringExtra(EXTRA_TITLE).orEmpty().ifBlank { "Transmisión S-GO" }
    activeSessionId = intent.getStringExtra(EXTRA_SESSION_ID).orEmpty()
    val resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, 0)
    val data = projectionData(intent)
    showNotification(title, "Preparando transmisión…")
    if (data == null || resultCode == 0 || url.isBlank()) {
      fail("No se recibieron permisos de captura válidos.")
      return
    }
    try {
      stream?.release()
      projection?.stop()
      val manager = getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
      projection = manager.getMediaProjection(resultCode, data)
      val currentProjection = projection ?: error("Android no permitió capturar la pantalla.")
      val display = resources.displayMetrics
      val landscape = display.widthPixels >= display.heightPixels
      val width = if (landscape) 1280 else 720
      val height = if (landscape) 720 else 1280
      val rotation = 0
      stream = GenericStream(applicationContext, this, NoVideoSource(), NoAudioSource()).apply {
        getGlInterface().setForceRender(true, 24)
        if (!prepareVideo(width, height, 3_500_000, fps = 24, iFrameInterval = 2, rotation = rotation)) {
          error("El codificador de video del control no está disponible.")
        }
        changeVideoSource(ScreenSource(applicationContext, currentProjection))
        getStreamClient().setReTries(20)
        startStream(url)
      }
      state = "connecting"
      detail = "Conectando con S-GO"
    } catch (error: Throwable) {
      fail(error.message ?: "No se pudo iniciar la transmisión.")
    }
  }

  private fun showNotification(title: String, message: String) {
    val openIntent = PendingIntent.getActivity(
      this, 0, Intent(this, MainActivity::class.java),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    val stopIntent = PendingIntent.getService(
      this, 1, Intent(this, ScreenBroadcastService::class.java).apply { action = ACTION_STOP },
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    val notification = NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentTitle(title)
      .setContentText(message)
      .setContentIntent(openIntent)
      .setOngoing(true)
      .addAction(0, "Detener", stopIntent)
      .build()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION)
    } else startForeground(NOTIFICATION_ID, notification)
  }

  private fun stopBroadcast() {
    state = "stopping"
    stream?.stopStream()
    stream?.release()
    stream = null
    projection?.stop()
    projection = null
    state = "idle"
    detail = ""
    bitrate = 0
    activeSessionId = ""
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  private fun fail(message: String) {
    state = "error"
    detail = message
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  override fun onDestroy() {
    stream?.release()
    projection?.stop()
    stream = null
    projection = null
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null
  override fun onConnectionStarted(url: String) { state = "connecting" }
  override fun onConnectionSuccess() { state = "live"; detail = "Pantalla en vivo" }
  override fun onNewBitrate(value: Long) { bitrate = value }
  override fun onConnectionFailed(reason: String) {
    state = "reconnecting"
    detail = reason
    stream?.getStreamClient()?.reTry(1500, reason, null)
  }
  override fun onDisconnect() { if (state != "stopping") state = "idle" }
  override fun onAuthError() { fail("El servidor rechazó la transmisión.") }
  override fun onAuthSuccess() = Unit
}
