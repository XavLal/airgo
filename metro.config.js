const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const { assetExts, sourceExts } = config.resolver;

for (const ext of ['asc', 'db']) {
  if (!assetExts.includes(ext)) {
    assetExts.push(ext);
  }
}

config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer/expo'),
};

config.resolver.assetExts = assetExts.filter((ext) => ext !== 'svg');
config.resolver.sourceExts = [...sourceExts, 'svg'];

module.exports = config;
