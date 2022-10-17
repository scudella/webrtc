const { logError, logComment } = require('../utils');

const webrtcClients = [];
const webrtcRooms = {};

const signalRequest = (req) => {
  logComment(`new request ( ${req.origin} )`);

  const connection = req.accept(null, req.origin);
  logComment(`new connection ( ${connection.remoteAddress} )`);

  webrtcClients.push(connection);
  connection.id = webrtcClients.length - 1;

  connection.on('message', (evt) => callSetup(connection, evt));

  connection.on('close', (evt) => connectionClosed(connection, evt));
};

const callSetup = (connection, message) => {
  if (message.type === 'utf8') {
    logComment(`got message ${message.utf8Data}`);

    let signal = undefined;
    try {
      signal = JSON.parse(message.utf8Data);
    } catch (evt) {}
    if (signal) {
      if (signal.type === 'join' && signal.token !== undefined) {
        try {
          if (webrtcRooms[signal.token] === undefined) {
            webrtcRooms[signal.token] = {};
          }
        } catch (evt) {}
        try {
          webrtcRooms[signal.token][connection.id] = true;
        } catch (evt) {}
      } else if (signal.token !== undefined) {
        try {
          Object.keys(webrtcRooms[signal.token]).forEach((id) => {
            if (id != connection.id) {
              webrtcClients[id].send(message.utf8Data, logError);
            }
          });
        } catch (evt) {}
      } else {
        logComment(`invalid signal: ${message.utf8Data}`);
      }
    } else {
      logComment(`invalid signal: ${message.utf8Data}`);
    }
  }
};

const connectionClosed = (connection, evt) => {
  logComment(`connection closed ( ${connection.remoteAddress} )`);
  Object.keys(webrtcRooms).forEach((token) => {
    Object.keys(webrtcRooms[token]).forEach((id) => {
      if (id === connection.id) {
        delete webrtcRooms[token][id];
      }
    });
  });
};

module.exports = { signalRequest };
