/**
 * Fusionne app.json et injecte les clés Google Maps (react-native-maps).
 * Ajoutez EXPO_PUBLIC_GOOGLE_MAPS_API_KEY dans .env puis rebuild : npx expo run:android
 */
module.exports = ({ config }) => {
  const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

  return {
    ...config,
    android: {
      ...config.android,
      config: {
        ...config.android?.config,
        googleMaps: {
          apiKey: mapsKey,
        },
      },
    },
    ios: {
      ...config.ios,
      config: {
        ...config.ios?.config,
        googleMapsApiKey: mapsKey,
      },
    },
  };
};
