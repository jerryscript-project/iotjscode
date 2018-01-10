const webpack = require('webpack');
const path = require('path');

const CopyWebpackPlugin = require('copy-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const source_path = path.resolve(__dirname, 'src');
const build_path = path.resolve(__dirname, 'dist');
const module_path = path.resolve(__dirname, 'node_modules');

const html_title = 'IoT.JS Code';
const ace_editor_path = 'ace-builds/src-min-noconflict';

const resolve = {
  alias: {
    c3$: 'c3/c3.min',
    d3$: 'd3/d3.min',
    ace: ace_editor_path,
    jquery$: 'jquery/src/jquery',
    jqueryui$: 'jquery-ui-dist/jquery-ui.min',
    thead$: 'floatthead',
    filesaver$: 'file-saver/FileSaver.min',
    bootstrap$: 'bootstrap/dist/js/bootstrap.min',
  },
};

const plugins = [
  new HtmlWebpackPlugin({
    template: `${source_path}/index.ejs`,
    title: html_title,
  }),
  new webpack.ProvidePlugin({
    $: 'jquery',
  }),
  new CopyWebpackPlugin([
    {
      from: `${module_path}/${ace_editor_path}`,
      to: `${build_path}/ace`,
    },
  ]),
  new ExtractTextPlugin('[name].css'),
];

const rules = [
  { test: /\.(png|svg|jpg|gif)$/, use: ['file-loader'] },
  { test: /\.(woff|woff2|eot|ttf|otf)$/, use: ['file-loader'] },
  {
    test: /\.js$/,
    exclude: /(node_modules)/,
    use: {
      loader: 'babel-loader',
      options: {
        presets: ['env'],
      },
    },
  },
  {
    test: /\.ejs$/,
    loader: 'ejs-render-loader',
  },
];

const config = {
  context: source_path,
  entry: {
    app: './index.js',
  },
  output: {
    path: build_path,
    filename: '[name].[chunkhash].bundle.js',
  },
  module: {
    rules,
  },
  plugins,
  resolve,
};

module.exports = config;
