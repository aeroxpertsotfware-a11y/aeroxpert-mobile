package com.anonymous.uasmobile.dji

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Environment
import android.webkit.MimeTypeMap
import androidx.documentfile.provider.DocumentFile
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.util.Locale

class DJIFlightLogSyncModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext), ActivityEventListener {

  private val prefs = reactContext.getSharedPreferences("dji_flight_log_sync", 0)
  private var folderPickerPromise: Promise? = null
  private var folderPickerSourceApp: String? = null

  private data class SourceDefinition(
    val sourceApp: String,
    val label: String,
    val paths: List<String>,
    val acceptedMarkers: List<String>
  )

  private val supportedSources = listOf(
    SourceDefinition(
      sourceApp = "DJI_FLY",
      label = "DJI Fly",
      paths = listOf(
        "DJI/dji.go.v5/LOG",
        "DJI/dji.go.v5/FlightRecord",
        "Android/data/dji.go.v5/files/LOG",
        "Android/data/dji.go.v5/files/FlightRecord"
      ),
      acceptedMarkers = listOf(
        "dji.go.v5",
        "flightrecord",
        "/log",
        "\\log"
      )
    ),
    SourceDefinition(
      sourceApp = "DJI_GO_4",
      label = "DJI GO 4",
      paths = listOf(
        "DJI/dji.go.v4/LOG",
        "DJI/dji.go.v4/FlightRecord",
        "Android/data/dji.go.v4/files/FlightRecord"
      ),
      acceptedMarkers = listOf(
        "dji.go.v4",
        "flightrecord",
        "/log",
        "\\log"
      )
    ),
    SourceDefinition(
      sourceApp = "DJI_PILOT_2",
      label = "DJI Pilot / Pilot 2",
      paths = listOf(
        "DJI/dji.pilot/LOG",
        "DJI/dji.pilot/FlightRecord",
        "DJI/com.dji.industry.pilot/LOG",
        "DJI/com.dji.industry.pilot/FlightRecord",
        "Android/data/com.dji.industry.pilot/files/LOG",
        "Android/data/com.dji.industry.pilot/files/FlightRecord",
        "Android/data/dji.pilot/files/LOG",
        "Android/data/dji.pilot/files/FlightRecord"
      ),
      acceptedMarkers = listOf(
        "dji.pilot",
        "com.dji.industry.pilot",
        "flightrecord",
        "/log",
        "\\log"
      )
    )
  )

  init {
    reactContext.addActivityEventListener(this)
  }

  override fun getName(): String = "DjiFlightLogSync"

  @ReactMethod
  fun getKnownSources(promise: Promise) {
    val baseDir = Environment.getExternalStorageDirectory()
    val payload = Arguments.createArray()

    supportedSources.forEach { source ->
      val item = Arguments.createMap().apply {
        putString("sourceApp", source.sourceApp)
        putString("label", source.label)
        putArray("paths", Arguments.fromList(source.paths))
        putString("persistedUri", prefs.getString(prefKey(source.sourceApp), null))
        putString("baseDir", baseDir.absolutePath)
      }
      payload.pushMap(item)
    }

    promise.resolve(payload)
  }

  @ReactMethod
  fun pickFolder(sourceApp: String, promise: Promise) {
    val activity = reactContext.currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "No hay una actividad Android activa para abrir el selector.")
      return
    }
    if (folderPickerPromise != null) {
      promise.reject("PICKER_BUSY", "Ya hay un selector de carpetas abierto.")
      return
    }

    folderPickerPromise = promise
    folderPickerSourceApp = sourceApp

    try {
      val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
        addFlags(
          Intent.FLAG_GRANT_READ_URI_PERMISSION or
            Intent.FLAG_GRANT_WRITE_URI_PERMISSION or
            Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION or
            Intent.FLAG_GRANT_PREFIX_URI_PERMISSION
        )
      }
      activity.startActivityForResult(intent, FOLDER_PICKER_REQUEST_CODE)
    } catch (error: Throwable) {
      folderPickerPromise = null
      folderPickerSourceApp = null
      promise.reject("PICKER_FAILED", error.message ?: error.toString())
    }
  }

  @ReactMethod
  fun clearFolderAccess(sourceApp: String, promise: Promise) {
    val uriString = prefs.getString(prefKey(sourceApp), null)
    if (!uriString.isNullOrBlank()) {
      try {
        reactContext.contentResolver.releasePersistableUriPermission(
          Uri.parse(uriString),
          Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
        )
      } catch (_: Throwable) {
      }
    }
    prefs.edit().remove(prefKey(sourceApp)).apply()
    promise.resolve(true)
  }

  @ReactMethod
  fun scanFlightLogs(promise: Promise) {
    try {
      val result = Arguments.createMap()
      val files = Arguments.createArray()
      val locations = Arguments.createArray()
      val emittedFingerprints = linkedSetOf<String>()

      supportedSources.forEach { source ->
        source.paths.forEach { relativePath ->
          val directDirectory = File(Environment.getExternalStorageDirectory(), relativePath)
          val location = Arguments.createMap().apply {
            putString("sourceApp", source.sourceApp)
            putString("label", source.label)
            putString("path", directDirectory.absolutePath)
            putString("accessMode", "direct")
            putBoolean("exists", directDirectory.exists())
            putBoolean("readable", directDirectory.canRead())
            putBoolean("configured", false)
          }
          if (directDirectory.exists() && directDirectory.canRead()) {
            scanDirectDirectory(source, directDirectory, files, emittedFingerprints)
          }
          locations.pushMap(location)
        }

        val persistedUri = prefs.getString(prefKey(source.sourceApp), null)
        if (!persistedUri.isNullOrBlank()) {
          val uri = Uri.parse(persistedUri)
          val root = DocumentFile.fromTreeUri(reactContext, uri)
          val configuredPath = root?.name ?: persistedUri
          val location = Arguments.createMap().apply {
            putString("sourceApp", source.sourceApp)
            putString("label", source.label)
            putString("path", configuredPath)
            putString("persistedUri", persistedUri)
            putString("accessMode", "tree")
            putBoolean("exists", root?.exists() == true)
            putBoolean("readable", root?.canRead() == true)
            putBoolean("configured", true)
          }
          if (root != null && root.exists() && root.canRead()) {
            scanTreeDirectory(source, root, files, emittedFingerprints)
          }
          locations.pushMap(location)
        }
      }

      result.putArray("files", files)
      result.putArray("locations", locations)
      promise.resolve(result)
    } catch (error: Throwable) {
      promise.reject("SCAN_FAILED", error.message ?: error.toString())
    }
  }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode != FOLDER_PICKER_REQUEST_CODE) return

    val promise = folderPickerPromise
    val sourceApp = folderPickerSourceApp
    folderPickerPromise = null
    folderPickerSourceApp = null

    if (promise == null || sourceApp.isNullOrBlank()) return

    if (resultCode != Activity.RESULT_OK || data?.data == null) {
      promise.resolve(
        Arguments.createMap().apply {
          putBoolean("granted", false)
          putString("sourceApp", sourceApp)
        }
      )
      return
    }

    val treeUri = data.data!!
    val source = supportedSources.find { it.sourceApp == sourceApp }
    val treeUriString = treeUri.toString()
    if (source == null || !matchesExpectedSource(source, treeUriString)) {
      promise.reject(
        "INVALID_DJI_FOLDER",
        "La carpeta seleccionada no parece corresponder a ${source?.label ?: "DJI"}. Debes elegir una carpeta LOG o FlightRecord de la aplicación DJI correcta."
      )
      return
    }

    try {
      val flags =
        data.flags and
          (Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
      reactContext.contentResolver.takePersistableUriPermission(treeUri, flags)
    } catch (_: Throwable) {
    }

    prefs.edit().putString(prefKey(sourceApp), treeUri.toString()).apply()

    promise.resolve(
      Arguments.createMap().apply {
        putBoolean("granted", true)
        putString("sourceApp", sourceApp)
        putString("uri", treeUri.toString())
      }
    )
  }

  override fun onNewIntent(intent: Intent) = Unit

  private fun scanDirectDirectory(
    source: SourceDefinition,
    directory: File,
    files: com.facebook.react.bridge.WritableArray,
    emittedFingerprints: MutableSet<String>
  ) {
    directory.listFiles()?.forEach { file ->
      if (file.isDirectory) {
        scanDirectDirectory(source, file, files, emittedFingerprints)
      } else if (looksLikeFlightLog(file.name)) {
        val fingerprint = buildFingerprint(source.sourceApp, file.absolutePath, file.length(), file.lastModified())
        if (emittedFingerprints.add(fingerprint)) {
          files.pushMap(
            Arguments.createMap().apply {
              putString("id", fingerprint)
              putString("sourceApp", source.sourceApp)
              putString("sourceLabel", source.label)
              putString("name", file.name)
              putString("uri", "file://${file.absolutePath}")
              putString("path", file.absolutePath)
              putString("mimeType", mimeTypeForName(file.name))
              putDouble("size", file.length().toDouble())
              putDouble("lastModified", file.lastModified().toDouble())
              putString("ext", extensionOf(file.name))
              putString("accessMode", "direct")
            }
          )
        }
      }
    }
  }

  private fun scanTreeDirectory(
    source: SourceDefinition,
    directory: DocumentFile,
    files: com.facebook.react.bridge.WritableArray,
    emittedFingerprints: MutableSet<String>
  ) {
    directory.listFiles().forEach { child ->
      if (child.isDirectory) {
        scanTreeDirectory(source, child, files, emittedFingerprints)
      } else {
        val name = child.name ?: return@forEach
        if (!looksLikeFlightLog(name)) return@forEach

        val size = child.length()
        val lastModified = child.lastModified()
        val pathHint = child.uri.toString()
        if (!matchesExpectedSource(source, pathHint)) return@forEach
        val fingerprint = buildFingerprint(source.sourceApp, pathHint, size, lastModified)
        if (emittedFingerprints.add(fingerprint)) {
          files.pushMap(
            Arguments.createMap().apply {
              putString("id", fingerprint)
              putString("sourceApp", source.sourceApp)
              putString("sourceLabel", source.label)
              putString("name", name)
              putString("uri", child.uri.toString())
              putString("path", pathHint)
              putString("mimeType", child.type ?: mimeTypeForName(name))
              putDouble("size", size.toDouble())
              putDouble("lastModified", lastModified.toDouble())
              putString("ext", extensionOf(name))
              putString("accessMode", "tree")
            }
          )
        }
      }
    }
  }

  private fun looksLikeFlightLog(fileName: String): Boolean {
    val lower = fileName.lowercase(Locale.US)
    val ext = extensionOf(fileName)
    if (ext in ALLOWED_EXTENSIONS) return true
    return lower.contains("flightrecord") || lower.contains("fly") || lower.contains("record")
  }

  private fun extensionOf(fileName: String): String {
    val idx = fileName.lastIndexOf('.')
    return if (idx >= 0 && idx < fileName.length - 1) fileName.substring(idx + 1).lowercase(Locale.US) else ""
  }

  private fun mimeTypeForName(fileName: String): String {
    val ext = extensionOf(fileName)
    return MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext) ?: "application/octet-stream"
  }

  private fun buildFingerprint(sourceApp: String, path: String, size: Long, lastModified: Long): String {
    return "$sourceApp|$path|$size|$lastModified"
  }

  private fun matchesExpectedSource(source: SourceDefinition, value: String): Boolean {
    val lower = value.lowercase(Locale.US)
    return source.acceptedMarkers.any { marker -> lower.contains(marker.lowercase(Locale.US)) }
  }

  private fun prefKey(sourceApp: String): String = "tree_uri_$sourceApp"

  companion object {
    private const val FOLDER_PICKER_REQUEST_CODE = 30291
    private val ALLOWED_EXTENSIONS = setOf("txt", "dat", "bin", "csv", "srt", "zip", "json")
  }
}
