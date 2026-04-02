/**
 * Fusionne app.json et injecte les clés Google Maps (react-native-maps).
 * Ajoutez EXPO_PUBLIC_GOOGLE_MAPS_API_KEY dans .env puis rebuild : npx expo run:android
 *
 * Important : le plugin `withGoogleMapsApiKey` supprime la balise manifest si apiKey est vide.
 * On ne l’enregistre donc que lorsque la clé est définie (sinon build sans .env n’efface pas une meta-data manuelle).
 */
const { AndroidConfig, IOSConfig } = require('expo/config-plugins');

module.exports = ({ config }) => {
  const mapsKey = (process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '').trim();

  const plugins = [...(config.plugins ?? [])];
  if (mapsKey) {
    plugins.push(AndroidConfig.GoogleMapsApiKey.withGoogleMapsApiKey, IOSConfig.Maps.withMaps);
  } else {
    console.warn(
      '[AirGo] EXPO_PUBLIC_GOOGLE_MAPS_API_KEY manquante ou vide : ajoute-la dans .env puis `npx expo prebuild --platform android` (ou iOS) avant un build natif, sinon Google Maps plante au lancement.',
    );
  }

  return {
    ...config,
    android: {
      ...config.android,
      config: {
        ...config.android?.config,
        ...(mapsKey ? { googleMaps: { apiKey: mapsKey } } : {}),
      },
    },
    ios: {
      ...config.ios,
      config: {
        ...config.ios?.config,
        ...(mapsKey ? { googleMapsApiKey: mapsKey } : {}),
      },
    },
    plugins,
  };
};
