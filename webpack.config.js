const path = require('path');
const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
// eslint-disable-next-line import/no-extraneous-dependencies
const TerserPlugin = require('terser-webpack-plugin');
const UnminifiedWebpackPlugin = require('unminified-webpack-plugin');
// ⚠️ No requerimos filemanager-webpack-plugin aquí para evitar el ERR_REQUIRE_ESM.
// const FileManagerPlugin = require('filemanager-webpack-plugin');
const { FileOpsPlugin } = require('./build/file-ops.plugin'); // mini-plugin propio (CJS)
const { version } = require('./package.json');

const banner = `Virtual Select v${version}
https://sa-si-dev.github.io/virtual-select
Licensed under MIT (https://github.com/sa-si-dev/virtual-select/blob/master/LICENSE)`;

// Permite activar el plugin antiguo solo cuando se pide explícitamente
const useLegacyFM = process.env.USE_FILEMANAGER === '1';

module.exports = (env, options) => {
  const onStartEventOptions = {};

  if (options.mode === 'production') {
    onStartEventOptions.delete = ['dist'];
  }

  // Reutilizamos exactamente las mismas tareas de onEnd
  const fileOpsOnEnd = {
    delete: ['dist/styles.min.js', 'dist/styles.js', 'dist/virtual-select.css'],
    copy: [
      { source: 'node_modules/tooltip-plugin/dist', destination: 'docs/assets' },
      { source: 'dist', destination: 'docs/assets' },
      { source: 'dist/virtual-select.min.js', destination: `dist-archive/virtual-select-${version}.min.js` },
      { source: 'dist/virtual-select.min.css', destination: `dist-archive/virtual-select-${version}.min.css` },
    ],
  };

  const plugins = [
    new MiniCssExtractPlugin({
      filename: 'virtual-select.min.css',
    }),

    new webpack.BannerPlugin(banner),
  ];

  if (useLegacyFM) {
    // Solo se requiere si realmente se va a usar (evita evaluar 'del' ESM)
    const FileManagerPlugin = require('filemanager-webpack-plugin');
    plugins.push(
      new FileManagerPlugin({
        events: {
          onStart: onStartEventOptions,
          onEnd: fileOpsOnEnd,
        },
      }),
    );
  } else {
    // ✅ Mini-plugin propio (sin dependencias ESM problemáticas)
    plugins.push(
      new FileOpsPlugin({
        version,
        onStart: onStartEventOptions,
        onEnd: fileOpsOnEnd,
      }),
    );
  }

  const config = {
    target: 'es5',

    entry: {
      styles: ['./src/styles.js', './node_modules/popover-plugin/dist/popover.min.css'],
      'virtual-select': ['./src/virtual-select-Ext.js', './node_modules/popover-plugin/dist/popover.min.js'],
    },

    output: {
      filename: '[name].min.js',
      path: path.resolve(__dirname, 'dist'),
      chunkFormat: 'array-push',
    },

    plugins,

    optimization: {
      minimize: true,
      minimizer: [
        new TerserPlugin({
          extractComments: false,
        }),
        new UnminifiedWebpackPlugin(),
      ],
    },

    module: {
      rules: [
        {
          test: /\.scss$/,
          exclude: /(node_modules)/,
          use: [MiniCssExtractPlugin.loader, 'css-loader', 'postcss-loader', 'sass-loader'],
        },
        {
          test: /\.css$/,
          use: [MiniCssExtractPlugin.loader, 'css-loader'],
        },
        {
          test: /\.m?js$/,
          exclude: /(node_modules|bower_components)/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env'],
            },
          },
        },
      ],
    },
  };

  if (options.mode === 'development') {
    config.devtool = 'source-map';
  }

  return config;
};
