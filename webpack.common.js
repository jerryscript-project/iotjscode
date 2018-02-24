const webpack = require('webpack');
const path = require('path');

const CopyWebpackPlugin = require('copy-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const source_path = path.resolve(__dirname, 'src');
const build_path = path.resolve(__dirname, 'dist');
const module_path = path.resolve(__dirname, 'node_modules');

const html_title = 'IoT.JS Code';
const monaco_editor_path = 'monaco-editor/min/vs';

const resolve = {
  alias: {
    c3$: 'c3/c3.min',
    d3$: 'd3/d3.min',
    vs: monaco_editor_path,
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
      from: `${module_path}/${monaco_editor_path}`,
      to: `${build_path}/vs`,
    },
  ]),
  new ExtractTextPlugin('css/[name].css'),
];

const rules = [
  {
    test: /\.(png|svg|jpg|gif)$/,
    use: [{
      loader: 'file-loader',
      options: {
        name: 'images/[hash].[ext]',
      },
    },
  ]},
  {
    test: /\.(woff|woff2|eot|ttf|otf)$/,
    use: [{
      loader: 'file-loader',
      options: {
        name: 'fonts/[hash].[ext]',
      },
    },
  ]},
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
    filename: 'js/[name].[chunkhash].bundle.js',
  },
  module: {
    rules,
  },
  plugins,
  resolve,
};

module.exports = config;
