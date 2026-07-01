// @rnmapbox/maps native SDK download: secret sk.… with DOWNLOADS:READ (Gradle/CocoaPods).
// Keep MAPBOX_DOWNLOAD_TOKEN in .env per app. Runtime maps: EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN (public pk.…).

// @rnmapbox/maps reads RNMAPBOX_MAPS_DOWNLOAD_TOKEN from the environment at native build time.
if (!process.env.RNMAPBOX_MAPS_DOWNLOAD_TOKEN && process.env.MAPBOX_DOWNLOAD_TOKEN) {
  process.env.RNMAPBOX_MAPS_DOWNLOAD_TOKEN = process.env.MAPBOX_DOWNLOAD_TOKEN;
}

module.exports = ({ config }) => {
  return {
    ...config,
    plugins: [
      ...(config.plugins?.filter(
        (p) => !(Array.isArray(p) && p[0] === '@rnmapbox/maps'),
      ) ?? []),
      [
        '@rnmapbox/maps',
        {
          RNMapboxMapsImpl: 'mapbox',
        },
      ],
    ],
  };
};
