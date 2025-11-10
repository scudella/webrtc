import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const config = {
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
        use: {
          loader: 'ts-loader',
          options: {
            configFile: 'tsconfig.frontend.json', // <-- Use the dedicated frontend file
          },
        },
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
};

export default config;
