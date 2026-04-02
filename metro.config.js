const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

if (!config.resolver.assetExts.includes('asc')) {
  config.resolver.assetExts.push('asc');
}

module.exports = config;
