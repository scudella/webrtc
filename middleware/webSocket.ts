const Room = require('../models/Room');
const { logError, logComment } = require('../utils');
const { authenticateWsUser } = require('./authentication');
const uuid = require('uuid');

const webrtcClients = {};
const webrtcRooms = {};

// Note: if there is more than a room booked for a logged user
// it would be possible with a single request join several rooms.
// the same is possible for non logged user joining several rooms
// owned by other users. Unless we impose constrainst in here.

const signalRequest = async (req) => {
  logComment(`new request ( ${req.origin} )`);

  await authenticateWsUser(req);
  const user = req.user;

  const connection = req.accept(null, req.origin);
  logComment(`new connection ( ${connection.remoteAddress} )`);

  connection.id = uuid.v4();

  const leg = {
    connection,
    user,
    rooms: [],
  };

  try {
    webrtcClients[connection.id] = leg;
  } catch (error) {
    logError(error);
    return;
  }

  connection.on('message', (evt) => callSetup(leg, evt));

  connection.on('close', (evt) => connectionClosed(leg, evt));
};

const callSetup = async (leg, message) => {
  const { connection, user } = leg;
  if (message.type === 'utf8') {
    let signal = undefined;
    try {
      signal = JSON.parse(message.utf8Data);
    } catch (error) {
      logError(error);
      return;
    }
    if (signal) {
      const { token, type } = signal;
      let room;
      try {
        room = await Room.findOne({ name: token });
      } catch (error) {
        logError(error);
        logError('Error while retrieving room');
        // tear down connection
        connection.close('1000');
        return;
      }
      if (room) {
        const { name, capacity, sfu, ownerRequired } = room;
        if (!sfu) {
          // 2-way pxp setup
          logComment(`got message ${message.utf8Data}`);

          logComment(
            `from user ${user ? user.userId : 'anonymous'}, leg ${
              connection.id
            }`
          );
          if (
            type === 'join' &&
            user &&
            room.user._id.toString() === user.userId
          ) {
            //***************************************** */
            //
            // user logged in and is the room owner
            //
            //***************************************** */
            if (webrtcRooms[token] === undefined) {
              // first to join
              bridgeCreate(token, connection);
              // Add owner
              bridgeAddLeg(token, connection, 'owner');
            } else {
              // there is at least a party already in the room
              const bridge = Object.entries(webrtcRooms[token]);
              if (bridge.length === capacity) {
                // the room is full
                // reset the bridge - someone may be stuck
                bridgeReset(token);
                // create the bridge again
                bridgeCreate(token, connection);
                // add the owner
                bridgeAddLeg(token, connection, 'owner');
              } else {
                // check whether there is an owner
                const owner = bridge.find((mate) => mate[1] === 'owner');
                if (!owner) {
                  // party(ies) is(are) a callee
                  // enter the room as owner
                  bridgeAddLeg(token, connection, 'owner');
                  // send to the owner the message callee arrived
                  // from all parties already in the room
                  bridge.forEach((mate) => {
                    if (mate[0] !== connection.id) {
                      webrtcClients[connection.id].connection.send(
                        JSON.stringify({
                          token,
                          type: 'callee_arrived',
                          fromParty: mate[0],
                        }),
                        logError
                      );
                      logComment(
                        `callee_arrived ${mate[0]} sent to an owner ${connection.id} at room ${token}`
                      );
                    }
                  });
                } else {
                  // other party is owner

                  // send message to the other party: callee arrived
                  // get other party connection id

                  webrtcClients[owner[0]].connection.send(
                    JSON.stringify({
                      token,
                      type: 'callee_arrived',
                      fromParty: connection.id,
                    }),
                    () => notConnected(owner[0], token, connection)
                  );
                  logComment(
                    `callee_arrived ${connection.id} sent to first owner ${owner[0]} at room ${token}`
                  );
                  // send message to the owner that became callee
                  // the caller arrived
                  webrtcClients[connection.id].connection.send(
                    JSON.stringify({
                      token,
                      type: 'caller_arrived',
                    }),
                    logError
                  );
                  // send to everybody else mate arrived
                  bridge.forEach((mate) => {
                    if (mate[0] !== owner[0]) {
                      webrtcClients[mate[0]].connection.send(
                        JSON.stringify({
                          token,
                          type: 'party_arrived',
                          fromParty: connection.id,
                        }),
                        logError
                      );
                      logComment(
                        `party_arrived ${connection.id} sent to a callee ${mate[0]} at room ${token}`
                      );
                    }
                  });
                  logComment(
                    `caller_arrived sent to second owner ${connection.id} at room ${token}`
                  );
                  // another owner connection - this will be callee
                  bridgeAddLeg(token, connection, 'callee');
                }
              }
            }
          } else if (type === 'join') {
            //***************************************** */
            //
            // logged, but not room owner or user not logged
            //
            //***************************************** */
            if (webrtcRooms[token] === undefined) {
              // first to join
              if (!ownerRequired) {
                bridgeCreate(token, connection);

                bridgeAddLeg(token, connection, 'callee');
              } else {
                // Ask callee to wait for the owner arrival
                webrtcClients[connection.id].connection.send(
                  JSON.stringify({
                    token,
                    type: 'waiting-room',
                  }),
                  logError
                );
              }
            } else {
              // there is at least a party already in the room
              const bridge = Object.entries(webrtcRooms[token]);

              const ownerInBridge = Object.values(webrtcRooms[token]).find(
                (role) => role === 'owner'
              );
              // callees may enter the bridge leaving one leg left to the owner. If owner in bridge, callees can get remaining seats.
              if (
                bridge.length < capacity - 1 ||
                (bridge.length < capacity && ownerInBridge)
              ) {
                // send to the owner the message callee arrived
                // and to everybody else party arrived
                bridge.forEach((mate) => {
                  if (mate[1] === 'owner') {
                    webrtcClients[mate[0]].connection.send(
                      JSON.stringify({
                        token,
                        type: 'callee_arrived',
                        fromParty: connection.id,
                      }),
                      logError
                    );
                    logComment(
                      `callee_arrived ${connection.id} sent to owner ${mate[0]} when callee arrives at ${token}`
                    );
                  } else {
                    webrtcClients[mate[0]].connection.send(
                      JSON.stringify({
                        token,
                        type: 'party_arrived',
                        fromParty: connection.id,
                      }),
                      logError
                    );
                    logComment(
                      `party_arrived ${connection.id} sent to party ${mate[0]} when callee arrives at ${token}`
                    );
                  }
                });
                // enter the room as callee
                bridgeAddLeg(token, connection, 'callee');
              } else {
                // the room is full
                // send a message back
                webrtcClients[connection.id].connection.send(
                  JSON.stringify({
                    token,
                    type: 'full-bridge',
                  }),
                  logError
                );
                logComment(
                  `full-bridge sent to ${
                    user ? user.userId : 'anonymous'
                  } at room ${token}`
                );
              }
            }
          } else {
            //***************************************** */
            //
            // Messages sent after joining the bridge
            //
            //***************************************** */
            // check whether this bridge exist
            if (webrtcRooms[token] === undefined) {
              // bridge should exist at this point
              // drop the connection
              connection.close('1002');
              logComment(
                `message ${message.utf8Data} received without a bridge from ${connection.remoteAddress}`
              );
              return;
            } else {
              // check whether this party has joined the room
              const party = Object.keys(webrtcRooms[token]).find(
                (id) => id === connection.id
              );
              if (party) {
                // then check whether is a valid message
                if (
                  type === 'ice-candidate' ||
                  type === 'description' ||
                  type === 'hang-up' ||
                  type === 'pcDisconnect'
                ) {
                  // Let's intercept hang-up to do some clean-up.
                  if (type === 'hang-up') {
                    const partyIsOwner = bridgeDeleteLeg({
                      token,
                      party: connection.id,
                      reason: 'hanged up',
                    });
                    // if room is empty or without an owner, delete the room
                    if (!Object.values(webrtcRooms[token]).length) {
                      // room empty
                      deleteBridge(token, 'when room empty');
                    } else {
                      // room not empty
                      // check whether the owner has left
                      if (partyIsOwner) {
                        // the owner has left the room
                        // send message to hang up everybody else
                        Object.keys(webrtcRooms[token]).forEach((id) => {
                          try {
                            webrtcClients[id].connection.send(
                              JSON.stringify({
                                token,
                                type: 'hang-up',
                                fromParty: 'owner',
                              }),
                              logError
                            );
                            logComment(
                              `hang-up sent to callee as the owner left room ${token}`
                            );
                          } catch (error) {
                            logError(
                              `error sending hang-up to the remaining mates of room ${token}`
                            );
                          }
                          removeRoomFromList({ token, id });
                        });
                        // delete bridge after droping all
                        deleteBridge(token, 'after dropping all');
                      } else {
                        // owner still on the call, send hang-up to
                        // signal a party has left. Owner and other
                        // participants will remain in the bridge
                        Object.keys(webrtcRooms[token]).forEach((party) => {
                          webrtcClients[party].connection.send(
                            JSON.stringify({
                              token,
                              type: 'hang-up',
                              fromParty: connection.id,
                            }),
                            logError
                          );
                          logComment(
                            `hang-up sent to leg ${party} as party ${connection.id} has left room ${token}`
                          );
                        });
                      }
                    }
                  } else if (type === 'pcDisconnect') {
                    const { toParty } = signal;
                    bridgeDeleteLeg({
                      token,
                      party: toParty,
                      reason: 'disconnect by owner',
                    });
                  } else {
                    // then send the message to the destination
                    Object.keys(webrtcRooms[token]).forEach((id) => {
                      if (id != connection.id && id === signal.toParty) {
                        try {
                          // add connection.id to the message
                          signal.fromParty = connection.id;
                          webrtcClients[id].connection.send(
                            JSON.stringify(signal),
                            logError
                          );
                        } catch (error) {
                          if (!webrtcClients[id].connection.connected) {
                            logError('sending some message to everybody else');
                            delete webrtcRooms[token][id];
                            delete webrtcClients[id];
                          }
                        }
                      }
                    });
                  }
                } else {
                  // invalid message
                  // drop the connection
                  connection.close('1002');
                  logError(
                    `message ${message.utf8Data} received does not exist - from ${connection.remoteAddress}`
                  );
                  return;
                }
              } else {
                // party did not previously join the room
                // drop the connection
                connection.close('1002');
                logError(
                  `message ${message.utf8Data} from ${connection.remoteAddress} received but party did not join the bridge`
                );
                return;
              }
            }
          }
        } else {
          // sfu logic here
        }
      } else {
        // there is no room booked
        logComment(`room ${token} not booked`);
        // send message reporting room is not available
        webrtcClients[connection.id].connection.send(
          JSON.stringify({
            token,
            type: 'not-available',
          }),
          logError
        );
        logComment(
          `not-available sent to request from ${
            user ? user.userId : 'anonymous'
          } at ${token}`
        );
      }
    } else {
      // no signal after parse json
      logError(`invalid signal: ${message.utf8Data}`);
      connection.close('1002');
      return;
    }
  } else {
    // message type is not utf8
    logError(`invalid signal: ${message.utf8Data}`);
    connection.close('1002');
    return;
  }
};

// the close connection behaves as there can be multiple callees in a room
const connectionClosed = (connection, evt) => {
  if (webrtcClients[connection.id] !== undefined) {
    logComment(`connection closed ( ${connection.remoteAddress} )`);
    // get list of rooms from the given connection
    webrtcClients[connection.id].rooms.forEach((token) => {
      // delete the id from the room
      if (webrtcRooms[token] !== undefined) {
        Object.keys(webrtcRooms[token]).forEach((id) => {
          if (id === connection.id) {
            deleteBridge(token, `party ${connection.id}`);
          }
        });
        // if room is empty or without an owner, delete the room
        if (!Object.values(webrtcRooms[token]).length) {
          deleteBridge(token, 'when room empty');
        } else {
          const newRoom = Object.values(webrtcClients[token]).find(
            (id) => id === 'owner'
          );
          if (!newRoom) {
            // the remaining room mates left were callee
            // send message to hang up them and delete the room
            Object.keys(webrtcRooms[token]).forEach((id) => {
              webrtcClients[id].connection.send(
                JSON.stringify({
                  token,
                  type: 'hang-up',
                  fromParty: 'owner',
                }),
                logError
              );
              logComment(
                `hang-up sent to callee as the owner left room ${token}`
              );
              removeRoomFromList({ token, id });
            });
            // delete bridge after droping all
            deleteBridge(token, 'after dropping all');
          }
        }
      }
    });
    // end of rooms, delete the client
    try {
      delete webrtcClients[id];
    } catch (error) {
      logError(error);
      logError(`error deleting the client ${id}`);
      return;
    }
  }
};

const bridgeReset = (token) => {
  Object.entries(webrtcRooms[token]).forEach((mate) => {
    const id = mate[0];
    const role = mate[1];
    const newList = webrtcClients[id].rooms.filter((room) => room !== token);
    if (!newList.length) {
      if (role === 'owner') {
        // send hard-reset and disconnect it
        webrtcClients[id].connection.send(
          JSON.stringify({
            token,
            type: 'hard-reset',
          }),
          logError
        );
      } else {
        // send reset to callee
        webrtcClients[id].connection.send(
          JSON.stringify({
            token,
            type: 'reset',
          }),
          logError
        );
      }
      try {
        delete webrtcClients[id];
      } catch (error) {
        logError(`error deleting client ${id}`);
      }
    } else {
      webrtcClients[id].rooms = newList;
    }
  });
  deleteBridge(token, 'at bridge reset');
};

const bridgeCreate = (token, connection) => {
  try {
    webrtcRooms[token] = {};
  } catch (error) {
    logError(error);
    logError(`error creating a new room ${token}`);
    connection.close('1000');
    return;
  }
};

const bridgeAddLeg = (token, connection, legRole) => {
  const { id } = connection;
  try {
    if (webrtcRooms[token][id]) {
      // id may be in the room as another role
      webrtcRooms[token][id] = legRole;
    } else {
      webrtcRooms[token][id] = legRole;
      webrtcClients[id].rooms.push(token);
    }
    logComment(`Add ${id} to bridge ${token} as ${legRole}`);
  } catch (error) {
    logError(error);
    logError(`error adding ${id} ${legRole} to bridge ${token}`);
    connection.close('1000');
    return;
  }
};

const bridgeDeleteLeg = ({ token, party, reason }) => {
  let partyIsOwner = false;
  const bridge = Object.entries(webrtcRooms[token]);
  bridge.forEach((mate) => {
    if (mate[0] === party) {
      if (mate[1] === 'owner') {
        partyIsOwner = true;
      }
      // remove party from the bridge
      try {
        delete webrtcRooms[token][party];
        logComment(`leg ${party} ${reason}`);
        // remove room from the list
        removeRoomFromList({ token, id: party });
      } catch (error) {
        logError(error);
        logError(`error deleting bridge ${token} party ${party}`);
      }
    }
  });
  return partyIsOwner;
};

const deleteBridge = (token, reason) => {
  try {
    delete webrtcRooms[token];
    logComment(`room ${token} deleted`);
  } catch (error) {
    logError(error);
    logError(`error deleting bridge ${token} ${reason}`);
  }
};

const notConnected = (firstId, token, secondConnection) => {
  // if owner had a browser reset it won't be connected
  if (!webrtcClients[firstId].connection.connected) {
    // owner is gone
    logComment(
      `${firstId} is gone, ${secondConnection.id} is probably the owner that was reset`
    );
    // reset the bridge - Restart over
    bridgeReset(token);
  }
};

const removeRoomFromList = ({ token, id }) => {
  const connection = webrtcClients[id].connection;
  // remove room from the list
  const newList = webrtcClients[id].rooms.filter((item) => item !== token);
  // if room list is empty, close the connection
  if (!newList.length) {
    // close connection;
    try {
      connection.close('1000');
      delete webrtcClients[id];
    } catch (error) {
      logError(error);
      logError(`error deleting connection and client ${id}`);
    }
  } else {
    webrtcClients[id].rooms = newList;
  }
};

module.exports = { signalRequest };
