const webpack = require('webpack');
const merge = require('webpack-merge');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const common = require('./webpack.common.js');
const ExtractTextPlugin = require('extract-text-webpack-plugin');

common.module.rules.push({
  test: /\.(scss|css)$/,
  use: ExtractTextPlugin.extract({
    fallback: 'style-loader',
    use: 'css-loader?!sass-loader',
  }),
});

module.exports = merge(common, {
  devtool: 'cheap-module-source-map',
  plugins: [
    new webpack.optimize.CommonsChunkPlugin({
      name: 'vendors',
      minChunks(module) {
        if (module.resource && (/^.*\.(css|scss)$/).test(module.resource)) {
          return false;
        }
        return module.context && module.context.indexOf('node_modules') !== -1;
      },
    }),
    new webpack.HashedModuleIdsPlugin(),
    new CleanWebpackPlugin(['dist']),
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify('production'),
      },
    }),
  ],
});
