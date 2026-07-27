const fs = require("fs");
const path = require("path");
const { AndroidConfig, withAndroidManifest, withAppBuildGradle, withDangerousMod, withProjectBuildGradle } = require("expo/config-plugins");

const DJI_MAVEN = "maven { url 'https://developer.dji.com/repo/' }";
const DJI_SDK_DEP = 'implementation("com.dji:dji-sdk:4.16.4")';
const DJI_PROVIDED_DEP = 'compileOnly("com.dji:dji-sdk-provided:4.16.4")';

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function addPermission(manifest, name) {
  const permissions = ensureArray(manifest.manifest["uses-permission"]);
  const exists = permissions.some((p) => p?.$?.["android:name"] === name);
  if (!exists) permissions.push({ $: { "android:name": name } });
  manifest.manifest["uses-permission"] = permissions;
}

function addFeature(manifest, name) {
  const features = ensureArray(manifest.manifest["uses-feature"]);
  const exists = features.some((f) => f?.$?.["android:name"] === name);
  if (!exists) {
    features.push({
      $: {
        "android:name": name,
        "android:required": "false",
      },
    });
  }
  manifest.manifest["uses-feature"] = features;
}

function addMetaData(target, name, attrs) {
  const meta = ensureArray(target["meta-data"]);
  const exists = meta.some((m) => m?.$?.["android:name"] === name);
  if (!exists) {
    meta.push({ $: { "android:name": name, ...attrs } });
  }
  target["meta-data"] = meta;
}

function addUsbIntent(activity) {
  const filters = ensureArray(activity["intent-filter"]);
  const exists = filters.some((filter) =>
    ensureArray(filter.action).some((a) => a?.$?.["android:name"] === "android.hardware.usb.action.USB_ACCESSORY_ATTACHED")
  );
  if (!exists) {
    filters.push({
      action: [{ $: { "android:name": "android.hardware.usb.action.USB_ACCESSORY_ATTACHED" } }],
    });
  }
  activity["intent-filter"] = filters;
}

module.exports = function withDJITelemetry(config) {
  config = withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults;
    addPermission(manifest, "android.permission.WAKE_LOCK");
    addPermission(manifest, "android.permission.BLUETOOTH");
    addPermission(manifest, "android.permission.BLUETOOTH_ADMIN");
    addFeature(manifest, "android.hardware.usb.accessory");
    addFeature(manifest, "android.hardware.usb.host");

    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    addMetaData(app, "com.dji.sdk.API_KEY", { "android:value": "${DJI_API_KEY}" });

    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(manifest);
    addUsbIntent(activity);
    addMetaData(activity, "android.hardware.usb.action.USB_ACCESSORY_ATTACHED", {
      "android:resource": "@xml/dji_usb_accessory_filter",
    });
    return mod;
  });

  config = withProjectBuildGradle(config, (mod) => {
    if (!mod.modResults.contents.includes(DJI_MAVEN)) {
      mod.modResults.contents = mod.modResults.contents.replace(
        /mavenCentral\(\)/,
        `mavenCentral()\n    ${DJI_MAVEN}`
      );
    }
    return mod;
  });

  config = withAppBuildGradle(config, (mod) => {
    if (!mod.modResults.contents.includes("DJI_API_KEY:")) {
      mod.modResults.contents = mod.modResults.contents.replace(
        /buildConfigField "String", "REACT_NATIVE_RELEASE_LEVEL", ".*"\n/,
        (match) =>
          `${match}        manifestPlaceholders = [\n            DJI_API_KEY: findProperty("DJI_API_KEY") ?: System.getenv("DJI_API_KEY") ?: ""\n        ]\n`
      );
    }
    if (!mod.modResults.contents.includes(DJI_SDK_DEP)) {
      mod.modResults.contents = mod.modResults.contents.replace(
        /implementation\("com.facebook.react:react-android"\)/,
        `implementation("com.facebook.react:react-android")\n    ${DJI_SDK_DEP}\n    ${DJI_PROVIDED_DEP}`
      );
    }
    return mod;
  });

  config = withDangerousMod(config, [
    "android",
    (mod) => {
      const xmlDir = path.join(mod.modRequest.platformProjectRoot, "app", "src", "main", "res", "xml");
      fs.mkdirSync(xmlDir, { recursive: true });
      const xmlPath = path.join(xmlDir, "dji_usb_accessory_filter.xml");
      if (!fs.existsSync(xmlPath)) {
        fs.writeFileSync(
          xmlPath,
          '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n  <usb-accessory vendor-id="11427" />\n</resources>\n'
        );
      }
      return mod;
    },
  ]);

  return config;
};
