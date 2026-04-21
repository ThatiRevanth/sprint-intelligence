import { resolve as _resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import CopyWebpackPlugin from 'copy-webpack-plugin';

const __dirname = dirname(fileURLToPath(import.meta.url));

const entries = {
  hub: './src/main.ts',
  'widget-risk': './src/widgets/risk-widget.ts',
  'widget-blockers': './src/widgets/blockers-widget.ts',
  'widget-pr': './src/widgets/pr-widget.ts',
  'widget-workload': './src/widgets/workload-widget.ts',
  'widget-summary': './src/widgets/summary-widget.ts',
};

const webpack = (env, argv) => {
  const isProd = argv.mode === 'production';

  const htmlPages = Object.keys(entries).map(
    (name) =>
      new HtmlWebpackPlugin({
        template: `./src/${name}.html`,
        filename: `${name}.html`,
        chunks: ['runtime', 'vendors', 'common', name],
        minify: isProd && {
          collapseWhitespace: true,
          removeComments: true,
        },
      })
  );

  return {
    entry: entries,

    output: {
      path: _resolve(__dirname, 'out'),
      filename: isProd ? '[name].[contenthash].js' : '[name].js',
      chunkFilename: isProd ? '[name].[contenthash].js' : '[name].js',
      clean: true,
    },

    resolve: {
      extensions: ['.ts', '.js'],
      alias: {
        '@core': _resolve(__dirname, 'src/app/core'),
        '@features': _resolve(__dirname, 'src/app/features'),
        // Force single SDK instance — the API package also AMD-requires the SDK,
        // and without this alias webpack can create two module instances causing
        // the "SDK already loaded" guard to fire and break init().
        'azure-devops-extension-sdk': _resolve(__dirname, 'node_modules/azure-devops-extension-sdk/SDK.js'),
      },
    },

    module: {
      rules: [
        {
          test: /\.ts$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },

        // Inline component templates
        {
          test: /\.component\.html$/,
          type: 'asset/source',
        },

        // Inline component styles
        {
          test: /\.component\.scss$/,
          use: [
            {
              loader: 'css-loader',
              options: { exportType: 'string', esModule: false },
            },
            'sass-loader',
          ],
        },

        // Global styles
        {
          test: /\.scss$/,
          exclude: /\.component\.scss$/,
          use: [
            isProd ? MiniCssExtractPlugin.loader : 'style-loader',
            {
              loader: 'css-loader',
              options: { sourceMap: !isProd },
            },
            'sass-loader',
          ],
        },

        {
          test: /\.css$/,
          use: [
            isProd ? MiniCssExtractPlugin.loader : 'style-loader',
            'css-loader',
          ],
        },
      ],
    },

    optimization: {
      runtimeChunk: 'single', // ✅ shared runtime

      splitChunks: {
        chunks: 'all',
        maxInitialRequests: 10,
        cacheGroups: {
          vendors: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            priority: 10,
          },

          // 🟢 Shared internal code across widgets
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'all',
            priority: 5,
            reuseExistingChunk: true,
          },
        },
      },
    },

    plugins: [
      ...htmlPages,

      new MiniCssExtractPlugin({
        filename: isProd ? '[name].[contenthash].css' : '[name].css',
      }),

      new CopyWebpackPlugin({
        patterns: [
          { from: 'images', to: '../images', noErrorOnMissing: true },
        ],
      }),
    ],

    devServer: {
      port: 3000,
      server: 'https',
      static: './out',
      allowedHosts: 'all',
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      historyApiFallback: {
        rewrites: [{ from: /^\/$/, to: '/hub.html' }],
      },
      hot: true,
    },

    devtool: isProd ? false : 'eval-cheap-module-source-map',

    stats: 'minimal',
  };
};

export default webpack;