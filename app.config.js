const googleMapsAndroidApiKey = String(
  process.env.GOOGLE_MAPS_ANDROID_API_KEY || process.env.GOOGLE_MAPS_API_KEY || ""
).trim();
const googleMapsIosApiKey = String(
  process.env.GOOGLE_MAPS_IOS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || ""
).trim();

module.exports = ({ config }) => ({
    ...config,
    android: {
      ...config.android,
      config: {
        ...(config.android?.config || {}),
        googleMaps: { apiKey: googleMapsAndroidApiKey },
      },
    },
    ios: {
      ...config.ios,
      config: {
        ...(config.ios?.config || {}),
        googleMapsApiKey: googleMapsIosApiKey,
      },
    },
});
