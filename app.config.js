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
          RNMAPBOX_MAPS_DOWNLOAD_TOKEN: process.env.RNMAPBOX_MAPS_DOWNLOAD_TOKEN ?? '',
        },
      ],
    ],
  };
};
