module.exports = function (api) {
  api.cache(true);

  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // react-native-reanimated 4.x delegates its worklet transforms to
      // react-native-worklets. This plugin MUST remain the last entry so
      // it runs after all other transforms have already been applied.
      'react-native-worklets/plugin',
    ],
  };
};
