// @rnmapbox/maps only writes MAPBOX_DOWNLOADS_TOKEN into gradle.properties when you pass
// RNMapboxMapsDownloadToken (plugin option). A top-level RNMAPBOX_MAPS_DOWNLOAD_TOKEN *key*
// in the plugin object is ignored — that name is only read by Gradle via process env as fallback.
const downloadToken =
  process.env.RNMAPBOX_MAPS_DOWNLOAD_TOKEN ?? process.env.MAPBOX_DOWNLOAD_TOKEN ?? '';

module.exports = ({ config }) => {
  return {
    ...config,
    plugins: [
      ...(config.plugins?.filter(
        (p) => !(Array.isArray(p) && p[0] === '@rnmapbox/maps')
      ) ?? []),
      [
        '@rnmapbox/maps',
        {
          RNMapboxMapsImpl: 'mapbox',
          RNMapboxMapsDownloadToken: downloadToken,
        },
      ],
    ],
  };
};
