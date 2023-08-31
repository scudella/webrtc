const path = require('path');
// const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: {
    '/': './src/start.ts',
    login: './src/login.ts',
    meeting: './src/meeting.ts',
    app: './src/webrtc.ts',
    forgot: './src/forgot.ts',
    register: './src/register.ts',
    reset: './src/reset.ts',
    verify: './src/verify.ts',
  },
  // plugins: [
  //   new HtmlWebpackPlugin({
  //     title: 'Production',
  //   }),
  // ],
  output: {
    filename: '[name]_bundle.js',
    path: path.resolve(__dirname, 'public/js'),
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
};
