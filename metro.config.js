const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Keep Expo/Metro stable on Windows when launched through `expo run:android`.
config.maxWorkers = 1;

// Gradle creates thousands of directories that Metro does not need to watch.
// Ignoring only generated Android output prevents the Windows fallback watcher
// from timing out while keeping native source files visible to Metro.
config.resolver.blockList = [
  ...config.resolver.blockList,
  /android[\\/](?:\.gradle|build)(?:[\\/].*)?$/,
  /android[\\/]app[\\/]build(?:[\\/].*)?$/,
];

module.exports = config;
