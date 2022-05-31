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
let noVideoCall = false;
let sharingScreen = false;
let partySide = '';
let serverOrigin = '';
let webSocketOrigin = '';
const isSFU = false;
let streamsSFU = [];
const localVideo = document.getElementById('local_video');
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
      track.onunmute = () => {
        // If the stream is not there in the streams map.
        if (!allMediaStreams[stream.id]) {
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
            console.log(index);
            let screenIndex = index.shift();
            divContainer.className = `remoteVideoContainer position-${
              screenIndex + 1
            }`;
            divContainer.appendChild(remoteVideo);
            // Insert video in the DOM
            videoContainer.appendChild(divContainer);
            // Save the stream and video element in the map.
            allMediaStreams[stream.id] = {
              mediaStream: stream,
              videoElement: remoteVideo,
              screenIndex,
            };
          } else {
            // No screen positions left.
            // ignore the stream.
          }

          // When this stream removes a track, assume
          // that its going away and remove it.
          stream.onremovetrack = () => {
            try {
              if (allMediaStreams[stream.id]) {
                console.log('Entered remove track');
                const { videoElement } = allMediaStreams[stream.id];
                divContainer.removeChild(videoElement);
                videoContainer.removeChild(divContainer);
                index.push(allMediaStreams[stream.id].screenIndex);
                index.sort();
                delete allMediaStreams[stream.id];
              }
            } catch (err) {}
          };
        }
      };
    };
  } else {
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
        (stream) => stream.videoId === 'remote_video'
      );
      let videoShare = allMediaStreams.find(
        (stream) => stream.videoId === 'video_share'
      );
      if (!remoteVideoCreated) {
        let remote_video = 'remote_video';

        // Create remote video from peer
        remoteVideoCreated = createVideo(remote_video, event);

        // Save mediaStream from remote
        allMediaStreams.push({
          mediaStream: remoteVideoCreated,
          videoId: 'remote_video',
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
          mediaStream: videoShare,
          videoId: 'video_share',
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
  const navToggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.menu');
  navToggle.addEventListener('click', function (evt) {
    // console.log(evt.target);
    if (evt.target.parentNode === navToggle || evt.target === navToggle) {
      links.classList.toggle('show-menu');
      evt.stopPropagation();
    }
  });

  let settings = document.getElementById('settings');
  settings.addEventListener('click', () => {
    document.location = `${serverOrigin}/settings.html`;
  });

  const toggleButton = document.getElementById('toggleVideo');
  toggleButton.addEventListener('click', toggleVideo);

  const constraintSFU = {
    resolution: 'hd',
    audio: true,
    codec: 'vp8',
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
        min: 480,
        max: 768,
      },
    },
  };

  // disable toggle video and settings buttons
  document.getElementById('toggleVideo').disabled = true;
  // document.getElementById('settings').disabled = true;

  // getusermedia
  if (isSFU) {
    let localStream;
    IonSDK.LocalStream.getUserMedia(constraintSFU)
      .then((media) => {
        localStream = media;
        localVideo.srcObject = media;
        localVideo.autoplay = true;
        localVideo.controls = true;
        localVideo.muted = true;
        // joinBtns.style.display = "none";
        clientLocal.publish(media);
        // save local media in the peer connection object
        allMediaStreams[media.id] = {
          mediaStream: media,
          senders: null,
          videoId: 'local_video',
          videoElement: localVideo,
        };
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
        localVideo.play();
        // save senders for easy replacing later
        stream
          .getTracks()
          .forEach((track) =>
            senders.push(peerConnection.addTrack(track, stream))
          );
        // save local media in the peer connection object
        allMediaStreams[streams.id] = {
          mediaStream: stream,
          senders: senders,
          videoId: 'local_video',
          videoElement: localVideo,
        };
      })
      .catch(handleGetUserMediaError);

    // if no video mode selected send canvas stream instead
    // wait video to start to touch it
    if (noVideoCall) {
      video.oncanplay = canvasCreateStream;
    }
    function canvasCreateStream() {
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
      let mediaSource = virtualCanvas.captureStream();
      // capture black rectangule from the canvas
      let blackVideoTrack = mediaSource.getVideoTracks()[0];
      // console.log('black video track:');
      // console.log(blackVideoTrack);
      let noVideoStream = allMediaStreams.find(
        (stream) => stream.videoId === 'local_video'
      );
      // store canvas information on peer connection object
      // senders from the local_video
      allMediaStreams[mediaSource.id] = {
        mediaStream: mediaSource,
        senders: noVideoStream.senders,
        videoId: 'canvas',
      };
      // console.log('noVideoStream stream is: ');
      // console.log(noVideoStream);
      // replace local media video stream with canvas stream
      noVideoStream.senders
        .find((sender) => sender.track.kind === 'video')
        .replaceTrack(blackVideoTrack);

      // Let the canvas overlay the local_video
      // with the same virtual canvas sent to the peer.
      let canvasOverlay = document.querySelector('#canvasOverlay');
      canvasOverlay.classList.add('frontVideo');

      // toggle video is enabled again
      document.getElementById('toggleVideo').disabled = false;
      // set timeout to redraw canvas every 100 ms
      // or remote video may not start
      setTimeout(drawCanvas, 100);
      virtualCanvas.getContext('2d').fillRect(0, 0, width, height);
    }

    // toggle video button is enabled
    document.getElementById('toggleVideo').disabled = false;
    let mute = document.querySelector('#mute');
    // create event listener to toggle audio
    mute.addEventListener('click', muteLocalVideo);

    // create webSocket. The nodejs index.js application will handle it
    // it currently handles http and ws
    socket = new WebSocket(`${webSocketOrigin}`);

    // if there is no hash code this is a caller leg
    if (document.location.hash === '' || document.location.hash === undefined) {
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
  }
};
/* functions used above are defined below */
function toggleVideo() {
  // Is the button in the no video mode?
  if (!noVideoCall) {
    // Call already set to no camera mode
    // enable camera again
    noVideoCall = true;
    // toggle the button background red
    toggleButton.classList.toggle('mute');
    let originalStream = null;
    originalStream = allMediaStreams.find(
      (stream) => stream.videoId === 'local_video'
    );
    // The local media already started?
    // otherwise, do not do anything else
    if (originalStream) {
      // Local media already started
      if (!virtualCanvas) {
        // Create the virtual canvas
        let video = document.getElementById('local_video');
        let width = video.videoWidth;
        let height = video.videoHeight;
        // Create the canvas with the same dimensions of the video to avoid
        // renegotiation
        virtualCanvas = Object.assign(document.createElement('canvas'), {
          width,
          height,
        });
        // draw a rectangule on the canvas
        virtualCanvas.getContext('2d').fillRect(0, 0, width, height);
        // capture canvas stream
        let mediaSource = virtualCanvas.captureStream(10);
        // store the media information with the sender of local_video
        allMediaStreams[mediaSource.id] = {
          mediaStream: mediaSource,
          senders: originalStream.senders,
          videoId: 'canvas',
        };
      }
      const canvasOverlay = document.querySelector('#canvasOverlay');
      canvasOverlay.classList.add('frontVideo');
      // if sharing screen is in place do not send canvas
      if (!sharingScreen) {
        let canvasStream = allMediaStreams.find(
          (sender) => sender.videoId === 'canvas'
        );
        originalStream.senders
          .find((sender) => sender.track.kind === 'video')
          .replaceTrack(canvasStream.mediaStream.getVideoTracks()[0]);
        // bring the canvas overlay in front of the local video
      }
      // set timeout to redraw canvas, otherwise the remote side
      // does not start the video
      setTimeout(drawCanvas, 500);
    }
    // setting call to no video mode
  } else {
    noVideoCall = false;
    // toggle the button to white
    toggleButton.classList.toggle('mute');
    // move the canvas overlay to the back
    let canvasOverlay = document.querySelector('#canvasOverlay');
    canvasOverlay.classList.remove('frontVideo');
    let originalStream = null;
    // Has the local media already started?
    originalStream = allMediaStreams.find(
      (sender) => sender.videoId === 'local_video'
    );

    if (originalStream) {
      // local media already started
      // if sharing screen is in place do not do anything else
      if (!sharingScreen) {
        let originalTrack = originalStream.mediaStream.getTracks()[1];

        originalStream.senders
          .find((sender) => sender.track.kind === 'video')
          .replaceTrack(originalTrack);
      }
    }
  }
}

function drawCanvas() {
  let ctx = virtualCanvas.getContext('2d');
  ctx.save();
  ctx.fillStyle = 'rgb(21,14,86)';
  let video = document.querySelector('#local_video');
  let width = video.videoWidth;
  let height = video.videoHeight;
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
  let canvasOverlay = document.querySelector('#canvasOverlay');
  let canvasOverlayCtx = canvasOverlay.getContext('2d');

  canvasOverlayCtx.drawImage(
    virtualCanvas,
    0,
    0,
    video.offsetWidth,
    video.offsetHeight
  );

  setTimeout(drawCanvas, 100);
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

  return event.streams[0];
}
// This function checks if a track was removed to
// remove sharing video elements
function checkRemoveTrack() {
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
          (sender) => sender.videoId === 'local_video'
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
            let originalStream = allMediaStreams.find(
              (sender) => sender.videoId === 'local_video'
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
        allMediaStreams[stream.id] = {
          mediaStream: stream,
          senders: screenSender,
          videoId: 'screen',
        };
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

  console.log(senderSharedVideo);
  // store media stream object in peer connection
  allMediaStreams[myVideoStream.id] = {
    mediaStream: myVideoStream,
    senders: senderSharedVideo,
    videoId: 'myVideo',
  };

  // console.log("RTCRtpSender is: " + senderSharedVideo);

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
    (mediaStream) => mediaStream.videoId === 'myVideo'
  );

  // In case the video share did not succeed we remove it
  // but the stream may not be built
  if (originalStream) {
    // console.log('senders:');
    // console.log(originalStream.senders);
    originalStream.senders.forEach((track) => {
      peerConnection.removeTrack(track);
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
    let canvas = document.getElementById('canvasOverlay');
    canvas.width = t.offsetWidth;
    canvas.height = t.offsetHeight;
  }
}

function muteLocalVideo(event) {
  const vid = document.querySelector('#local_video');
  const mediaStream = allMediaStreams.find(
    (stream) => stream.videoId === 'local_video'
  );

  const t = event.target;
  // console.log(t.nodeName, t.parentNode);
  if (t.nodeName === 'IMG') {
    t.parentNode.classList.toggle('unmute');
  } else {
    t.classList.toggle('unmute');
  }
  if (vid.muted) {
    vid.muted = false;
    mediaStream.senders.map((sender) => {
      if (sender.track.kind === 'audio') {
        sender.track.enabled = true;
      }
    });
  } else {
    vid.muted = true;
    mediaStream.senders.map((sender) => {
      if (sender.track.kind === 'audio') {
        sender.track.enabled = false;
      }
    });
  }
  // console.log(`Local video is muted: ${vid.muted}`);
}

export { peerConnection, partySide, callToken };
