const path = require('path');
const Repack = require('@callstack/repack');

/**
 * Rspack configuration for RemoteApp federated module
 * @type {import('@callstack/repack').RepackRspackConfigFn}
 */
module.exports = env => {
  const {
    mode = 'development',
    context = __dirname,
    platform = process.env.PLATFORM || 'ios',
    minimize = mode === 'production',
    devServer = undefined,
  } = env;

  if (!platform) {
    throw new Error('Missing platform');
  }

  return {
    mode,
    context,
    entry: './index.js',
    resolve: {
      ...Repack.getResolveOptions(platform, { enablePackageExports: true }),
    },
    output: {
      path: '[context]/build/swap/[platform]',
      uniqueName: 'swap',
    },
    optimization: {
      minimize,
      chunkIds: 'named',
    },
    module: {
      rules: [
        // RN 0.81 ships Flow Component Syntax (`component View(...)`) and Flow
        // enums in react-native sources. Re.Pack's flow-loader (flow-remove-types)
        // can only strip type annotations, not these constructs, so SWC fails to
        // parse them. Run @react-native/babel-preset via Re.Pack's babel-loader
        // (which uses hermes-parser) on RN packages first so SWC sees plain JS.
        {
          test: /\.jsx?$/,
          include: Repack.getModulePaths(['react-native', '@react-native']),
          enforce: 'pre',
          use: {
            loader: '@callstack/repack/babel-loader',
            options: {
              presets: [require.resolve('@react-native/babel-preset')],
            },
          },
        },
        ...Repack.getJsTransformRules({
          swc: {
            externalHelpers: false,
            jsxRuntime: 'automatic',
          },
          flow: {
            enabled: false,
          },
          codegen: {
            enabled: true,
          },
        }),
        ...Repack.getAssetTransformRules(),
      ],
    },
    plugins: [
      new Repack.RepackPlugin({
        context,
        mode,
        platform,
        devServer,
        extraChunks: [
          {
            include: /.*/,
            type: 'remote',
            outputPath: `build/swap/${platform}/output-remote`,
          },
        ],
      }),
      new Repack.plugins.ModuleFederationPluginV2({
        name: 'swap',
        filename: 'swap.container.js.bundle',
        exposes: {
          './HelloWorld': './src/HelloWorld',
        },
        dts: false,
        shared: {
          react: {
            singleton: true,
            requiredVersion: '19.1.4',
          },
          'react-native': {
            singleton: true,
            requiredVersion: '0.81.6',
          },
          'react-redux': {
            singleton: true,
            eager: false,
            requiredVersion: '9.2.0',
          },
          '@reduxjs/toolkit': {
            singleton: true,
            eager: false,
            requiredVersion: '2.11.2',
          },
          '@shared/mobile-host-runtime': {
            singleton: true,
            eager: false,
            requiredVersion: '0.1.0',
          },
        },
      }),
    ],
    devServer: {
      port: 9000,
    },
  };
};
