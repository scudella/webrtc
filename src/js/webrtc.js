/*  Copyright (c) 2021 Eduardo S. Libardi, All rights reserved. 

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

var call_token;
var socket;
var peerConnection;
var virtualCanvas = null;
var allMediaStreams = [];
var connection = [];
var screenReplaceVideo = localStorage.getItem('replace') === 'sameVideo';
let noVideoCall = false;
let sharingScreen = false;
let partySide = '';
const serverUrl = 'https://192.168.2.118';
const webSocketUrl = 'wss://192.168.2.118';
const port = '5000';

class PeerConnection {
  constructor(token, peerConnection, mediaStream) {
    this.token = token;
    this.peerConnection = peerConnection;
    this.mediaStream = mediaStream;
  }
}

window.onload = function init() {
  const tokenGen = document.querySelector('#tokenGen');
  tokenGen.addEventListener('click', processGen);

  let configuration = {
    iceservers: [{ urls: 'stun:stun.l.google.com:19302' }],
  };
  peerConnection = new RTCPeerConnection(configuration);
  console.log('The peerConnection is: ');
  console.log(peerConnection);
  var receivers = peerConnection.getReceivers();
  // console.log(receivers);

  peerConnection.onicecandidate = function (event) {
    if (event.candidate) {
      socket.send(
        JSON.stringify({
          token: call_token,
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
            token: call_token,
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
      allMediaStreams.push({ mediaStream: videoShare, videoId: 'video_share' });
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
    document.location = `${serverUrl}:${port}/settings.html`;
  });

  const constraint = {
    audio: true,
    video: true,
  };

  const videoButton = document.getElementById('startvideo');
  videoButton.addEventListener('click', videoCall);

  const toggleButton = document.getElementById('toggleVideo');
  toggleButton.addEventListener('click', toggleVideo);

  function videoCall() {
    startCall(constraint);
  }

  function toggleVideo() {
    // Is the button in the no video mode?
    if (!noVideoCall) {
      // Call with no camera mode
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
          allMediaStreams.push({
            mediaStream: mediaSource,
            senders: originalStream.senders,
            videoId: 'canvas',
          });
        }
        // if sharing screen is in place do not send canvas
        if (!sharingScreen) {
          let canvasStream = allMediaStreams.find(
            (sender) => sender.videoId === 'canvas'
          );
          originalStream.senders
            .find((sender) => sender.track.kind === 'video')
            .replaceTrack(canvasStream.mediaStream.getVideoTracks()[0]);
        }
        // set timeout to redraw canvas, otherwise the remote side
        // does not start the video
        setTimeout(drawCanvas, 500);
      }
      // call with video mode
    } else {
      noVideoCall = false;
      // toggle the button to white
      toggleButton.classList.toggle('mute');
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

  function startCall(constraint) {
    // start button pressed - start local media

    // disable start video, toggle video and settings buttons
    document.getElementById('startvideo').disabled = true;
    document.getElementById('toggleVideo').disabled = true;
    document.getElementById('settings').disabled = true;

    // getusermedia
    navigator.mediaDevices
      .getUserMedia(constraint)
      .then(function (stream) {
        // start with the audio stream muted
        stream.getAudioTracks()[0].enabled = false;
        // add full screen handling
        let video = document.getElementById('local_video');
        video.addEventListener('dblclick', videoDblClick);
        video.style.backgroundColor = 'transparent';
        // start stream in the local video
        video.srcObject = stream;
        video.play();

        // save senders for easy replacing later
        let senders = [];
        stream
          .getTracks()
          .forEach((track) =>
            senders.push(peerConnection.addTrack(track, stream))
          );

        // save local media in the peer connection object
        allMediaStreams.push({
          mediaStream: stream,
          senders: senders,
          videoId: 'local_video',
        });

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
          allMediaStreams.push({
            mediaStream: mediaSource,
            senders: noVideoStream.senders,
            videoId: 'canvas',
          });
          // console.log('noVideoStream stream is: ');
          // console.log(noVideoStream);
          // replace local media video stream with canvas stream
          noVideoStream.senders
            .find((sender) => sender.track.kind === 'video')
            .replaceTrack(blackVideoTrack);

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
        socket = new WebSocket(`${webSocketUrl}:${port}`);

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

          const givenToken = document.querySelector('#givenToken');
          document.querySelector('#tokenGen').disabled = true;
          let token = givenToken.value;

          if (token === '' || token === undefined) {
            // create the unique token for this call
            token = Date.now() + '-' + Math.round(Math.random() * 10000);
            givenToken.value = token;
          }

          call_token = '#' + token;
          // console.log(token);
          givenToken.disabled = true;

          connection.push = new PeerConnection(
            token,
            peerConnection,
            allMediaStreams
          );
          // set location.hash to the unique token for this call
          document.location.hash = token;

          socket.onopen = function () {
            socket.onmessage = callerSignalling;

            socket.send(
              JSON.stringify({
                token: call_token,
                type: 'join',
              })
            );
          };

          document.title = 'Caller Leg';
          let url = document.querySelector('#url');
          url.value = document.location;
        } else {
          // Callee Leg
          partySide = 'callee';
          // Set listeners for data channel
          peerConnection.ondatachannel = onDataChannel;

          const givenToken = document.querySelector('#givenToken');
          document.querySelector('#tokenGen').disabled = true;

          call_token = document.location.hash;
          // console.log(call_token.slice(1));
          let token = call_token.slice(1);
          givenToken.value = token;
          givenToken.disabled = true;

          connection.push = new PeerConnection(
            token,
            peerConnection,
            allMediaStreams
          );
          let url = document.querySelector('#url');
          url.value = document.location;

          socket.onopen = function () {
            socket.onmessage = calleeSignalling;

            // This message is for the server link me to the token
            socket.send(
              JSON.stringify({
                token: call_token,
                type: 'join',
              })
            );

            // let the peer know this leg is ready to start the call
            socket.send(
              JSON.stringify({
                token: call_token,
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

/* functions used above are defined below */

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
  let char;
  if (login != '') {
    ctx.beginPath();
    ctx.fillStyle = 'rgb(255, 205, 0)';
    ctx.arc(width / 2, height / 2, 100, 0, Math.PI * 2, true);
    ctx.fill();
    char = login.charAt(0);
    ctx.font = '130px serif';
    ctx.fillStyle = 'rgb(21, 14, 86)';
    ctx.fillText(char.toUpperCase(), width / 2 - 25, height / 2 + 25);
  }
  ctx.restore();
  setTimeout(drawCanvas, 100);
}

function processGen() {
  const givenToken = document.querySelector('#givenToken');
  const token = Date.now() + '-' + Math.round(Math.random() * 10000);
  call_token = '#' + token;
  givenToken.value = token;
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
            token: call_token,
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
              token: call_token,
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
              token: call_token,
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
  // console.log(vid);

  // Insert video in the DOM
  let local_video = document.querySelector('#local_video');
  local_video.parentNode.append(vid);

  // Add remote stream tracks to the new video
  vid.srcObject = event.streams[0];
  // Add event listener for double click
  vid.addEventListener('dblclick', videoDblClick);

  return event.streams[0];
}

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
    timeout = false;

    document.querySelector('#shareVideo').disabled = false;
    document.querySelector('#sharescreen').disabled = false;
  }
  if (timeout) {
    setTimeout(checkRemoveTrack, 1000);
  }
}

function closeVideoCall() {
  console.log('Closing Video Call');
  const remoteVideo = document.getElementById('remote_video');
  const localVideo = document.getElementById('local_video');
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
  callState.style.backgroundColor = 'honeydew';
}

function hangUpCall() {
  socket.send(
    JSON.stringify({
      token: call_token,
      type: 'hang-up',
    })
  );
  closeVideoCall();
}

// Share screen using either local media stream replace
// or a new video
function sharedScreen() {
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
        allMediaStreams.push({
          mediaStream: stream,
          senders: screenSender,
          videoId: 'screen',
        });
        // disable share screen and share video buttons
        document.querySelector('#sharescreen').disabled = true;
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
    // console.log('Capture stream from myVdeo' + myVideoStream);
    setupCaptureStream(videoStream);
    // does mozcapture stream feature exist?
  } else if (myVideo.mozCaptureStream) {
    let videoStream = myVideo.mozCaptureStream();
    // console.log(
    //   'Capture stream from myVdeo with mozCaptureStream()' + myVideoStream
    // );
    setupCaptureStream(videoStream);
  } else {
    console.log('captureStream() not supported');
  }
}

function setupCaptureStream(myVideoStream) {
  const videoTracks = myVideoStream.getVideoTracks();
  // const audioTracks = myVideoStream.getAudioTracks();
  // console.log(myVideoStream.getVideoTracks()[0]);
  // console.log(myVideoStream.getAudioTracks()[0]);

  // if (videoTracks.length > 0) {
  //   console.log(`Using video device: ${videoTracks[0].label}`);
  // }
  // if (audioTracks.length > 0) {
  //   console.log(`Using audio device: ${audioTracks[0].label}`);
  // }

  // Add tracks
  let senderSharedVideo = [];
  myVideoStream
    .getTracks()
    .forEach((track) =>
      senderSharedVideo.push(peerConnection.addTrack(track, myVideoStream))
    );

  console.log(senderSharedVideo);
  // store media stream object in peer connection
  allMediaStreams.push({
    mediaStream: myVideoStream,
    senders: senderSharedVideo,
    videoId: 'myVideo',
  });

  // console.log("RTCRtpSender is: " + senderSharedVideo);

  // create button to stop the media
  let buttonElement = document.createElement('button');
  buttonElement.textContent = 'Stop Video Share';
  buttonElement.id = 'stopVideo';
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
    document.querySelector('#sharescreen').disabled = false;
    console.log('Call Back Function CALLED');
  };
}

function createVideoElement() {
  document.querySelector('#shareVideo').disabled = true;
  if (!screenReplaceVideo) {
    document.querySelector('#sharescreen').disabled = true;
  }

  const links = document.querySelector('.menu');
  links.classList.toggle('show-menu');
  let vid = document.createElement('video');
  vid.id = 'myVideo';
  let local_video = document.querySelector('#local_video');
  local_video.parentNode.append(vid);
  vid.setAttribute('preload', 'auto');
  vid.setAttribute('poster', `${serverUrl}:${port}/video/sintel.jpg`);
  //  vid.setAttribute('controls', true);
  vid.classList.add('smallVideoM');
  let mp4 = document.createElement('source');
  mp4.setAttribute('src', `${serverUrl}:${port}/video/sintel.mp4`);
  mp4.setAttribute('type', 'video/mp4');
  vid.append(mp4);
  let webm = document.createElement('source');
  webm.setAttribute('src', `${serverUrl}:${port}/video/sintel.webm`);
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
  document.querySelector('#shareVideo').disabled = false;
  document.querySelector('#sharescreen').disabled = false;
}

function videoDblClick(event) {
  event.preventDefault();
  event.stopPropagation();
  const t = event.target;
  t.classList.toggle('fullScreen');
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

export { peerConnection, call_token as token, partySide, serverUrl, port };
