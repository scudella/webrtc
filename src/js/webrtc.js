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

var call_token;
var socket;
var peerConnection;
var canvas;
var virtualCanvas = null;
var ctx;
var x = 10,
  y = 10;
var dataChannel = null;
var messages = [];
var allMediaStreams = [];
var connection = [];
var screenReplaceVideo = localStorage.getItem('replace') === 'sameVideo';
let noVideoCall = false;
let sharingScreen = false;

class PeerConnection {
  constructor(token, peerConnection, mediaStream) {
    this.token = token;
    this.peerConnection = peerConnection;
    this.mediaStream = mediaStream;
  }
}

class Message {
  constructor(fromName, message, fromMe, date) {
    this._fromName = fromName;
    this._message = message;
    this._fromMe = fromMe;
    this._date = date;
  }

  get fromName() {
    return this._fromName;
  }

  set fromName(newFromName) {
    this._fromName = newFromName;
  }
  get message() {
    return this._message;
  }

  set message(newMessage) {
    this._message = newMessage;
  }

  get fromMe() {
    return this._fromMe;
  }

  set self(newFromMe) {
    this._fromMe = newFromMe;
  }

  set date(date) {
    this._date = date;
  }

  get date() {
    let newDate = new Date();
    return newDate.toDateString();
  }

  get time() {
    let newTime = new Date();
    return newTime.toLocaleString().slice(9);
  }
}

window.onload = function init() {
  const tokenGen = document.querySelector('#tokenGen');
  tokenGen.addEventListener('click', processGen);

  canvas = document.querySelector('#chat');
  ctx = canvas.getContext('2d');

  let configuration = {
    iceservers: [{ urls: 'stun:stun.l.google.com:19302' }],
  };
  peerConnection = new RTCPeerConnection(configuration);
  console.log('The peerConnection is: ');
  console.log(peerConnection);
  var receivers = peerConnection.getReceivers();
  console.log(receivers);

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
      console.error(err);
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
      remoteVideoCreated = createVideo(remote_video, event);
      allMediaStreams.push({
        mediaStream: remoteVideoCreated,
        videoId: 'remote_video',
      });

      let hangup = document.getElementById('hangup');
      hangup.disabled = false;
      hangup.addEventListener('click', hangUpCall);

      let mute = document.querySelector('#mute');
      mute.disabled = false;

      let shareVideo = document.querySelector('#shareVideo');
      shareVideo.disabled = false;
      shareVideo.addEventListener('click', createVideoElement);

      let shareScreen = document.getElementById('sharescreen');
      shareScreen.disabled = false;
      shareScreen.addEventListener('click', sharedScreen);

      let chat = document.querySelector('#chatInput');
      chat.addEventListener('input', chatInput);

      let sendMessage = document.querySelector('#send');
      sendMessage.addEventListener('click', sendMessageChat);
    } else if (remoteVideoCreated.mediaStream.id === event.streams[0].id) {
      document.querySelector('#remote_video').srcObject = event.streams[0];
      receivers = peerConnection.getReceivers();
      console.log(receivers);
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
    } else if (videoShare.mediaStream.id === event.streams[0].id) {
      document.querySelector('#video_share').srcObject = event.streams[0];
    } else {
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
  console.log(navToggle);
  const links = document.querySelector('.menu');
  let ismenu = false;
  navToggle.addEventListener('click', function (evt) {
    if (evt.target === navToggle) {
      links.classList.toggle('show-menu');
      evt.stopPropagation();
      ismenu = true;
    }
  });

  document.body.addEventListener(
    'click',
    function (evt) {
      console.log(evt.target);
      if (evt.target.parentNode === navToggle) {
        links.classList.toggle('show-menu');
        evt.stopPropagation();
        ismenu = true;
      } else if (ismenu) {
        console.log(evt.target);
        links.classList.toggle('show-menu');
        ismenu = false;
      }
    },
    true
  );

  let settings = document.getElementById('settings');
  settings.addEventListener('click', () => {
    document.location = 'http://localhost:8080/settings.html';
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
    if (!noVideoCall) {
      noVideoCall = true;
      toggleButton.classList.toggle('mute');
      let originalStream = null;
      originalStream = allMediaStreams.find(
        (sender) => sender.videoId === 'local_video'
      );

      if (originalStream) {
        if (!virtualCanvas) {
          let video = document.getElementById('local_video');
          let width = video.videoWidth;
          let height = video.videoHeight;
          virtualCanvas = Object.assign(document.createElement('canvas'), {
            width,
            height,
          });
          virtualCanvas.getContext('2d').fillRect(0, 0, width, height);
          let mediaSource = virtualCanvas.captureStream(10);
          allMediaStreams.push({
            mediaStream: mediaSource,
            senders: originalStream.senders,
            videoId: 'canvas',
          });
        }
        if (!sharingScreen) {
          let canvasStream = allMediaStreams.find(
            (sender) => sender.videoId === 'canvas'
          );
          canvasStream.senders
            .find((sender) => sender.track.kind === 'video')
            .replaceTrack(canvasStream.mediaStream.getVideoTracks()[0]);
        }

        setTimeout(drawCanvas, 500);
      }
    } else {
      noVideoCall = false;
      toggleButton.classList.toggle('mute');
      let originalStream = null;
      originalStream = allMediaStreams.find(
        (sender) => sender.videoId === 'local_video'
      );

      if (originalStream) {
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
    document.getElementById('startvideo').disabled = true;
    document.getElementById('toggleVideo').disabled = true;
    document.getElementById('settings').disabled = true;
    navigator.mediaDevices
      .getUserMedia(constraint)
      .then(function (stream) {
        stream.getAudioTracks()[0].enabled = false;
        let video = document.getElementById('local_video');
        video.addEventListener('dblclick', videoDblClick);
        video.style.backgroundColor = 'transparent';
        video.srcObject = stream;
        video.play();

        let senders = [];
        stream
          .getTracks()
          .forEach((track) =>
            senders.push(peerConnection.addTrack(track, stream))
          );

        allMediaStreams.push({
          mediaStream: stream,
          senders: senders,
          videoId: 'local_video',
        });

        if (noVideoCall) {
          video.oncanplay = canvasCreateStream;
        }
        function canvasCreateStream() {
          let width = video.videoWidth;
          let height = video.videoHeight;
          virtualCanvas = Object.assign(document.createElement('canvas'), {
            width,
            height,
          });
          console.log(`width: ${width}, height: ${height}`);
          virtualCanvas.getContext('2d').fillRect(0, 0, width, height);
          let mediaSource = virtualCanvas.captureStream();
          let blackVideoTrack = mediaSource.getVideoTracks()[0];
          console.log('black video track:');
          console.log(blackVideoTrack);
          let noVideoStream = allMediaStreams.find(
            (sender) => sender.videoId === 'local_video'
          );
          allMediaStreams.push({
            mediaStream: mediaSource,
            senders: noVideoStream.senders,
            videoId: 'canvas',
          });
          console.log('noVideoStream stream is: ');
          console.log(noVideoStream);
          noVideoStream.senders
            .find((sender) => sender.track.kind === 'video')
            .replaceTrack(blackVideoTrack);
          document.getElementById('toggleVideo').disabled = false;
          setTimeout(drawCanvas, 100);
          virtualCanvas.getContext('2d').fillRect(0, 0, width, height);
        }

        document.getElementById('toggleVideo').disabled = false;
        let mute = document.querySelector('#mute');
        mute.addEventListener('click', muteLocalVideo);

        socket = new WebSocket('ws://localhost:8080');

        if (
          document.location.hash === '' ||
          document.location.hash === undefined
        ) {
          // Caller leg

          if (dataChannel === null) {
            dataChannel = peerConnection.createDataChannel('chat');
            console.log('data channel created ');
            console.log(dataChannel);

            dataChannel.onopen = function () {
              console.log('Caller data channel opened');
            };

            dataChannel.onmessage = function (event) {
              let date = new Date();
              date.toDateString();
              var messageR = new Message('Remote', event.data, false, date);
              messages.push(messageR);
              console.log(messages.length);
              printMessage(canvas, ctx, messages);
            };
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
          console.log(token);
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

          peerConnection.ondatachannel = function (event) {
            dataChannel = event.channel;
            dataChannel.onopen = function () {
              console.log('Data channel opened');
            };

            dataChannel.onmessage = function (event) {
              let date = new Date();
              date.toDateString();
              var messageR = new Message('Remote', event.data, false, date);
              messages.push(messageR);
              console.log(messages.length);
              printMessage(canvas, ctx, messages);
            };
          };

          const givenToken = document.querySelector('#givenToken');
          document.querySelector('#tokenGen').disabled = true;

          call_token = document.location.hash;
          console.log(call_token.slice(1));
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
        'Unable to open your call because no camera and/or microphone' +
          'were found.'
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

function createVideo(videoid, event) {
  let vid = document.createElement('video');
  vid.id = videoid;
  vid.className = 'smallVideoR';
  vid.setAttribute('autoplay', true);
  // vid.setAttribute('controls', true);
  console.log(vid);

  let local_video = document.querySelector('#local_video');
  local_video.parentNode.insertBefore(vid, local_video.nextSibling);

  vid.srcObject = event.streams[0];
  vid.addEventListener('dblclick', videoDblClick);

  //  Feature not supported by most browsers.
  //  removetrack event
  /*  newvid.videoTracks.addEventListener('removetrack', (event) => {
            console.log(`Video track: ${event.track.label} removed`);
            let receivedVideoStream = newvid.srcObject;
            let trackList = receivedVideoStream.getTracks();
            if(trackList.length === 0) {
              newvid.remove();
            }
          }); */
  return event.streams[0];
}

function checkRemoveTrack() {
  let timeout = true;
  for (let i = 0; i < allMediaStreams.length; i++) {
    if (allMediaStreams[i].videoId === 'video_share') {
      const videoTracks = allMediaStreams[i].mediaStream.getTracks();
      if (!videoTracks.length) {
        // Remove object
        allMediaStreams.splice(i, 1);
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
    }
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

function sharedScreen() {
  navigator.mediaDevices
    .getDisplayMedia({ cursor: true })
    .then((stream) => {
      const screenTrack = stream.getTracks()[0];
      if (screenReplaceVideo) {
        sharingScreen = true;
        let originalStream = allMediaStreams.find(
          (sender) => sender.videoId === 'local_video'
        );
        console.log('Original stream is: ');
        console.log(originalStream);
        originalStream.senders
          .find((sender) => sender.track.kind === 'video')
          .replaceTrack(screenTrack);

        screenTrack.onended = function () {
          sharingScreen = false;
          if (noVideoCall) {
            let originalStream = allMediaStreams.find(
              (sender) => sender.videoId === 'canvas'
            );
            let originalTrack = originalStream.mediaStream.getTracks()[0];

            originalStream.senders
              .find((sender) => sender.track.kind === 'video')
              .replaceTrack(originalTrack);
          } else {
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
        let screenSender;
        stream
          .getTracks()
          .forEach(
            (track) => (screenSender = peerConnection.addTrack(track, stream))
          );
        allMediaStreams.push({ mediaStream: stream, videoId: 'none' });
        document.querySelector('#sharescreen').disabled = true;
        document.querySelector('#shareVideo').disabled = true;

        screenTrack.onended = function () {
          for (let i = 0; i < allMediaStreams.length; i++) {
            if (allMediaStreams[i].videoId === 'none') {
              allMediaStreams.splice(i, 1);
            }
          }
          peerConnection.removeTrack(screenSender);
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
  let myVideoStream = allMediaStreams.find(
    (stream) => stream.videoId === 'myVideo'
  );
  if (myVideoStream) {
    alert('MyVideo already exist!!!');
    return;
  }

  let myVideo = document.querySelector('#myVideo');
  if (myVideo.captureStream) {
    myVideoStream = myVideo.captureStream();
    console.log('Capture stream from myVdeo' + myVideoStream);
    setupCaptureStream(myVideoStream);
  } else if (myVideo.mozCaptureStream) {
    myVideoStream = myVideo.mozCaptureStream();
    console.log(
      'Capture stream from myVdeo with mozCaptureStream()' + myVideoStream
    );
    setupCaptureStream(myVideoStream);
  } else {
    console.log('captureStream() not supported');
  }
}

function setupCaptureStream(myVideoStream) {
  const videoTracks = myVideoStream.getVideoTracks();
  const audioTracks = myVideoStream.getAudioTracks();
  // console.log(myVideoStream.getVideoTracks()[0]);
  // console.log(myVideoStream.getAudioTracks()[0]);

  if (videoTracks.length > 0) {
    console.log(`Using video device: ${videoTracks[0].label}`);
  }
  if (audioTracks.length > 0) {
    console.log(`Using audio device: ${audioTracks[0].label}`);
  }

  let senderSharedVideo = [];
  myVideoStream
    .getTracks()
    .forEach((track) =>
      senderSharedVideo.push(peerConnection.addTrack(track, myVideoStream))
    );

  allMediaStreams.push({
    mediaStream: myVideoStream,
    senders: senderSharedVideo,
    videoId: 'myVideo',
  });

  // console.log("RTCRtpSender is: " + senderSharedVideo);

  let buttonElement = document.createElement('button');
  buttonElement.textContent = 'Stop Video Share';
  buttonElement.id = 'stopVideo';
  let shareScreenElement = document.querySelector('#sharescreen');
  shareScreenElement.parentNode.append(buttonElement);
  buttonElement.addEventListener('click', stopVideo);

  // MediaStreamTrack.onended.
  videoTracks.onended = function () {
    for (let i = 0; i < allMediaStreams.length; i++) {
      if (allMediaStreams[i].videoId === 'myVideo') {
        allMediaStreams.splice(i, 1);
      }
    }
    peerConnection.removeTrack(senderSharedVideo);
    document.querySelector('#shareVideo').disabled = false;
    document.querySelector('#sharescreen').disabled = false;
  };
}

function createVideoElement() {
  let vid = document.createElement('video');
  vid.id = 'myVideo';
  vid.setAttribute('preload', 'auto');
  vid.setAttribute('poster', 'http://localhost:8080/video/sintel.jpg');
  vid.setAttribute('controls', true);
  vid.classList.add('smallVideoM');

  let local_video = document.querySelector('#local_video');
  vid.innerHTML +=
    '<source src="http://localhost:8080/video/sintel.mp4" type="video/mp4" />';
  vid.innerHTML +=
    '<source src="http://localhost:8080/video/sintel.webm" type="video/webm" />';
  vid.innerHTML +=
    '<track src="http://localhost:8080/video/sintel-captions.vtt" kind="captions" label="English Captions" default/>';
  vid.innerHTML +=
    '<track src="http://localhost:8080/video/sintel-descriptions.vtt" kind="descriptions" label="Audio Descriptions" />';
  vid.innerHTML += "Sorry, your browser doesn't support embedded videos.";

  vid.addEventListener('dblclick', videoDblClick);

  document.querySelector('#shareVideo').disabled = true;
  if (!screenReplaceVideo) {
    document.querySelector('#sharescreen').disabled = true;
  }

  local_video.parentNode.insertBefore(vid, local_video.nextSibling);
  let myVideo = document.querySelector('#myVideo');
  myVideo.play();
  myVideo.oncanplay = videoCreateStream;
  if (myVideo.readyState >= 2) {
    videoCreateStream();
  }
}

function stopVideo() {
  let originalStream = allMediaStreams.find(
    (sender) => sender.videoId === 'myVideo'
  );

  originalStream.senders.forEach((sender) =>
    peerConnection.removeTrack(sender)
  );

  for (let i = 0; i < allMediaStreams.length; i++) {
    if (allMediaStreams[i].videoId === 'myVideo') {
      allMediaStreams.splice(i, 1);
    }
  }

  document.querySelector('#shareVideo').disabled = false;
  document.querySelector('#sharescreen').disabled = false;
  document.querySelector('#stopVideo').remove();
  let video = document.querySelector('#myVideo');
  video.remove();
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

function chatInput() {
  let send = document.querySelector('#send');
  send.disabled = false;
}

function sendMessageChat() {
  let chatInput = document.querySelector('#chatInput');
  let send = document.querySelector('#send');
  let date = new Date();
  date.toDateString();
  var messageL = new Message('local', chatInput.value, true, date);
  messages.push(messageL);
  console.log(messages.length);
  printMessage(canvas, ctx, messages);
  dataChannel.send(chatInput.value);
  send.disabled = true;
  chatInput.value = '';
}

function printMessage(canvas, ctx, messages) {
  y = canvas.height - 40;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let i = messages.length; i > 0; i--) {
    ctx.font = '12px serif';
    let currentMessage = messages[i - 1];
    if (currentMessage.fromMe) {
      x = 30;
      ctx.strokeStyle = 'rgb(33,33,33)';
      ctx.fillStyle = 'rgb(113,240,245)';
      ctx.lineWidth = 1;
      roundedRect(ctx, x - 5, y - 15, canvas.width - 35, 45, 20, true, true);
    } else {
      x = 10;
      ctx.strokeStyle = 'rgb(33,33,33)';
      ctx.fillStyle = 'rgb(107,232,169)';
      ctx.lineWidth = 1;
      roundedRect(ctx, x - 5, y - 15, canvas.width - 35, 45, 20, true, true);
    }

    ctx.fillStyle = 'rgb(33,33,33';
    ctx.fillText(currentMessage.fromName.toString(), x, y);
    let dateTime = currentMessage.date.toString();
    dateTime += currentMessage.time.toString();
    ctx.fillText(dateTime, x + 100, y);
    ctx.font = '14px serif';
    ctx.fillText(currentMessage.message.toString(), x, y + 15);
    y -= 50;
  }
}

var roundedRect = function (ctx, x, y, width, height, radius, fill, stroke) {
  ctx.beginPath();

  // draw top and top right corner
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + radius, radius);

  // draw right side and bottom right corner
  ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);

  // draw bottom and bottom left corner
  ctx.arcTo(x, y + height, x, y + height - radius, radius);

  // draw left and top left corner
  ctx.arcTo(x, y, x + radius, y, radius);

  if (fill) {
    ctx.fill();
  }
  if (stroke) {
    ctx.stroke();
  }
};
