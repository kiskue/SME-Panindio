const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Metro doesn't include .cjs in sourceExts by default; some npm packages
// (e.g. libphonenumber-js) ship CJS bundles with that extension.
config.resolver.sourceExts = [
  ...(config.resolver.sourceExts ?? []),
  'cjs',
];

// react-native-qrcode-svg uses the `qrcode` npm package which has a `browser`
// field that remaps its entry point. Metro applies that mapping package-wide,
// which breaks internal require() calls inside qrcode/lib/core/*.js on some
// Metro versions. The workaround: intercept those intra-package requires and
// resolve them by path directly, bypassing the browser-field lookup.
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const origin = context.originModulePath.replace(/\\/g, '/');
  if (
    moduleName.startsWith('./') &&
    origin.includes('node_modules/qrcode/lib/')
  ) {
    const suffix = moduleName.endsWith('.js') ? '' : '.js';
    const resolved = path.resolve(path.dirname(context.originModulePath), moduleName + suffix);
    return { filePath: resolved, type: 'sourceFile' };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
