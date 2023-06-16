const path = require('path');

module.exports = {
  mode: 'development',
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
  output: {
    filename: '[name]_bundle.js',
    path: path.resolve(__dirname, 'public/js'),
  },
  devtool: 'inline-source-map',
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
