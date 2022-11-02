/*  Copyright (c) 2022 Eduardo S. Libardi, All rights reserved. 

Permission to use, copy, modify, and/or distribute this software for any purpose with or 
without fee is hereby granted, provided that the above copyright notice and this permission 
notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS 
SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL 
THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES 
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, 
NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE 
OF THIS SOFTWARE.
*/

import { setDataChannel, onDataChannel, toggleCanvasChat } from './chat.js';
import { toast } from './utils/toast.js';

let callToken = '';
let socket;
let virtualCanvas = null;
let allMediaStreams = [];
let connection = [];
let noVideoCall = false;
let sharingScreen = false;
let partySide = '';
let serverOrigin = '';
let webSocketOrigin = '';

const callState = document.querySelector('#call-state');
const toggleButton = document.getElementById('toggleVideo');
const navToggle = document.querySelector('.nav-toggle');
const links = document.querySelector('.menu');
const replaceScreen = document.getElementById('replace-screen');
const video = document.getElementById('local_video');
const canvasOverlay = document.querySelector('#canvasOverlay');
const hangup = document.getElementById('hangup');
const shareScreen = document.getElementById('sharescreen');
const mute = document.querySelector('#mute');
const shareVideo = document.querySelector('#shareVideo');
const canvasChat = document.getElementById('canvasChat');
const avatar = document.querySelector('.user');

window.onload = function init() {
  serverOrigin = document.location.origin;
  webSocketOrigin = `wss://${document.location.host}`;
  //  Get token provided in the home page or direct
  // in the address field
  callToken = document.location.hash.slice(1, 21);
  if (callToken) {
    callToken = callToken.match(/[A-Za-z0-9-]+/)[0];
  }
  if (!callToken) {
    document.location = `${serverOrigin}`;
  }
  localStorage.setItem('callToken', callToken);

  if (localStorage.getItem('user')) {
    const user = JSON.parse(localStorage.getItem('user'));

    avatar.innerText = user.name;
  }

  navToggle.addEventListener('click', function (evt) {
    if (evt.target.parentNode === navToggle || evt.target === navToggle) {
      links.classList.toggle('show-menu');
      evt.stopPropagation();
    }
  });

  toggleButton.addEventListener('click', toggleVideo);

  const constraint = {
    audio: true,
    video: {
      width: {
        min: 640,
        max: 1024,
      },
      height: {
        min: 480,
        max: 768,
      },
    },
  };

  startCall(constraint);

  function startCall(constraint) {
    // getusermedia
    navigator.mediaDevices
      .getUserMedia(constraint)
      .then(function (stream) {
        // start with the audio stream muted
        stream.getAudioTracks()[0].enabled = false;
        // add full screen handling
        video.addEventListener('dblclick', videoDblClick);
        video.style.backgroundColor = 'transparent';
        // start stream in the local video
        video.srcObject = stream;
        video.play();

        // save local media in the peer connection object
        allMediaStreams.push({
          mediaStream: stream,
          videoId: 'local_video',
        });

        // toggle video button is enabled
        toggleButton.disabled = false;
        // create event listener to toggle audio
        mute.addEventListener('click', muteLocalVideo);

        // set location.hash to the unique token for this call
        console.log(callToken);
        document.location.hash = callToken;

        // create webSocket. The nodejs app.js application will handle it
        socket = new WebSocket(`${webSocketOrigin}`);

        // the partySide variable registered on localStorage
        // at meeting.js or start.js related pages
        // to check if this is a caller or callee leg
        // a caller may become a callee if we start two
        // sections logged with the same credentials
        // the server may set the last arriving as callee
        // or may reject this leg.
        // in the case where the url is input directly at the
        // address bar, it may not have a partySide
        partySide = localStorage.getItem('partySide');
        localStorage.setItem('partySide', '');

        if (partySide === 'caller') {
          // Caller leg
          socket.onopen = function () {
            socket.onmessage = callerSignalling;
            // send join message to the bridge
            socket.send(
              JSON.stringify({
                token: callToken,
                type: 'join',
              })
            );
            socket.onclose = (event) => {
              // TODO - hangupReceivedByCaller ?
              console.log(`received websocket on close event`);
            };
          };
        } else {
          // Callee Leg
          partySide = 'callee';

          socket.onopen = function () {
            socket.onmessage = calleeSignalling;
            // send join message to the bridge
            socket.send(
              JSON.stringify({
                token: callToken,
                type: 'join',
              })
            );
            socket.onclose = (event) => {
              // TODO ??? check pc status ?
              console.log(`received websocket on close event`);
            };
          };

          document.title = 'Callee Leg';
        }
      })
      .catch(handleGetUserMediaError);
  }
};

/* functions used above are defined below */

const toggleVideo = () => {
  // Is the button in the no camera mode?
  if (!noVideoCall) {
    // set call to no camera mode
    noVideoCall = true;
    // toggle the button background red
    toggleButton.classList.toggle('mute');
    // Get the camera stream
    if (!virtualCanvas) {
      canvasCreateStream();
    }
    canvasOverlay.classList.add('frontVideo');
    // if sharing screen is in place do not send canvas
    if (!sharingScreen) {
      const canvasStream = allMediaStreams.find(
        (stream) => stream.videoId === 'canvas'
      );

      connection.length &&
        connection[0].peerConnection
          .getSenders()
          .find((sender) => sender.track.kind === 'video')
          .replaceTrack(canvasStream.mediaStream.getVideoTracks()[0]);
      // bring the canvas overlay in front of the local video
    }
    // set timeout to redraw canvas, otherwise the remote side
    // does not start the video
    setTimeout(drawCanvas, 500);
  } else {
    // setting call to video mode
    noVideoCall = false;
    // toggle the button to white
    toggleButton.classList.toggle('mute');
    // move the canvas overlay to the back
    canvasOverlay.classList.remove('frontVideo');

    // if sharing screen is in place do not do anything else
    if (!sharingScreen) {
      const originalStream = allMediaStreams.find(
        (stream) => stream.videoId === 'local_video'
      );
      // Get the camara stream
      const originalTrack = originalStream.mediaStream.getTracks()[1];

      // replace canvas with camera stream
      connection.length &&
        connection[0].peerConnection
          .getSenders()
          .find((sender) => sender.track.kind === 'video')
          .replaceTrack(originalTrack);
    }
  }
};

const canvasCreateStream = () => {
  // create canvas with the same video dimensions to avoid
  // renegotiation
  let width = video.videoWidth;
  let height = video.videoHeight;
  virtualCanvas = Object.assign(document.createElement('canvas'), {
    width,
    height,
  });
  // console.log(`width: ${width}, height: ${height}`);
  // draw a rectangule on the whole canvas
  virtualCanvas.getContext('2d').fillRect(0, 0, width, height);
  // capture canvas stream
  let mediaSource = virtualCanvas.captureStream(10);
  // store canvas information on peer connection object
  // senders from the local_video
  allMediaStreams.push({
    mediaStream: mediaSource,
    videoId: 'canvas',
  });
};

const drawCanvas = () => {
  const ctx = virtualCanvas.getContext('2d');
  ctx.save();
  ctx.fillStyle = 'rgb(21,14,86)';
  const width = video.videoWidth;
  const height = video.videoHeight;
  ctx.clearRect(0, 0, width, height);
  ctx.fillRect(0, 0, width, height);
  let user, name;
  if (localStorage.getItem('user')) {
    user = JSON.parse(localStorage.getItem('user'));
  }
  if (user) {
    name = user.name;
  }
  let char = '0';

  if (name) {
    char = name.charAt(0).toUpperCase();
  }

  ctx.beginPath();
  ctx.fillStyle = 'rgb(255, 205, 0)';
  ctx.arc(width / 2, height / 2, 100, 0, Math.PI * 2, true);
  ctx.fill();
  ctx.font = '130px serif';
  ctx.fillStyle = 'rgb(21, 14, 86)';
  // Let's measure the size of the letter to set it
  // at the center of the canvas
  let textMetrics = ctx.measureText(char.toUpperCase());
  ctx.fillText(
    char,
    (width - textMetrics.width) / 2,
    (height + textMetrics.actualBoundingBoxAscent) / 2
  );

  ctx.restore();
  // Let us draw a canvas overlay to the local media
  // with the same virtual canvas sent to the peer.
  const canvasOverlayCtx = canvasOverlay.getContext('2d');

  canvasOverlayCtx.drawImage(
    virtualCanvas,
    0,
    0,
    video.offsetWidth,
    video.offsetHeight
  );

  setTimeout(drawCanvas, 100);
};

const handleGetUserMediaError = (event) => {
  switch (event.name) {
    case 'NotFoundError':
      toast({
        alertClass: 'alert-danger',
        content:
          'Unable to open your call because no camera and/or microphone were found.',
        modal: true,
      });
      break;
    case 'SecurityError':
    case 'PermissionDeniedError':
      // Do nothing; this is the same as the user canceling the call.
      break;
    default:
      toast({
        alertClass: 'alert-danger',
        content: `Error opening your camera and/or microphone: ${event.message}`,
        modal: true,
      });
      break;
  }
  setTimeout(() => {
    document.location = `${serverOrigin}`;
  }, 3200);
};

/* ///////////////////////////////////////////////////////
/
/                   Peer Connection setup
/
*/ ////////////////////////////////////////////////////////

const createPeerConnection = (token) => {
  const configuration = {
    iceservers: [{ urls: 'stun:stun.l.google.com:19302' }],
  };
  const peerConnection = new RTCPeerConnection(configuration);

  const pc = {
    token,
    peerConnection,
    iceCandidates: [],
  };

  connection.push(pc);

  peerConnection.onicecandidate = function (event) {
    if (event.candidate) {
      socket.send(
        JSON.stringify({
          token: callToken,
          type: 'ice-candidate',
          candidate: event.candidate,
        })
      );
    }
  };

  // let the "negotiationneeded" event trigger offer generation
  peerConnection.onnegotiationneeded = async () => {
    console.log(
      `Negotiation Needed. IceConnectionState is: ${peerConnection.iceConnectionState}`
    );
    try {
      if (peerConnection.iceConnectionState !== 'new') {
        await peerConnection.setLocalDescription();
        // send the offer to the other peer
        socket.send(
          JSON.stringify({
            token: callToken,
            type: 'description',
            sdp: peerConnection.localDescription,
          })
        );
      }
    } catch (error) {
      console.log(error);
    }
  };

  peerConnection.ontrack = function (event) {
    console.log('ontrack called. The event is:');
    console.log(event);
    const track = event.track;
    const type = track.kind;
    console.log(type);

    let remoteVideoCreated = allMediaStreams.find(
      (stream) => stream.videoId === 'remote_video'
    );
    let videoShare = allMediaStreams.find(
      (stream) => stream.videoId === 'video_share'
    );
    if (!remoteVideoCreated) {
      // Create remote video from peer
      remoteVideoCreated = createVideo('remote_video', event);

      // Save mediaStream from remote
      allMediaStreams.push({
        mediaStream: remoteVideoCreated,
        videoId: 'remote_video',
      });

      // Enable hangup button
      hangup.disabled = false;
      hangup.addEventListener('click', hangUpCall);

      // Enable mute button
      mute.disabled = false;

      // Allow video to be shared with remote
      shareVideo.disabled = false;
      shareVideo.addEventListener('click', createVideoElement);

      // Allow screen to be shared with remote
      shareScreen.disabled = false;
      shareScreen.addEventListener('click', sharedScreen);
      replaceScreen.disabled = false;
      replaceScreen.addEventListener('click', replaceShareScreen);

      // Enable canvas message to be selected
      canvasChat.disabled = false;
      canvasChat.addEventListener('click', toggleCanvasChat);

      // Remote video has additional streams to add
    } else if (remoteVideoCreated.mediaStream.id === event.streams[0].id) {
      document.querySelector('#remote_video').srcObject = event.streams[0];

      // If on track is not from remote video camera it should be from a video
      // or screen sharing
    } else if (!videoShare) {
      videoShare = createVideo('video_share', event);
      allMediaStreams.push({ mediaStream: videoShare, videoId: 'video_share' });
      console.log('Shared Video Arrived');

      shareVideo.disabled = true;

      shareScreen.disabled = true;

      // Check for tracks removed
      setTimeout(checkRemoveTrack, 1000);

      // video or screen sharing has additional tracks to add
    } else if (videoShare.mediaStream.id === event.streams[0].id) {
      document.querySelector('#video_share').srcObject = event.streams[0];

      // track not related with remote camera or video/screen sharing
    } else {
      console.log('ontrack received, but not handled:');
      console.log(event.streams[0].id);
    }
  };

  peerConnection.addEventListener(
    'iceconnectionstatechange',
    () => {
      callState.className = `${peerConnection.iceConnectionState}-state`;

      {
        switch (peerConnection.iceConnectionState) {
          case 'new':
            console.log(
              'The ICE agent is gathering addresses or is waiting to be given remote candidates'
            );
            break;
          case 'checking':
            console.log('The ICE agent is checking candidates.');
            break;
          case 'connected':
            console.log('The ice connection has been established.');
            break;
          case 'completed':
            console.log('ICE has found a connection for all components.');
            break;
          case 'closed':
            console.log('Call closed');
            toast({
              alertClass: 'alert-danger',
              content: 'Peer closed the call',
              modal: true,
            });
            setTimeout(() => {
              if (partySide === 'owner') {
                hangupReceivedByCaller();
              } else {
                document.location = `${serverOrigin}`;
              }
            }, 3200);
            break;
          case 'failed':
            console.log('Call failed');
            toast({
              alertClass: 'alert-danger',
              content: 'Call failed',
              modal: true,
            });
            setTimeout(() => {
              if (partySide === 'owner') {
                hangupReceivedByCaller();
              } else {
                document.location = `${serverOrigin}`;
              }
            }, 3200);
            break;
          case 'disconnected':
            console.log('State disconnected');
            toast({
              alertClass: 'alert-danger',
              content: 'Peer disconnected',
              modal: true,
            });
            setTimeout(() => {
              if (partySide === 'owner') {
                hangupReceivedByCaller();
              } else {
                document.location = `${serverOrigin}`;
              }
            }, 3200);
            break;
        }
      }
    },
    false
  );
  return peerConnection;
};

/* ///////////////////////////////////////////////////////
/
/                   WebSockets setup
/
*/ ////////////////////////////////////////////////////////

// handle signals as a caller
const callerSignalling = (event) => {
  const signal = JSON.parse(event.data);
  if (signal.type === 'caller_arrived') {
    console.log('caller_arrived');
    // Server asks this instance to be Callee Leg
    // probably there is already another instance
    // with the same credentials in the bridge
    socket.onmessage = calleeSignalling;
    partySide = 'callee';
    document.title = 'Callee Leg';
  } else if (signal.type === 'callee_arrived') {
    document.title = 'Caller Leg';
    const peerConnection = createPeerConnection(signal.token);
    setDataChannel(peerConnection);

    // add camera and mic stream to pc
    const { mediaStream } = allMediaStreams.find(
      (stream) => stream.videoId === 'local_video'
    );
    mediaStream
      .getTracks()
      .forEach((track) => peerConnection.addTrack(track, mediaStream));

    // if video is in mute send canvas instead
    if (noVideoCall) {
      const canvasStream = allMediaStreams.find(
        (stream) => stream.videoId === 'canvas'
      );
      peerConnection
        .getSenders()
        .find((sender) => sender.track.kind === 'video')
        .replaceTrack(canvasStream.mediaStream.getVideoTracks()[0]);
    }

    peerConnection
      .createOffer()
      .then(function (offer) {
        console.log('Offer created. Set local Description');
        return peerConnection.setLocalDescription(offer);
      })
      .then(function () {
        console.log('Description created. Sent to peer.');
        socket.send(
          JSON.stringify({
            token: callToken,
            type: 'description',
            sdp: peerConnection.localDescription,
          })
        );
      })
      .catch(function (error) {
        console.log(error);
      });
  } else if (signal.type === 'ice-candidate') {
    console.log('New ice-candidate message received.');
    const { peerConnection } = connection.find(
      (pc) => pc.token === signal.token
    );
    // if remoteDescription not set, queue iceCandidate
    if (peerConnection && peerConnection.remoteDescription) {
      peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
    } else {
      connection.map((pc) => {
        if (pc.token === signal.token) {
          pc.iceCandidates.push(signal.candidate);
        }
      });
    }
  } else if (signal.type === 'description') {
    const { peerConnection, iceCandidates } = connection.find(
      (pc) => pc.token === signal.token
    );
    console.log(
      `New description message received. Set remote description. Type is ${signal.sdp.type}`
    );
    if (signal.sdp.type === 'answer') {
      peerConnection
        .setRemoteDescription(signal.sdp)
        .then(function () {
          console.log('Remote Session Description set.');
          // read iceCandidates in queue and apply to pc
          iceCandidates.forEach((candidate) =>
            peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
          );
          connection.forEach((pc) => {
            if (pc.token === signal.token) {
              pc.iceCandidates = [];
            }
          });
        })
        .catch(function (error) {
          console.log(error);
        });
    } else {
      peerConnection
        .setRemoteDescription(signal.sdp)
        .then(function () {
          console.log('Remote Session Description set. Creating answer');
          // read iceCandidates in queue and apply to pc
          iceCandidates.forEach((candidate) =>
            peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
          );
          connection.forEach((pc) => {
            if (pc.token === signal.token) {
              pc.iceCandidates = [];
            }
          });
          return peerConnection.createAnswer();
        })
        .then(function (answer) {
          console.log('Answer created. Set local description');
          return peerConnection.setLocalDescription(answer);
        })
        .then(function () {
          console.log('Local description set. Send description to peer');
          socket.send(
            JSON.stringify({
              token: callToken,
              type: 'description',
              sdp: peerConnection.localDescription,
            })
          );
        })
        .catch(function (error) {
          console.log(error);
        });
    }
  } else if (signal.type === 'hang-up') {
    const { peerConnection } = connection.find(
      (pc) => pc.token === signal.token
    );
    console.log('Received hang up notification from other peer');
    hangupReceivedByCaller(signal.token);
  } else if (signal.type === 'hard-reset') {
    socket.close();
    toast({
      alertClass: 'alert-danger',
      content: 'Another user joined with the same credentials',
      modal: true,
    });
    setTimeout(() => {
      document.location = `${serverOrigin}/meeting/`;
    }, 3200);
  } else {
    console.log(`Non-handled ${signal.type} received`);
  }
};

// ***************************
//
// handle signals as a callee
//
// ***************************

const calleeSignalling = (event) => {
  const signal = JSON.parse(event.data);
  let peerConnection;
  const pc = connection.find((pc) => pc.token === signal.token);
  if (!pc) {
    peerConnection = createPeerConnection(signal.token);
    // Set listeners for data channel
    peerConnection.ondatachannel = onDataChannel;
    // add camera and mic stream to pc
    const { mediaStream } = allMediaStreams.find(
      (stream) => stream.videoId === 'local_video'
    );
    // add mediaStream to pc
    mediaStream
      .getTracks()
      .forEach((track) => peerConnection.addTrack(track, mediaStream));
    // if video is in mute send canvas instead
    if (noVideoCall) {
      const canvasStream = allMediaStreams.find(
        (stream) => stream.videoId === 'canvas'
      );
      peerConnection
        .getSenders()
        .find((sender) => sender.track.kind === 'video')
        .replaceTrack(canvasStream.mediaStream.getVideoTracks()[0]);
    }
  } else {
    peerConnection = pc.peerConnection;
  }
  if (signal.type === 'ice-candidate') {
    console.log('New Ice Candidate message received.');
    // if remoteDescription not set, queue iceCandidate
    if (peerConnection && peerConnection.remoteDescription) {
      peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
    } else {
      connection.map((pc) => {
        if (pc.token === signal.token) {
          pc.iceCandidates.push(signal.candidate);
        }
      });
    }
  } else if (signal.type === 'description') {
    const { iceCandidates } = connection.find(
      (pc) => pc.token === signal.token
    );
    console.log(
      `New description message received. Set remote description. Type is ${signal.sdp.type}`
    );
    if (signal.sdp.type === 'offer') {
      peerConnection
        .setRemoteDescription(signal.sdp)
        .then(function () {
          console.log('Remote Session Description set. Creating answer');
          // read iceCandidates in queue and apply to pc
          iceCandidates.forEach((candidate) =>
            peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
          );
          connection.forEach((pc) => {
            if (pc.token === signal.token) {
              pc.iceCandidates = [];
            }
          });
          return peerConnection.createAnswer();
        })
        .then(function (answer) {
          console.log('Answer created. Set local description');
          return peerConnection.setLocalDescription(answer);
        })
        .then(function () {
          console.log('Local description set. Send description to peer');
          socket.send(
            JSON.stringify({
              token: callToken,
              type: 'description',
              sdp: peerConnection.localDescription,
            })
          );
        })
        .catch(function (error) {
          console.log(error);
        });
    } else {
      peerConnection
        .setRemoteDescription(signal.sdp)
        .then(function () {
          console.log('Remote Session Description set.');
          // read iceCandidates in queue and apply to pc
          iceCandidates.forEach((candidate) =>
            peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
          );
          connection.forEach((pc) => {
            if (pc.token === signal.token) {
              pc.iceCandidates = [];
            }
          });
        })
        .catch(function (error) {
          console.log(error);
        });
    }
  } else if (signal.type === 'hang-up') {
    toast({
      alertClass: 'alert-danger',
      content: 'Hang-up received',
      modal: true,
    });
    console.log('Received hang up notification from other peer');
    setTimeout(() => {
      document.location = `${serverOrigin}`;
    }, 3200);
  } else if (signal.type === 'full-bridge') {
    toast({
      alertClass: 'alert-danger',
      content: 'Room is full',
      modal: true,
    });
    setTimeout(() => {
      document.location = `${serverOrigin}`;
    }, 3200);
  } else if (signal.type === 'not-available') {
    toast({
      alertClass: 'alert-danger',
      content: 'The meeting code provided does not exist',
      modal: true,
    });
    setTimeout(() => {
      document.location = `${serverOrigin}`;
    }, 3200);
  } else if (signal.type === 'reset') {
    toast({
      alertClass: 'alert-danger',
      content: 'Meeting reset',
      modal: true,
    });
    socket.close();
    setTimeout(() => {
      location.reload();
    }, 2000);
  } else {
    console.log(`Non-handled ${signal.type} received`);
  }
};

const hangupReceivedByCaller = (token) => {
  const remoteVideoElement = document.getElementById('remote_video');
  const remoteVideoContainer = document.querySelector('.remoteVideoContainer');
  const videoContainer = document.querySelector('#videoContainer');

  allMediaStreams = allMediaStreams.filter(
    (mediaStream) => mediaStream.videoId !== 'remote_video'
  );
  const { peerConnection } = connection.find((pc) => pc.token === token);
  peerConnection.close();
  callState.className = 'closed-state';
  connection = connection.filter((pc) => pc.token !== token);
  if (remoteVideoElement && remoteVideoElement.srcObject) {
    remoteVideoElement.pause();
    remoteVideoElement.srcObject.getTracks().forEach((track) => track.stop());
    remoteVideoElement.removeAttribute('src');
    remoteVideoElement.load();
    // remove the video element
    for (const child of remoteVideoContainer.children) {
      child.remove();
    }
    // remove the div element
    for (const child of videoContainer.children) {
      if (child.classList.contains('remoteVideoContainer')) {
        child.remove();
      }
    }
  }
  hangup.disabled = true;
  shareScreen.disabled = true;
  replaceScreen.disabled = true;
  mute.disabled = true;
  shareVideo.disabled = true;
  canvasChat.disabled = true;
};

const hangUpCall = () => {
  // socket open?
  const OPEN = 1;
  if (socket.readyState === OPEN) {
    socket.send(
      JSON.stringify({
        token: callToken,
        type: 'hang-up',
      })
    );
  }
  if (partySide === 'caller') {
    setTimeout(() => {
      document.location = `${serverOrigin}/meeting/`;
    }, 300);
  } else {
    setTimeout(() => {
      document.location = `${serverOrigin}`;
    });
  }
};

//
// end of websockets
//

/**
 * createVideo is called when ontrack event fires in the receiver
 * side to create the video element. It passes the video #id for
 * this video (remote_video, for the peer connection media,  or video_share
 * for remote video or screen share) and the on track event. It returns the
 * ontrack event.streams[0], to store on allMediaStreams for subsequent ontrack
 * events for the same stream.
 */
function createVideo(videoid, event) {
  // creates a video element
  let vid = document.createElement('video');
  // add the #id for this particular video
  vid.id = videoid;
  vid.className = 'smallVideoR';
  vid.setAttribute('autoplay', true);
  let videoContainer = document.querySelector('#videoContainer');
  let divContainer = document.createElement('div');
  if (videoid === 'video_share') {
    divContainer.className = 'sharedVideoContainer';
    vid.className = 'shareVideo';
    if (videoContainer.classList.contains('videoContainerNoChat')) {
      videoContainer.classList.add('videoContainerNoChatShare');
    } else {
      videoContainer.classList.add('videoContainerChatShare');
    }
  } else {
    divContainer.className = 'remoteVideoContainer';
  }
  divContainer.append(vid);

  // Insert video in the DOM
  videoContainer.append(divContainer);

  // Add remote stream tracks to the new video
  vid.srcObject = event.streams[0];
  // Add event listener for double click
  vid.addEventListener('dblclick', videoDblClick);

  return event.streams[0];
}
// This function checks if a track was removed to
// remove sharing video elements
const checkRemoveTrack = () => {
  let timeout = true;
  const oneMediaStream = allMediaStreams.find(
    (mediaStream) => mediaStream.videoId === 'video_share'
  );

  const videoTracks = oneMediaStream.mediaStream.getTracks();

  if (!videoTracks.length) {
    // Remove object
    allMediaStreams = allMediaStreams.filter(
      (mediaStream) => mediaStream.videoId !== 'video_share'
    );

    let videoElement = document.getElementById('video_share');
    if (videoElement.srcObject) {
      videoElement.srcObject.getTracks().forEach((track) => track.stop());
      videoElement.srcObject = null;
    }
    videoElement.remove();
    let divElement = document.querySelector('.sharedVideoContainer');
    divElement.remove();
    let videoContainer = document.querySelector('#videoContainer');
    if (videoContainer.classList.contains('videoContainerNoChat')) {
      videoContainer.classList.remove('videoContainerNoChatShare');
    } else {
      videoContainer.classList.remove('videoContainerChatShare');
    }

    timeout = false;

    shareVideo.disabled = false;
    if (!sharingScreen) {
      shareScreen.disabled = false;
      replaceScreen.disabled = false;
    }
  }
  if (timeout) {
    setTimeout(checkRemoveTrack, 1000);
  }
};
//
// Share screen using either local media stream replace
// or a new video
//
const replaceShareScreen = () => {
  // Remove sidebar
  links.classList.toggle('show-menu');
  // disable share screen button
  shareScreen.disabled = true;
  replaceScreen.disabled = true;
  navigator.mediaDevices
    .getDisplayMedia({ cursor: true })
    .then((stream) => {
      const screenTrack = stream.getTracks()[0];
      // replaces local video sender track
      // indicates sharing screen for no video canvas replacement
      sharingScreen = true;
      connection.length &&
        connection[0].peerConnection
          .getSenders()
          .find((sender) => sender.track.kind === 'video')
          .replaceTrack(screenTrack);

      // set callback for ended track
      screenTrack.onended = function () {
        sharingScreen = false;
        shareScreen.disabled = false;
        replaceScreen.disabled = false;
        // check status of camera on / off
        if (noVideoCall) {
          // camera is off, sends canvas stream
          let originalStream = allMediaStreams.find(
            (sender) => sender.videoId === 'canvas'
          );
          let originalTrack = originalStream.mediaStream.getTracks()[0];
          // canvas media stream object holds sender from local_video
          originalStream.senders
            .find((sender) => sender.track.kind === 'video')
            .replaceTrack(originalTrack);
        } else {
          // camera is on, sends local media video
          const originalStream = allMediaStreams.find(
            (stream) => stream.videoId === 'local_video'
          );

          const originalTrack = originalStream.mediaStream.getTracks()[1];

          connection.length &&
            connection[0].peerConnection
              .getSenders()
              .find((sender) => sender.track.kind === 'video')
              .replaceTrack(originalTrack);
        }
      };
    })
    .catch(function (error) {
      console.log(error);
    });
};

const sharedScreen = () => {
  // Remove sidebar
  links.classList.toggle('show-menu');
  // disable share screen button
  shareScreen.disabled = true;
  replaceScreen.disabled = true;
  navigator.mediaDevices
    .getDisplayMedia({ cursor: true })
    .then((stream) => {
      const screenTrack = stream.getTracks()[0];
      // screen sent in a new track
      let screenSender = [];
      connection.forEach((pc) => {
        const { peerConnection } = pc;
        stream
          .getTracks()
          .forEach((track) =>
            screenSender.push(peerConnection.addTrack(track, stream))
          );
      });
      // store media stream in peer connection object
      allMediaStreams.push({
        mediaStream: stream,
        senders: screenSender,
        videoId: 'screen',
      });
      // disable share video buttons
      shareVideo.disabled = true;

      screenTrack.onended = function () {
        let canvasStream = allMediaStreams.find(
          (stream) => stream.videoId === 'screen'
        );
        // get senders from screen
        connection.forEach((pc) => {
          const { peerConnection } = pc;
          canvasStream.senders.forEach((sender) =>
            peerConnection.removeTrack(sender)
          );
        });
        // remove canvas stream object from peer connection
        allMediaStreams = allMediaStreams.filter(
          (stream) => stream.videoId !== 'screen'
        );
        // enables share screen and video buttons
        shareScreen.disabled = false;
        replaceScreen.disabled = false;
        shareVideo.disabled = false;
      };
    })
    .catch(function (error) {
      console.log(error);
    });
};

const videoCreateStream = () => {
  // share video playing
  // check whether media stream object is already created
  let myVideoStream = allMediaStreams.find(
    (stream) => stream.videoId === 'myVideo'
  );
  if (myVideoStream) {
    // when reloading the video it may trigger oncanplay
    return;
  }

  let myVideo = document.querySelector('#myVideo');
  if (!myVideo) {
    // To remove the video element the load method is being called
    // it generates another oncanplay event. Ignoring it
    return;
  }
  // does capture stream feature exist?
  if (myVideo.captureStream) {
    // capture stream
    let videoStream = myVideo.captureStream();
    setupCaptureStream(videoStream);
    // does mozcapture stream feature exist?
  } else if (myVideo.mozCaptureStream) {
    let videoStream = myVideo.mozCaptureStream();
    setupCaptureStream(videoStream);
  } else {
    console.log('captureStream() not supported');
  }
};

const setupCaptureStream = (myVideoStream) => {
  const videoTracks = myVideoStream.getVideoTracks();

  // Add tracks
  let senderSharedVideo = [];
  connection.forEach((pc) => {
    const { peerConnection } = pc;
    myVideoStream.getTracks().forEach((track) => {
      senderSharedVideo.push(peerConnection.addTrack(track, myVideoStream));
    });
  });

  console.log(senderSharedVideo);
  // store media stream object in peer connection
  allMediaStreams.push({
    mediaStream: myVideoStream,
    senders: senderSharedVideo,
    videoId: 'myVideo',
  });

  // create button to stop the media
  let buttonElement = document.createElement('button');
  buttonElement.id = 'stopVideo';
  buttonElement.className = 'menu-item stop';
  let iElement = document.createElement('i');
  iElement.className = 'fa-solid fa-stop sidebar-icon';
  let spanElement = document.createElement('span');
  spanElement.className = 'inner-text';
  spanElement.textContent = 'Stop Sharing';
  buttonElement.append(iElement, spanElement);
  // insert button
  shareScreen.parentNode.append(buttonElement);
  // add event to stop video
  buttonElement.addEventListener('click', stopVideo);

  // MediaStreamTrack.onended.
  // Call Back probably not called.
  videoTracks.onended = function () {
    for (let i = 0; i < allMediaStreams.length; i++) {
      if (allMediaStreams[i].videoId === 'myVideo') {
        allMediaStreams.splice(i, 1);
      }
    }
    connection.forEach((pc) => {
      const { peerConnection } = pc;
      peerConnection.removeTrack(senderSharedVideo);
    });
    shareVideo.disabled = false;
    if (!sharingScreen) {
      shareScreen.disabled = false;
      replaceScreen.disabled = false;
    }
    console.log('Call Back Function CALLED');
  };
};

const createVideoElement = () => {
  // disable sharing a new video
  shareVideo.disabled = true;
  // disable sharing a screen if it is not using the same stream of the video camera
  shareScreen.disabled = true;

  // hide sidebar
  links.classList.toggle('show-menu');
  // create a video element
  const vid = document.createElement('video');
  vid.id = 'myVideo';
  // create a div container and append to #videoContainer
  const videoContainer = document.createElement('div');
  videoContainer.id = 'localVideoShareContainer';
  videoContainer.className = 'localVideoShareContainer';
  const videosContainer = document.querySelector('#videoContainer');
  videosContainer.append(videoContainer);
  if (videosContainer.classList.contains('videoContainerNoChat')) {
    videosContainer.classList.add('videoContainerNoChatShare');
  } else {
    videosContainer.classList.add('videoContainerChatShare');
  }
  videoContainer.append(vid);
  vid.setAttribute('preload', 'auto');
  vid.setAttribute('poster', `${serverOrigin}/video/sintel.jpg`);
  //  vid.setAttribute('controls', true);
  vid.className = 'smallVideoM';
  const mp4 = document.createElement('source');
  mp4.setAttribute('src', `${serverOrigin}/video/sintel.mp4`);
  mp4.setAttribute('type', 'video/mp4');
  vid.append(mp4);
  const webm = document.createElement('source');
  webm.setAttribute('src', `${serverOrigin}/video/sintel.webm`);
  webm.setAttribute('type', 'video/webm');
  vid.append(webm);
  vid.innerHTML += "Sorry, your browser doesn't support embedded videos.";

  vid.addEventListener('dblclick', videoDblClick);
  vid.addEventListener('loadeddata', checkSharing);
};

const checkSharing = () => {
  // Was the stream created
  if (!allMediaStreams.find((stream) => stream.videoId === 'myVideo')) {
    let playPromise = document.querySelector('#myVideo').play();

    // In browsers that don’t yet support this functionality,
    // playPromise won’t be defined.
    if (playPromise !== undefined) {
      playPromise
        .then(function () {
          // Automatic playback started!
          videoCreateStream();
        })
        .catch(function (error) {
          // Automatic playback failed.
          console.log('automatic playblack failed');
          console.log(error);
        });
    }
  }
};

const stopVideo = () => {
  links.classList.toggle('show-menu');
  let videoElement = document.querySelector('#myVideo');

  videoElement.removeEventListener('loadeddata', checkSharing);
  let originalStream = allMediaStreams.find(
    (mediaStream) => mediaStream.videoId === 'myVideo'
  );

  // In case the video share did not succeed we remove it
  // but the stream may not be built
  if (originalStream) {
    connection.forEach((pc) => {
      const { peerConnection } = pc;
      originalStream.senders.forEach((track) => {
        peerConnection.removeTrack(track);
      });
    });

    allMediaStreams = allMediaStreams.filter(
      (mediaStream) => mediaStream.videoId !== 'myVideo'
    );
    document.querySelector('#stopVideo').remove();
  }
  videoElement.pause();
  videoElement.currentTime = 0;
  videoElement.textContent = '';
  videoElement.srcObject = null;
  videoElement.load();
  videoElement.remove();
  // Change grid layout for regular videos
  const videoContainer = document.querySelector('#videoContainer');
  if (videoContainer.classList.contains('videoContainerNoChat')) {
    videoContainer.classList.remove('videoContainerNoChatShare');
  } else {
    videoContainer.classList.remove('videoContainerChatShare');
  }
  // remove container for video sharing
  document.querySelector('.localVideoShareContainer').remove();
  shareVideo.disabled = false;

  if (!sharingScreen) {
    shareScreen.disabled = false;
    replaceScreen.disabled = false;
  }
};

const videoDblClick = (event) => {
  event.preventDefault();
  event.stopPropagation();
  const t = event.target;
  t.classList.toggle('fullScreen');
  if (t.parentNode.id === 'localVideoContainer') {
    t.parentNode.classList.toggle('fullScreenLocal');
    // set canvas width and height accordingly otherwise its
    // size won't match the video when changing its size
    canvasOverlay.width = t.offsetWidth;
    canvasOverlay.height = t.offsetHeight;
  }
};

const muteLocalVideo = (event) => {
  const t = event.target;
  // console.log(t.nodeName, t.parentNode);
  if (t.nodeName === 'IMG') {
    t.parentNode.classList.toggle('unmute');
  } else {
    t.classList.toggle('unmute');
  }
  connection.length &&
    connection[0].peerConnection.getSenders().forEach((sender) => {
      if (sender.track.kind === 'audio') {
        sender.track.enabled = video.muted;
      }
    });
  console.log(video.muted);
  video.muted = !video.muted;
  console.log(video.muted);
};

export { partySide, callToken };
