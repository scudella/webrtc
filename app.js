require('dotenv').config();
const path = require('path');
const { readFileSync } = require('fs');

// protocols
const https = require('https');
const websocket = require('websocket').server;

const credentials = {
  pfx: readFileSync('/etc/scudella/scudella.pfx'),
  passphrase: readFileSync('/etc/scudella/passphrase'),
};

require('express-async-errors');
// express
const express = require('express');
const app = express();

// database
const connectDB = require('./db/connect');

// other packages
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimiter = require('express-rate-limit');
const helmet = require('helmet');
const xss = require('xss-clean');
const cors = require('cors');

// routers

const authRouter = require('./routes/authRoutes');
const userRouter = require('./routes/userRoutes');

// middleware
const notFoundMiddleware = require('./middleware/not-found');
const errorHandlerMiddleware = require('./middleware/error-handler');

app.set('trust proxy', 1);
app.use(
  rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  })
);

app.use(
  helmet.contentSecurityPolicy({
    directives: {
      scriptSrc: ["'self'", 'https://unpkg.com/axios/dist/axios.min.js'],
    },
  })
);
app.use(cors());
app.use(xss());

app.use(morgan('tiny'));

// go through all middleware
app.use(express.json());
app.use(cookieParser(process.env.JWT_SECRET));

// setup static and middleware
app.use(express.static('./public'));

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', userRouter);

app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

const httpsServer = https.createServer(credentials, app);

const port = process.env.PORT || 5000;
const start = async () => {
  try {
    await connectDB(process.env.MONGO_URL);
    httpsServer.listen(
      port,
      console.log(`Server is listening on port ${port}...`)
    );
  } catch (error) {
    console.log(error);
  }
};

start();

const webrtc_clients = [];
const webrtc_discussions = {};

/*

  webrtc_signal_server.js by Rob Manson

  The MIT License

  Copyright (c) 2010-2013 Rob Manson, http://buildAR.com. All rights reserved.

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in
  all copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
  THE SOFTWARE.

*/
// web socket functions
const websocketServer = new websocket({
  httpServer: httpsServer,
  autoAcceptConnections: false,
});
websocketServer.on('request', function (request) {
  log_comment('new request (' + request.origin + ')');

  var connection = request.accept(null, request.origin);
  log_comment('new connection (' + connection.remoteAddress + ')');

  webrtc_clients.push(connection);
  connection.id = webrtc_clients.length - 1;

  connection.on('message', function (message) {
    if (message.type === 'utf8') {
      log_comment('got message ' + message.utf8Data);

      var signal = undefined;
      try {
        signal = JSON.parse(message.utf8Data);
      } catch (e) {}
      if (signal) {
        if (signal.type === 'join' && signal.token !== undefined) {
          try {
            if (webrtc_discussions[signal.token] === undefined) {
              webrtc_discussions[signal.token] = {};
            }
          } catch (e) {}
          try {
            webrtc_discussions[signal.token][connection.id] = true;
          } catch (e) {}
        } else if (signal.token !== undefined) {
          try {
            Object.keys(webrtc_discussions[signal.token]).forEach(function (
              id
            ) {
              if (id != connection.id) {
                webrtc_clients[id].send(message.utf8Data, log_error);
              }
            });
          } catch (e) {}
        } else {
          log_comment('invalid signal: ' + message.utf8Data);
        }
      } else {
        log_comment('invalid signal: ' + message.utf8Data);
      }
    }
  });

  connection.on('close', function (connection) {
    log_comment('connection closed (' + connection.remoteAddress + ')');
    Object.keys(webrtc_discussions).forEach(function (token) {
      Object.keys(webrtc_discussions[token]).forEach(function (id) {
        if (id === connection.id) {
          delete webrtc_discussions[token][id];
        }
      });
    });
  });
});

// utility functions
function log_error(error) {
  if (error !== 'Connection closed' && error !== undefined) {
    log_comment('ERROR: ' + error);
  }
}
function log_comment(comment) {
  console.log(new Date() + ' ' + comment);
}
