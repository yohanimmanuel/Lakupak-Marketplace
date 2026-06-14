// @rnmapbox/maps native SDK download: secret sk.… with DOWNLOADS:READ (Gradle/CocoaPods).
// Runtime maps + geocoding: EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN (public pk.…).
const mapboxDownloadToken =
  process.env.RNMAPBOX_MAPS_DOWNLOAD_TOKEN ??
  process.env.MAPBOX_DOWNLOAD_TOKEN ??
  '';

module.exports = ({ config }) => {
  return {
    ...config,
    plugins: [
      ...(config.plugins?.filter(
        (p) => !(Array.isArray(p) && p[0] === '@rnmapbox/maps'),
      ) ?? []),
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'Allow Laku to use your location to show a more accurate map for your address.',
        },
      ],
      [
        '@rnmapbox/maps',
        {
          RNMapboxMapsImpl: 'mapbox',
          RNMapboxMapsDownloadToken: mapboxDownloadToken,
        },
      ],
    ],
  };
};
