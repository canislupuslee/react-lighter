const webpack = require('webpack')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const CleanWebpackPlugin = require('clean-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const PurifycssWebpack = require('purifycss-webpack')
const PurgecssPlugin = require('purgecss-webpack-plugin') // 去除没引用到的样式，必须在 html-webpack-plugin 后引用
const glob = require('glob-all') // require('glob')
const AddAssetHtmlPlugin = require('add-asset-html-webpack-plugin')
const HappyPack = require('happypack')
const os = require('os')
const { resolve } = require('./utils')

const happyThreadPool = HappyPack.ThreadPool({ size: os.cpus().length }) // 根据系统的内核数量指定线程池个数

module.exports = ({
  entryDir,
  entryFile,
  outputPath,
  templateFile,
  templateTitle,
  author,
  cssPath,
  purifycssFile,
  useCssExtract,
  assetsPath,
  copyConfig,
  dllFiles
}) => {
  const env = process.env.NODE_ENV
  const isDevMode = env === 'development'
  const dllWebpack = require(resolve(`${outputPath}/react.manifest.json`))
  const assetOptions = {
    limit: 10240,
    name: `${assetsPath}/[name].[ext]`,
    publicPath: '../'
  }

  const plugins = [
    new HtmlWebpackPlugin({
      template: resolve(templateFile),
      filename: 'index.html',
      title: templateTitle,
      minify: isDevMode
        ? null
        : {
          removeAttributeQuotes: true,
          collapseWhitespace: true
        }
      // favicon: './favicon.ico',
    }),
    new webpack.BannerPlugin(`created by ${author}`),
    new webpack.DllReferencePlugin({
      manifest: dllWebpack
    }),
    new AddAssetHtmlPlugin({
      filepath: resolve(`${outputPath}/*.dll.js`),
      includeSourcemap: false
    }),
    new MiniCssExtractPlugin({
      filename: `${cssPath}/[name].[hash:8].css`
      // chunkFilename: "[id].css"
    }),
    new PurgecssPlugin({
      paths: glob.sync(purifycssFile.map(url => resolve(url)), { nodir: true })
    }),
    // new PurifycssWebpack({
    //   paths: glob.sync(purifycssFile.map(url => resolve(url))),
    //   minimize: true
    // }),
    new HappyPack({
      id: 'babel', // loader 中指定的 id
      loaders: ['babel-loader?cacheDirectory'], // 实际匹配处理的 loader
      threadPool: happyThreadPool,
      verbose: true
    }),
    new webpack.SourceMapDevToolPlugin({
      filename: '[file].map'
    })
  ]

  if (!isDevMode) {
    plugins.push(
      new CleanWebpackPlugin([resolve(outputPath)], {
        root: process.cwd(),
        exclude: dllFiles
      })
    )
  }

  if (copyConfig.needsCopy) {
    plugins.push(
      new CopyWebpackPlugin([
        {
          from: resolve(copyConfig.fromPath),
          to: resolve(copyConfig.toPath) // 找到 dist 目录下的 docs，并放进去
        }
      ])
    )
  }

  const baseConfig = {
    entry: ['@babel/polyfill', resolve(entryFile)],
    output: {
      filename: '[name].[hash:8].js',
      path: resolve(outputPath)
    },
    mode: env,
    devtool: isDevMode
      ? 'cheap-module-eval-source-map'
      : 'cheap-module-source-map',
    module: {
      rules: [
        {
          test: /\.(js|jsx)$/,
          enforce: 'pre',
          use: {
            loader: 'eslint-loader'
          },
          exclude: /node_modules/
        },
        {
          test: /(\.js|\.jsx)$/,
          use: ['happypack/loader?id=babel'],
          exclude: /node_modules/,
          include: resolve(entryDir)
        },
        {
          test: /\.css$/,
          use: [
            useCssExtract ? MiniCssExtractPlugin.loader : 'style-loader',
            'css-loader',
            'postcss-loader'
          ]
        },
        {
          test: /\.less$/,
          use: [
            useCssExtract ? MiniCssExtractPlugin.loader : 'style-loader',
            'css-loader',
            'postcss-loader',
            {
              loader: 'less-loader',
              options: {
                javascriptEnabled: true,
                sourceMap: true
              }
            }
          ]
        },
        {
          test: /\.scss$/,
          use: [
            useCssExtract ? MiniCssExtractPlugin.loader : 'style-loader',
            'css-loader',
            'postcss-loader',
            {
              loader: 'scss-loader',
              options: {
                javascriptEnabled: true,
                sourceMap: true
              }
            }
          ]
        },
        {
          test: /\.svg(\?v=\d+\.\d+\.\d+)?$/,
          loader: 'url-loader',
          options: Object.assign({}, assetOptions, {
            minetype: 'image/svg+xml'
          })
        },
        {
          test: /\.(png|jpg|jpeg|gif)(\?v=\d+\.\d+\.\d+)?$/i,
          loader: 'url-loader',
          options: assetOptions
        },
        {
          test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
          loader: 'url-loader',
          options: assetOptions
        }
      ]
      // 'noParse': /jquery/
    },
    resolve: {
      extensions: ['.js', '.jsx', '.css', '.less', 'scss'],
      modules: [resolve(entryDir), resolve('node_modules')],
      alias: {}
    },
    optimization: {
      splitChunks: {
        cacheGroups: {
          commons: {
            name: 'common',
            chunks: 'initial',
            minChunks: 2,
            maxInitialRequests: 5,
            minSize: 0
          },
          vendor: {
            test: /node_modules/,
            chunks: 'initial',
            name: 'vendor',
            priority: 10, // 优先
            enforce: true
          },
          styles: {
            name: 'styles',
            test: /\.css$/,
            chunks: 'all',
            enforce: true
          }
        }
      },
      runtimeChunk: {
        name: 'runtime'
      }
    }
  }

  return Object.assign(baseConfig, { plugins })
}
