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

import {
  setDataChannel,
  onDataChannel,
  dataChannel,
  toggleCanvasChat,
} from './chat.js';

let callToken = '';
let socket;
let peerConnection;
let virtualCanvas = null;
let allMediaStreams = [];
let senders = [];
let connection = [];
let screenReplaceVideo = localStorage.getItem('replace') === 'sameVideo';
let noCameraMode = false;
let sharingScreen = false;
let partySide = '';
let serverOrigin = '';
let webSocketOrigin = '';
const isSFU = false;
const localVideo = document.getElementById('local_video');
const toggleButton = document.getElementById('toggleVideo');
const canvasOverlay = document.querySelector('#canvasOverlay');
const index = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
let signalLocal = null;
let clientLocal = null;

class PeerConnection {
  constructor(callToken, peerConnection, mediaStream) {
    this.token = callToken;
    this.peerConnection = peerConnection;
    this.mediaStream = mediaStream;
  }
}

window.onload = function init() {
  // Load token provided in the home page
  callToken = localStorage.getItem('callToken');
  serverOrigin = document.location.origin;
  if (isSFU) {
    webSocketOrigin = 'ws://localhost:7000/ws';
  } else {
    webSocketOrigin = `wss://${document.location.host}`;
  }
  let configuration = {
    iceservers: [{ urls: 'stun:stun.l.google.com:19302' }],
  };

  if (isSFU) {
    signalLocal = new Signal.IonSFUJSONRPCSignal(webSocketOrigin);
    clientLocal = new IonSDK.Client(signalLocal, configuration);
    // signalLocal.onopen = () => clientLocal.join(params.has("session") ? params.get("session") : "ion");
    signalLocal.onopen = () => clientLocal.join('ion');

    clientLocal.ontrack = (track, stream) => {
      console.log('got track', track.id, 'for stream', stream.id);
      if (track.kind === 'video') {
        console.log('track is video');
        console.log(allMediaStreams);
        // If the stream is not there in the streams map.
        if (
          !allMediaStreams.length ||
          !allMediaStreams.find(
            (streamObj) => streamObj.mediaStream.id === stream.id
          )
        ) {
          // Are there any screen positions left?
          const videoContainer = document.querySelector('#videoContainer');
          const divContainer = document.createElement('div');
          if (index.length > 0) {
            // Create a video element for rendering the stream
            const remoteVideo = document.createElement('video');
            remoteVideo.id = 'remote_video';
            remoteVideo.srcObject = stream;
            remoteVideo.className = 'smallVideoR';
            remoteVideo.autoplay = true;
            // remoteVideo.muted = remoteVideoIsMuted;
            // remotesDiv.appendChild(remoteVideo);
            let screenIndex = index.shift();
            divContainer.className = `remoteVideoContainer position-${
              screenIndex + 1
            }`;
            divContainer.appendChild(remoteVideo);
            // Insert video in the DOM
            videoContainer.appendChild(divContainer);
            // Save the stream and video element in the map.
            allMediaStreams.push({
              mediaStream: stream,
              videoElement: remoteVideo,
              screenIndex,
            });
          } else {
            // No screen positions left.
            // ignore the stream for now.
          }

          // When this stream removes a track, assume
          // that its going away and remove it.
          stream.onremovetrack = () => {
            try {
              const streamObj = allMediaStreams.find(
                (streamObj) => streamObj.mediaStream.id === stream.id
              );
              if (streamObj) {
                console.log('Entered remove track');
                const { videoElement } = streamObj;
                divContainer.removeChild(videoElement);
                videoContainer.removeChild(divContainer);
                index.push(streamObj.screenIndex);
                index.sort();
                allMediaStreams = allMediaStreams.filter(
                  (streamObj) => streamObj.mediaStream.id !== stream.id
                );
              }
            } catch (err) {}
          };
        }
      }
    };
  } else {
    // NO SFU - pc is handled by the app
    peerConnection = new RTCPeerConnection(configuration);
    console.log(`The peerConnection is: ${peerConnection}`);
    let receivers = peerConnection.getReceivers();
    // console.log(receivers);

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
        'Negotiation Needed. IceConnectionState is: ' +
          peerConnection.iceConnectionState
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
      } catch (err) {
        log_error(err);
      }
    };

    peerConnection.ontrack = function (event) {
      console.log('ontrack called. The event is:');
      console.log(event);
      const track = event.track;
      const type = track.kind;
      // console.log(type);

      let remoteVideoCreated = allMediaStreams.find(
        (streamObj) => streamObj.videoId === 'remote_video'
      );
      let videoShare = allMediaStreams.find(
        (streamObj) => streamObj.videoId === 'video_share'
      );
      if (!remoteVideoCreated) {
        let remote_video = 'remote_video';

        // Create remote video from peer
        remoteVideoCreated = createVideo(remote_video, event);

        // Save mediaStream from remote
        allMediaStreams.push({
          mediaStream: remoteVideoCreated.stream,
          videoId: 'remote_video',
          videoElement: remoteVideoCreated.videoElement,
        });

        // Enable hangup button
        let hangup = document.getElementById('hangup');
        hangup.disabled = false;
        hangup.addEventListener('click', hangUpCall);

        // Enable mute button
        let mute = document.querySelector('#mute');
        mute.disabled = false;

        // Allow video to be shared with remote
        let shareVideo = document.querySelector('#shareVideo');
        shareVideo.disabled = false;
        shareVideo.addEventListener('click', createVideoElement);

        // Allow screen to be shared with remote
        let shareScreen = document.getElementById('sharescreen');
        shareScreen.disabled = false;
        shareScreen.addEventListener('click', sharedScreen);

        // Enable canvas message to be selected
        let canvasChat = document.getElementById('canvasChat');
        canvasChat.disabled = false;
        canvasChat.addEventListener('click', toggleCanvasChat);

        // Remote video has additional streams to add
      } else if (remoteVideoCreated.mediaStream.id === event.streams[0].id) {
        document.querySelector('#remote_video').srcObject = event.streams[0];
        receivers = peerConnection.getReceivers();
        // console.log(receivers);

        // If on track is not from remote video camera it should be from a video
        // or screen sharing
      } else if (!videoShare) {
        let video_share = 'video_share';
        videoShare = createVideo(video_share, event);
        allMediaStreams.push({
          mediaStream: videoShare.stream,
          videoId: 'video_share',
          videoElement: videoShare.videoElement,
        });
        console.log('Shared Video Arrived');

        document.querySelector('#shareVideo').disabled = true;

        if (!screenReplaceVideo) {
          document.getElementById('sharescreen').disabled = true;
        }
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
        let stateElem = document.querySelector('#call-state');
        stateElem.className = `${peerConnection.iceConnectionState}-state`;

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
              closeVideoCall();
              break;
            case 'failed':
              console.log('Call failed');
              closeVideoCall();
              break;
            case 'disconnected':
              console.log('State disconnected. May be temporary.');
              break;
          }
        }
      },
      false
    );
  }
  // nav-toggle is the button to open the menu
  const navToggle = document.querySelector('.nav-toggle');
  // menu that is opened when the button is clicked
  const links = document.querySelector('.menu');
  navToggle.addEventListener('click', function (evt) {
    // when the button is clicked, the menu is opened
    // by addding the class show-menu
    if (evt.target.parentNode === navToggle || evt.target === navToggle) {
      links.classList.toggle('show-menu');
      evt.stopPropagation();
    }
  });

  // Enable settings button inside the menu
  let settings = document.getElementById('settings');
  settings.addEventListener('click', () => {
    document.location = `${serverOrigin}/settings.html`;
  });

  // add event listener to hide the menu with a canvas
  toggleButton.addEventListener('click', toggleVideo);
  // disable toggle video and settings buttons
  // document.getElementById('toggleVideo').disabled = true;
  // document.getElementById('settings').disabled = true;

  // Prepare constraints for video and audio
  const constraintSFU = {
    // resolution: 'vga',
    audio: true,
    video: {
      width: {
        min: 640,
        max: 1024,
      },
      height: {
        min: 360,
        max: 768,
      },
    },
    codec: 'vp8',
    sendCanvasOnMute: { empty: false, drawImage: draw2Canvas }, //TODO interval value? capture stream value?
    // sendCanvasOnMute: { empty: true, drawImage: simpleDraw2Canvas }, //TODO interval value?
    // simulcast: true,
    // codec: params.has("codec") ? params.get("codec") : "vp8",
  };

  const constraint = {
    audio: true,
    video: {
      width: {
        min: 640,
        max: 1024,
      },
      height: {
        min: 360,
        max: 768,
      },
    },
  };

  // getusermedia
  if (isSFU) {
    IonSDK.LocalStream.getUserMedia(constraintSFU)
      .then((media) => {
        localVideo.srcObject = media;
        localVideo.autoplay = true;
        localVideo.controls = true;
        localVideo.muted = true;
        // joinBtns.style.display = "none";
        clientLocal.publish(media);
        // save local media in the peer connection object
        let localStreamObj = {
          mediaStream: media,
          videoId: 'local_video',
          videoElement: localVideo,
        };
        allMediaStreams.push(localStreamObj);
        if (noCameraMode) {
          localVideo.oncanplay = () => {
            media.mute('video');
            // replace local media video stream with canvas stream
            // toggle camera is enabled
            toggleButton.disabled = false;
            // Set the button background to red
            toggleButton.classList.toggle('mute');
            canvasOverlay.classList.add('frontVideo');
          };
        }
      })
      .catch(console.error);
  } else {
    navigator.mediaDevices
      .getUserMedia(constraint)
      .then(function (stream) {
        console.log('stream', stream);
        // start with the audio stream muted
        stream.getAudioTracks()[0].enabled = false;
        // add full screen handling
        localVideo.addEventListener('dblclick', videoDblClick);
        localVideo.style.backgroundColor = 'transparent';
        // start stream in the local video
        localVideo.srcObject = stream;
        localVideo.onloadedmetadata = function (e) {
          localVideo.play();
        };
        // save senders for easy replacing later
        stream
          .getTracks()
          .forEach((track) =>
            senders.push(peerConnection.addTrack(track, stream))
          );
        // save local media in the stream object array
        let localStreamObject = {
          mediaStream: stream,
          senders: senders,
          videoId: 'local_video',
          videoElement: localVideo,
        };
        allMediaStreams.push(localStreamObject);
        // create webSocket. The nodejs index.js application will handle it
        socket = new WebSocket(`${webSocketOrigin}`);

        // if no-video mode selected send canvas stream instead
        // wait video to start to touch it
        if (noCameraMode) {
          localVideo.oncanplay = () => {
            const canvasStreamObj = canvasCreateStream();
            // replace local media video stream with canvas stream
            localStreamObject.senders
              .find((sender) => sender.track.kind === 'video')
              .replaceTrack(canvasStreamObj.mediaStream.getVideoTracks()[0]);

            // Let the canvas overlay the local_video
            // with the same virtual canvas sent to the peer.
            canvasOverlay.classList.add('frontVideo');
            // localVideo.mute = true;

            // toggle camera is enabled
            toggleButton.disabled = false;
            // Set the button background to red
            toggleButton.classList.toggle('mute');
            // set timeout to redraw canvas every 100 ms
            // or remote video may not start
            setTimeout(drawCanvas, 100);
          };
        }

        // toggle video button is enabled
        toggleButton.disabled = false;
        let mute = document.querySelector('#mute');
        // create event listener to toggle audio
        mute.addEventListener('click', muteLocalVideoAudioTrack);

        // if there is no hash code this is a caller leg
        if (
          document.location.hash === '' ||
          document.location.hash === undefined
        ) {
          // Caller leg
          partySide = 'caller';

          if (dataChannel === null) {
            setDataChannel();
          }

          connection.push = new PeerConnection(
            callToken,
            peerConnection,
            allMediaStreams
          );

          if (callToken === '' || callToken === undefined) {
            alert('meeting code not provided');
            document.location = `${serverOrigin}`;
          }
          // set location.hash to the unique token for this call
          console.log(callToken);
          document.location.hash = callToken;

          socket.onopen = function () {
            socket.onmessage = callerSignalling;

            socket.send(
              JSON.stringify({
                token: callToken,
                type: 'join',
              })
            );
          };

          document.title = 'Caller Leg';
        } else {
          // Callee Leg
          partySide = 'callee';
          // Set listeners for data channel
          peerConnection.ondatachannel = onDataChannel;

          callToken = document.location.hash;
          callToken = callToken.slice(1);

          connection.push = new PeerConnection(
            callToken,
            peerConnection,
            allMediaStreams
          );

          socket.onopen = function () {
            socket.onmessage = calleeSignalling;

            // This message is for the server link me to the token
            socket.send(
              JSON.stringify({
                token: callToken,
                type: 'join',
              })
            );

            // let the peer know this leg is ready to start the call
            socket.send(
              JSON.stringify({
                token: callToken,
                type: 'callee_arrived',
              })
            );
          };

          document.title = 'Callee Leg';
        }
      })
      .catch(handleGetUserMediaError);
  }
};
/*
 *
 *   functions used above are defined below
 *
 */
function toggleVideo() {
  // Is the button in the no video mode?
  if (!noCameraMode) {
    // Set to no camera mode
    noCameraMode = true;
    // Set the button background red
    toggleButton.classList.toggle('mute');
    // Get local video stream object
    let originalStream = allMediaStreams.find(
      (stream) => stream.videoId === 'local_video'
    );
    // Is local media already started?
    // otherwise, do not replace media
    if (originalStream) {
      // bring the canvas overlay in front of the local video
      canvasOverlay.classList.add('frontVideo');
      // Local media already started
      if (!virtualCanvas && !isSFU) {
        // Create the virtual canvas
        canvasCreateStream();
      }
      // if sharing screen is in place do not send canvas
      if (!sharingScreen) {
        if (isSFU) {
          originalStream.mediaStream.mute('video');
        } else {
          let canvasStream = allMediaStreams.find(
            (sender) => sender.videoId === 'canvas'
          );
          // originalStream.mediaStream.addTrack(
          //   canvasStream.mediaStream.getVideoTracks()[0]
          // );
          // originalStream.mediaStream.removeTrack(
          //   originalStream.mediaStream.getVideoTracks()[0]
          // );
          // originalStream.mediaStream.getVideoTracks()[0].stop();
          originalStream.senders
            .find((sender) => sender.track.kind === 'video')
            .replaceTrack(canvasStream.mediaStream.getVideoTracks()[0]);

          // set timeout to redraw canvas, otherwise the remote side
          // does not start the video
          setTimeout(drawCanvas, 500);
        }
      }
    }
    // setting call to no video mode
  } else {
    noCameraMode = false;
    // Set the button  background to white
    toggleButton.classList.toggle('mute');
    // move the canvas overlay to the back
    canvasOverlay.classList.remove('frontVideo');
    // Has the local media started?
    let originalStream = allMediaStreams.find(
      (sender) => sender.videoId === 'local_video'
    );

    if (originalStream) {
      // local media already started
      // if sharing screen is in place do not do anything else
      // otherwise, replace canvas with camera
      if (!sharingScreen) {
        if (isSFU) {
          originalStream.mediaStream.unmute('video');
        } else {
          let originalTrack = originalStream.mediaStream.getTracks()[1];

          originalStream.senders
            .find((sender) => sender.track.kind === 'video')
            .replaceTrack(originalTrack);
        }
      }
    }
  }
}
function canvasCreateStream() {
  // create canvas with the same video dimensions to avoid
  // renegotiation
  let width = localVideo.videoWidth;
  let height = localVideo.videoHeight;
  virtualCanvas = Object.assign(document.createElement('canvas'), {
    width,
    height,
  });
  // draw a rectangule on the whole canvas
  virtualCanvas.getContext('2d').fillRect(0, 0, width, height);

  // capture canvas stream
  let mediaSource = virtualCanvas.captureStream(10);
  // store canvas information on peer connection object
  let canvasStreamObj = {
    mediaStream: mediaSource,
    videoId: 'canvas',
  };
  allMediaStreams.push(canvasStreamObj);
  return canvasStreamObj;
}

function drawCanvas() {
  if (!noCameraMode) return;
  let ctx = virtualCanvas.getContext('2d');
  ctx.save();
  ctx.fillStyle = 'rgb(21,14,86)';
  // let video = document.querySelector('#local_video');
  let width = localVideo.videoWidth;
  let height = localVideo.videoHeight;
  ctx.clearRect(0, 0, width, height);
  ctx.fillRect(0, 0, width, height);
  let login = localStorage.getItem('login');
  // console.log(login);
  let char = '0';

  if (login != '' && login != null) {
    char = login.charAt(0).toUpperCase();
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
  let canvasOverlayCtx = canvasOverlay.getContext('2d');

  canvasOverlayCtx.drawImage(
    virtualCanvas,
    0,
    0,
    localVideo.offsetWidth,
    localVideo.offsetHeight
  );

  setTimeout(drawCanvas, 100);
}
function simpleDraw2Canvas(canvas, width, height) {
  let ctx = canvas.getContext('2d');
  ctx.save();
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}
function draw2Canvas(canvas, width, height) {
  let ctx = canvas.getContext('2d');
  ctx.save();
  ctx.fillStyle = 'rgb(21,14,86)';
  let video = document.querySelector('#local_video');
  ctx.clearRect(0, 0, width, height);
  ctx.fillRect(0, 0, width, height);
  let login = localStorage.getItem('login');
  let char = '0';

  if (login != '' && login != null) {
    char = login.charAt(0).toUpperCase();
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
  let canvasOverlayCtx = canvasOverlay.getContext('2d');

  canvasOverlayCtx.drawImage(
    canvas,
    0,
    0,
    video.offsetWidth,
    video.offsetHeight
  );
}
function handleGetUserMediaError(e) {
  switch (e.name) {
    case 'NotFoundError':
      alert(
        'Unable to open your call because no camera and/or microphone were found.'
      );
      break;
    case 'SecurityError':
    case 'PermissionDeniedError':
      // Do nothing; this is the same as the user canceling the call.
      break;
    default:
      alert('Error opening your camera and/or microphone: ' + e.message);
      break;
  }

  closeVideoCall();
}

// handle signals as a caller
function callerSignalling(event) {
  var signal = JSON.parse(event.data);
  if (signal.type === 'callee_arrived') {
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
      .catch(function (err) {
        log_error(err);
      });
  } else if (signal.type === 'ice-candidate') {
    console.log('New ice-candidate message received.');
    peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
  } else if (signal.type === 'description') {
    console.log(
      'New description message received. Set remote description. Type is ' +
        signal.sdp.type
    );
    if (signal.sdp.type === 'answer') {
      peerConnection
        .setRemoteDescription(signal.sdp)
        .then(function () {
          console.log('Remote Session Description set.');
        })
        .catch(function (err) {
          log_error(err);
        });
    } else {
      peerConnection
        .setRemoteDescription(signal.sdp)
        .then(function () {
          console.log('Remote Session Description set. Creating answer');
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
        .catch(function (err) {
          log_error(err);
        });
    }
  } else if (signal.type === 'hang-up') {
    console.log('Received hang up notification from other peer');
    closeVideoCall();
  } else {
    console.log('Non-handled ' + signal.type + ' received');
  }
}

// handle signals as a callee

function calleeSignalling(event) {
  var signal = JSON.parse(event.data);
  if (signal.type === 'ice-candidate') {
    console.log('New Ice Candidate message received.');
    peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
  } else if (signal.type === 'description') {
    console.log(
      'New description message received. Set remote description. Type is ' +
        signal.sdp.type
    );
    if (signal.sdp.type === 'offer') {
      peerConnection
        .setRemoteDescription(signal.sdp)
        .then(function () {
          console.log('Remote Session Description set. Creating answer');
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
        .catch(function (err) {
          log_error(err);
        });
    } else {
      peerConnection
        .setRemoteDescription(signal.sdp)
        .then(function () {
          console.log('Remote Session Description set.');
        })
        .catch(function (err) {
          log_error(err);
        });
    }
  } else if (signal.type === 'hang-up') {
    console.log('Received hang up notification from other peer');
    closeVideoCall();
  } else {
    console.log('Non-handled ' + signal.type + ' received');
  }
}

// generic error handler
function log_error(error) {
  console.log(error);
}
/**
 * createVideo is called when ontrack event fires in the receiver
 * side to create the video element. It passes the video #id for
 * this video (remote_video, for the peer connection media,  or video_share
 * for remote video or screen share) and the on track event. It returns the
 * ontrack event.streams[0], to store on allMediaStreams for subsequent ontrack
 * events for the same stream.
 *
 * @param {*} videoid
 * @param {*} event
 * @return {*}
 */
function createVideo(videoid, event) {
  // creates a video element
  let vid = document.createElement('video');
  // add the #id for this particular video
  vid.id = videoid;
  vid.className = 'smallVideoR';
  vid.setAttribute('autoplay', true);
  // vid.setAttribute('controls', true);
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

  return { stream: event.streams[0], videoElement: vid };
}
// This function checks if a track was removed to
// remove sharing video elements
function checkRemoveTrack() {
  let timeout = true;
  const oneMediaStream = allMediaStreams.find(
    (streamObj) => streamObj.videoId === 'video_share'
  );

  const videoTracks = oneMediaStream.mediaStream.getTracks();

  if (!videoTracks.length) {
    // Remove object
    allMediaStreams = allMediaStreams.filter(
      (streamObj) => streamObj.videoId !== 'video_share'
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

    document.querySelector('#shareVideo').disabled = false;
    if (!sharingScreen) {
      document.querySelector('#sharescreen').disabled = false;
    }
  }
  if (timeout) {
    setTimeout(checkRemoveTrack, 1000);
  }
}

function closeVideoCall() {
  console.log('Closing Video Call');
  const remoteVideo = document.getElementById('remote_video');
  // const localVideo = document.getElementById('local_video');
  const callState = document.querySelector('#call-state');

  if (peerConnection) {
    peerConnection.ontrack = null;
    peerConnection.onremovetrack = null;
    peerConnection.onremovestream = null;
    peerConnection.onicecandidate = null;
    peerConnection.oniceconnectionstatechange = null;
    peerConnection.onsignalingstatechange = null;
    peerConnection.onicegatheringstatechange = null;
    peerConnection.onnegotiationneeded = null;

    if (remoteVideo && remoteVideo.srcObject) {
      remoteVideo.srcObject.getTracks().forEach((track) => track.stop());
      remoteVideo.srcObject = null;
      remoteVideo.style.backgroundColor = '#333333';
      remoteVideo.removeAttribute('src');
      remoteVideo.removeAttribute('srcObject');
    }

    if (localVideo.srcObject) {
      localVideo.srcObject.getTracks().forEach((track) => track.stop());
      localVideo.srcObject = null;
      localVideo.style.backgroundColor = '#333333';
    }

    peerConnection.close();
    peerConnection = null;
  }

  localVideo.removeAttribute('src');

  document.getElementById('hangup').disabled = true;
  document.getElementById('sharescreen').disabled = true;
  document.querySelector('#mute').disabled = true;
  document.querySelector('#shareVideo').disabled = true;
  callState.style.backgroundColor = 'honeydew';
}

function hangUpCall() {
  socket.send(
    JSON.stringify({
      token: callToken,
      type: 'hang-up',
    })
  );
  closeVideoCall();
}

// Share screen using either local media stream replace
// or a new video
function sharedScreen() {
  // Remove sidebar
  document.querySelector('.menu').classList.toggle('show-menu');
  // disable share screen button
  document.querySelector('#sharescreen').disabled = true;
  navigator.mediaDevices
    .getDisplayMedia({ cursor: true })
    .then((stream) => {
      const screenTrack = stream.getTracks()[0];
      if (screenReplaceVideo) {
        // replaces local video sender track
        // indicates sharing screen for no video canvas replacement
        sharingScreen = true;
        let originalStream = allMediaStreams.find(
          (streamObj) => streamObj.videoId === 'local_video'
        );
        // console.log('Original stream is: ');
        // console.log(originalStream);
        originalStream.senders
          .find((sender) => sender.track.kind === 'video')
          .replaceTrack(screenTrack);

        // set callback for ended track
        screenTrack.onended = function () {
          sharingScreen = false;
          document.querySelector('#sharescreen').disabled = false;
          // check status of camera on / off
          if (noCameraMode) {
            // camera is off, sends canvas stream
            let originalStream = allMediaStreams.find(
              (streamObj) => streamObj.videoId === 'canvas'
            );
            let originalTrack = originalStream.mediaStream.getTracks()[0];
            // canvas media stream object holds sender from local_video
            originalStream.senders
              .find((sender) => sender.track.kind === 'video')
              .replaceTrack(originalTrack);
          } else {
            // camera is on, sends local media video
            let originalStream = allMediaStreams.find(
              (streamObj) => streamObj.videoId === 'local_video'
            );

            let originalTrack = originalStream.mediaStream.getTracks()[1];

            originalStream.senders
              .find((sender) => sender.track.kind === 'video')
              .replaceTrack(originalTrack);
          }
        };
      } else {
        // screen sent in a new track
        let screenSender = [];
        stream
          .getTracks()
          .forEach((track) =>
            screenSender.push(peerConnection.addTrack(track, stream))
          );
        // store media stream in peer connection object
        allMediaStreams.push({
          mediaStream: stream,
          senders: screenSender,
          videoId: 'screen',
        });
        // disable share video buttons
        document.querySelector('#shareVideo').disabled = true;

        screenTrack.onended = function () {
          let canvasStream = allMediaStreams.find(
            (stream) => stream.videoId === 'screen'
          );
          // get senders from screen
          canvasStream.senders.forEach((sender) =>
            peerConnection.removeTrack(sender)
          );
          // remove canvas stream object from peer connection
          allMediaStreams = allMediaStreams.filter(
            (stream) => stream.videoId !== 'screen'
          );
          // enables share screen and video buttons
          document.querySelector('#sharescreen').disabled = false;
          document.querySelector('#shareVideo').disabled = false;
        };
      }
    })
    .catch(function (err) {
      log_error(err);
    });
}

function videoCreateStream() {
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
}

function setupCaptureStream(myVideoStream) {
  const videoTracks = myVideoStream.getVideoTracks();

  // Add tracks
  let senderSharedVideo = [];
  myVideoStream
    .getTracks()
    .forEach((track) =>
      senderSharedVideo.push(peerConnection.addTrack(track, myVideoStream))
    );

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
  let shareScreenElement = document.querySelector('#sharescreen');
  shareScreenElement.parentNode.append(buttonElement);
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
    peerConnection.removeTrack(senderSharedVideo);
    document.querySelector('#shareVideo').disabled = false;
    if (screenSharing) document.querySelector('#sharescreen').disabled = false;
    console.log('Call Back Function CALLED');
  };
}

function createVideoElement() {
  // disable sharing a new video
  document.querySelector('#shareVideo').disabled = true;
  // disable sharing a screen if it is not using the same stream of the video camera
  if (!screenReplaceVideo) {
    document.querySelector('#sharescreen').disabled = true;
  }

  // hide sidebar
  document.querySelector('.menu').classList.toggle('show-menu');
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
}

function checkSharing() {
  // Was the stream created
  if (!allMediaStreams.find((streamObj) => streamObj.videoId === 'myVideo')) {
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
          log_error(error);
        });
    }
  }
}

function stopVideo() {
  document.querySelector('.menu').classList.toggle('show-menu');
  let videoElement = document.querySelector('#myVideo');

  videoElement.removeEventListener('loadeddata', checkSharing);
  let originalStream = allMediaStreams.find(
    (streamObj) => streamObj.videoId === 'myVideo'
  );

  // In case the video share did not succeed we remove it
  // but the stream may not be built
  if (originalStream) {
    originalStream.senders.forEach((track) => {
      peerConnection.removeTrack(track);
    });

    allMediaStreams = allMediaStreams.filter(
      (streamObj) => streamObj.videoId !== 'myVideo'
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
  document.querySelector('#shareVideo').disabled = false;

  if (!sharingScreen) {
    document.querySelector('#sharescreen').disabled = false;
  }
}

function videoDblClick(event) {
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
}

function muteLocalVideoAudioTrack(event) {
  console.log('mutelocalvideo');
  console.log(allMediaStreams);
  const mediaStream = allMediaStreams.find(
    (streamObj) => streamObj.videoId === 'local_video'
  );

  const t = event.target;
  // console.log(t.nodeName, t.parentNode);
  if (t.nodeName === 'IMG') {
    t.parentNode.classList.toggle('unmute');
  } else {
    t.classList.toggle('unmute');
  }
  if (localVideo.muted) {
    localVideo.muted = false;
    console.log(mediaStream);
    mediaStream.senders.map((sender) => {
      if (sender.track.kind === 'audio') {
        sender.track.enabled = true;
      }
    });
  } else {
    localVideo.muted = true;
    mediaStream.senders.map((sender) => {
      if (sender.track.kind === 'audio') {
        sender.track.enabled = false;
      }
    });
  }
  // console.log(`Local video is muted: ${vid.muted}`);
}

export { peerConnection, partySide, callToken };
