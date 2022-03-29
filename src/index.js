/*  Copyright (c) 2022 Eduardo S. Libardi, All rights reserved. 

Permission to use, copy, modify, and/or distribute this software for any purpose with or 
without fee is hereby granted, provided that the above copyright notice and this permission 
notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS 
SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL 
THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES 
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, 
NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE 
OF THIS SOFTWARE. */

// For http uncomment the following line and comment out the next
// const http = require('http');
const https = require('https');
const { readFile } = require('fs').promises;
const { readFileSync } = require('fs');
var websocket = require('websocket').server;
const path = require('path');

// For http comment out the following lines (options)
const options = {
  // key: readFileSync('../openssl/key.pem', 'utf8'),
  // cert: readFileSync('../openssl/cert.pem', 'utf8'),
  // passphrase: readFileSync('../openssl/passphrase', 'utf8'),
  pfx: readFileSync('/etc/scudella/scudella.pfx'),
  passphrase: readFileSync('/etc/scudella/passphrase'),
};
const port = 5000;
let webrtc_clients = [];
let webrtc_discussions = {};
let filePath = '';

// For http uncomment the following line and comment out the next one
// const http_server = http.createServer();
const http_server = https.createServer(options);

http_server.on('request', (request, response) => {
  let matches = undefined;

  if ((matches = request.url.match('^/images/(.*)'))) {
    filePath = path.join(__dirname, '/images/', matches[1]);
    let imageExtension = request.url.match('svg');
    if (imageExtension && imageExtension[0] === 'svg') {
      response.writeHead(200, { 'content-type': 'image/svg+xml' });
    }
    readFiles(filePath, response);
  } else if (request.url === '/' || request.url === '/index.html') {
    response.writeHead(200, { 'content-type': 'text/html' });
    readhtml(response);
  } else if (request.url === '/settings.html') {
    response.writeHead(200, { 'content-type': 'text/html' });
    readsettings(response);
  } else if (request.url === '/app.html') {
    response.writeHead(200, { 'content-type': 'text/html' });
    readApp(response);
  } else if ((matches = request.url.match('^/video/(.*)'))) {
    filePath = path.join(__dirname, '/video/', matches[1]);
    let matchExtension = request.url.match('vtt');
    if (matchExtension && matchExtension[0] === 'vtt') {
      response.writeHead(200, { 'content-type': 'text/vtt' });
    }
    readFiles(filePath, response);
  } else if ((matches = request.url.match('^/js/(.*)'))) {
    filePath = path.join(__dirname, '/js/', matches[1]);
    response.writeHead(200, { 'content-type': 'text/javascript' });
    readFiles(filePath, response);
  } else if ((matches = request.url.match('^/css/(.*)'))) {
    filePath = path.join(__dirname, '/css/', matches[1]);
    response.writeHead(200, { 'content-type': 'text/css' });
    readFiles(filePath, response);
  } else if ((matches = request.url.match('^/favicon.ico'))) {
    filePath = path.join(__dirname, '/favicon.ico');
    readFiles(filePath, response);
  }
});

http_server.listen(port, () => {
  log_comment(`Server is listening at port ${port}`);
});

const readFiles = async (path, response) => {
  try {
    const file = await readFile(path);
    response.end(file);
  } catch (error) {
    log_error(error);
  }
};

const readhtml = async (response) => {
  try {
    const page = await readFile('./src/index.html', 'utf8');
    response.end(page);
  } catch (error) {
    log_error(error);
  }
};

const readsettings = async (response) => {
  try {
    const page = await readFile('./src/settings.html', 'utf8');
    response.end(page);
  } catch (error) {
    log_error(error);
  }
};
const readApp = async (response) => {
  try {
    const page = await readFile('./src/app.html', 'utf8');
    response.end(page);
  } catch (error) {
    log_error(error);
  }
};

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
var websocket_server = new websocket({
  httpServer: http_server,
});
websocket_server.on('request', function (request) {
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
