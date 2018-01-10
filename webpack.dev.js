const webpack = require('webpack');
const merge = require('webpack-merge');
const common = require('./webpack.common.js');
const ExtractTextPlugin = require('extract-text-webpack-plugin');

common.module.rules.push({
  test: /\.(scss|css)$/,
  use: ExtractTextPlugin.extract({
    fallback: 'style-loader',
    use: 'css-loader?sourceMap!sass-loader?sourceMap',
  }),
});

module.exports = merge(common, {
  devtool: 'inline-source-map',
  output: {
    pathinfo: true,
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify('development'),
      },
      __DEV__: true,
    }),
  ],
});
