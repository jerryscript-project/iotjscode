const webpack = require('webpack');
const path = require('path');

const CopyWebpackPlugin = require('copy-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CleanWebpackPlugin = require('clean-webpack-plugin');

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
  new CleanWebpackPlugin(['dist']),
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
    test: /\.woff(2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
    use: [{
      loader: 'url-loader',
      options: {
        name: 'fonts/[hash].[ext]',
      },
    }],
  }, {
    test: /\.(eot|ttf|otf)(\?v=[0-9]\.[0-9]\.[0-9])?$/,
    use: [{
      loader: 'file-loader',
      options: {
        name: 'fonts/[hash].[ext]',
      },
    }],
  },
  {
    test: /\.(scss|css)$/,
    use: ExtractTextPlugin.extract({
      fallback: 'style-loader',
      use: 'css-loader!sass-loader',
    }),
  },
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
    loader: 'ejs-compiled-loader',
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
    chunkFilename: 'js/[name].bundle.js',
    publicPath: '/',
  },
  module: {
    rules,
  },
  plugins,
  resolve,
  node: {
    fs: 'empty',
  },
};

module.exports = config;
