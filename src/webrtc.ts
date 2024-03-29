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

import { setDataChannel, onDataChannel, toggleCanvasChat } from './chat';
import { toast } from './utils/toast';
import { position } from './utils/videoPosition';

export type Pc = {
  token: string;
  peerConnection: RTCPeerConnection;
  iceCandidates: RTCIceCandidateInit[];
  fromParty: string;
  position: string;
  sendersSharedVideo: RTCRtpSender[];
  sendersSharedScreen: RTCRtpSender[];
  remoteShareVideo: boolean;
  chatDataChannel?: RTCDataChannel;
  callState: {
    divContainer?: HTMLDivElement;
    currentState: `${RTCIceConnectionState}-state` | undefined;
  };
};
type Connection = Pc[];

type VideoId =
  | 'local_video'
  | 'canvas'
  | 'remote_video'
  | 'video_share'
  | 'screen'
  | 'myVideo';

type AllMediaStreams = {
  mediaStream: MediaStream;
  videoId: VideoId;
  fromParty?: Signal['fromParty'];
  videoElement?: HTMLVideoElement;
}[];

let callToken = '';
let socket: WebSocket;
let virtualCanvas: HTMLCanvasElement;
let allMediaStreams: AllMediaStreams = [];
let connection: Connection = [];
let noVideoCall = false;
let sharingScreen = false;
let partySide = '';
let serverOrigin = '';
let webSocketOrigin = '';

const toggleButton = document.getElementById(
  'toggleVideo'
)! as HTMLButtonElement;
const navToggle = document.querySelector('.nav-toggle')! as HTMLButtonElement;
const links = document.querySelector('.menu')! as HTMLDivElement;
const replaceScreen = document.getElementById(
  'replace-screen'
)! as HTMLButtonElement;
const videoContainer = document.querySelector(
  '#videoContainer'
)! as HTMLDivElement;
const video = document.getElementById('local_video')! as HTMLVideoElement;
const canvasOverlay = document.querySelector(
  '#canvasOverlay'
)! as HTMLCanvasElement;
const hangup = document.getElementById('hangup')! as HTMLButtonElement;
const shareScreen = document.getElementById(
  'sharescreen'
)! as HTMLButtonElement;
const mute = document.querySelector('#mute')! as HTMLButtonElement;
const shareVideo = document.querySelector('#shareVideo')! as HTMLButtonElement;
const canvasChat = document.getElementById('canvasChat')! as HTMLButtonElement;
const avatar = document.querySelector('.user')! as HTMLLIElement;
const avatarPic = document.querySelector('.avatar')! as HTMLImageElement;

type User = {
  name: string;
  email: string;
  userId: string;
  role: string;
  picture: string;
};

window.onload = function init() {
  serverOrigin = document.location.origin;
  webSocketOrigin = `wss://${document.location.host}`;
  //  Get token provided in the home page or direct
  // in the address field
  callToken = document.location.hash.slice(1, 21);
  if (callToken) {
    callToken = callToken.match(/[A-Za-z0-9-]+/)![0];
  }
  if (!callToken) {
    document.location = `${serverOrigin}`;
  }
  localStorage.setItem('callToken', callToken);

  if (localStorage.getItem('user')) {
    const user: User = JSON.parse(localStorage.getItem('user')!);
    avatar.innerText = user.name.substring(0, 26);
    avatarPic.src = user.picture;
  } else {
    avatar.style.visibility = 'hidden';
    avatarPic.style.visibility = 'hidden';
  }

  navToggle.addEventListener('click', function (evt) {
    if (
      (<HTMLElement>evt.target).parentNode === navToggle ||
      evt.target === navToggle
    ) {
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

      // Enable hangup button
      hangup.disabled = false;
      hangup.addEventListener('click', hangUpCall);

      // set location.hash to the unique token for this call
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
      if (localStorage.getItem('partySide')) {
        partySide = localStorage.getItem('partySide')!;
      }
      localStorage.setItem('partySide', '');

      if (partySide === 'caller') {
        // Caller leg
        // Set websocket accordingly and join the bridge
        setCaller(true);
      } else {
        // Callee Leg
        setCallee(true);
      }
    })
    .catch(handleGetUserMediaError);
};

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

      connection.forEach((pc: Pc) => {
        const sender = pc.peerConnection
          .getSenders()
          .find((sender) => sender.track && sender.track.kind === 'video');
        if (sender && canvasStream) {
          sender.replaceTrack(canvasStream.mediaStream.getVideoTracks()[0]);
        }
      });
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
      const originalTrack = originalStream!.mediaStream.getTracks()[1];

      // replace canvas with camera stream
      connection.forEach((pc) => {
        const sender = pc.peerConnection
          .getSenders()
          .find((sender) => sender.track && sender.track.kind === 'video');
        if (sender) {
          sender.replaceTrack(originalTrack);
        }
      });
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
  virtualCanvas.getContext('2d')!.fillRect(0, 0, width, height);
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
  const ctx = virtualCanvas.getContext('2d')!;
  ctx.save();
  ctx.fillStyle = 'rgb(21,14,86)';
  const width = video.videoWidth;
  const height = video.videoHeight;
  ctx.clearRect(0, 0, width, height);
  ctx.fillRect(0, 0, width, height);
  let user: User,
    name: string,
    char = '0';
  if (localStorage.getItem('user')) {
    user = JSON.parse(localStorage.getItem('user')!);
    if (user) {
      name = user.name;
      char = name.charAt(0).toUpperCase();
    }
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

  canvasOverlayCtx!.drawImage(
    virtualCanvas,
    0,
    0,
    video.offsetWidth,
    video.offsetHeight
  );

  setTimeout(drawCanvas, 100);
};

const handleGetUserMediaError = (error: any) => {
  switch (error.name) {
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
        content: `Error opening your camera and/or microphone: ${error.message}`,
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

type PartSignal = {
  token: Signal['token'];
  fromParty: Signal['fromParty'];
};

const createPeerConnection = ({ token, fromParty }: PartSignal): Pc => {
  const configuration = {
    iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }],
  };
  const peerConnection = new RTCPeerConnection(configuration);

  const pc: Pc = {
    token,
    peerConnection,
    iceCandidates: [],
    fromParty,
    position: '',
    sendersSharedVideo: [],
    sendersSharedScreen: [],
    remoteShareVideo: false,
    callState: {
      currentState: undefined,
    },
  };

  connection.push(pc);

  peerConnection.onicecandidate = function (event) {
    if (event.candidate) {
      socket.send(
        JSON.stringify({
          token: callToken,
          type: 'ice-candidate',
          candidate: event.candidate,
          toParty: fromParty,
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
            toParty: fromParty,
          })
        );
      }
    } catch (error) {
      console.log(error);
    }
  };

  peerConnection.addEventListener('track', (event) =>
    receiveTrack(event, fromParty)
  );
  const receiveTrack = (event: RTCTrackEvent, fromParty: string) => {
    // console.log('ontrack called. The event is:');
    // console.log(event);

    let remoteVideoObject = allMediaStreams.find(
      (stream) =>
        stream.videoId === 'remote_video' && stream.fromParty === fromParty
    );
    let videoShare = allMediaStreams.find(
      (stream) => stream.videoId === 'video_share'
    );
    if (!remoteVideoObject) {
      // Create remote video from peer
      const {
        mediaStream: remoteVideoCreated,
        videoElement,
        divContainer,
      } = createVideo('remote_video', event, fromParty);

      // Save mediaStream from remote
      allMediaStreams.push({
        mediaStream: remoteVideoCreated,
        videoId: 'remote_video',
        fromParty,
        videoElement,
      });

      pc.callState.divContainer = divContainer;

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
    } else if (
      remoteVideoObject.mediaStream.id === event.streams[0].id &&
      remoteVideoObject.videoElement
    ) {
      remoteVideoObject.videoElement.srcObject = event.streams[0];

      // If on track is not from remote video camera it should be from a video
      // or screen sharing
    } else if (!videoShare) {
      const { mediaStream } = createVideo('video_share', event, fromParty);
      allMediaStreams.push({ mediaStream, videoId: 'video_share' });
      pc.remoteShareVideo = true;

      shareVideo.disabled = true;
      shareScreen.disabled = true;

      // Check for tracks removed
      setTimeout(checkRemoveTrack, 1000);

      // video or screen sharing has additional tracks to add
    } else if (videoShare.mediaStream.id === event.streams[0].id) {
      const video = <HTMLVideoElement>document.querySelector('#video_share')!;
      video.srcObject = event.streams[0];

      // track not related with remote camera or video/screen sharing
    } else {
      console.log('ontrack received, but not handled:');
      console.log(event.streams[0].id);
    }
  };

  peerConnection.addEventListener(
    'iceconnectionstatechange',
    () => {
      if (pc.callState.divContainer) {
        if (pc.callState.currentState) {
          pc.callState.divContainer.classList.remove(
            `${pc.callState.currentState}`
          );
        }
        pc.callState.divContainer.classList.add(
          `${peerConnection.iceConnectionState}-state`
        );
        pc.callState.currentState = `${peerConnection.iceConnectionState}-state`;
      }

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
          // When a new party arrives check whether shared video or screen
          // is in place
          setupSingleCaptureStream(pc);
          setupSingleSharedScreen(pc);
          break;
        case 'completed':
          console.log('ICE has found a connection for all components.');
          break;
        case 'closed':
          console.log('Call closed');
          // show toast only for last party at callee side
          if (connection.length === 1 && partySide === 'callee') {
            toast({
              alertClass: 'alert-danger',
              content: 'Peer closed the call',
              modal: true,
            });
            setTimeout(() => {
              document.location = `${serverOrigin}`;
            }, 3200);
          } else {
            removeRemotePC({ token, fromParty, pcDisconnect: false });
          }
          break;
        case 'failed':
          console.log('Call failed');
          removeRemotePC({ token, fromParty, pcDisconnect: false });
          break;
        case 'disconnected':
          let failed = 0;
          const disconnect = setTimeout(() => {
            clearInterval(pulling);
            console.log(`state is ${peerConnection.connectionState}`);
            if (
              peerConnection.connectionState === 'disconnected' ||
              peerConnection.connectionState === 'failed'
            ) {
              removeRemotePC({ token, fromParty, pcDisconnect: true });
            }
          }, 25000);
          const pulling = setInterval(() => {
            if (peerConnection.connectionState === 'failed') {
              failed++;
              if (failed === 2) {
                clearInterval(pulling);
                clearTimeout(disconnect);
                removeRemotePC({ token, fromParty, pcDisconnect: true });
              }
            }
          }, 5000);
          break;
      }
    },
    false
  );
  return pc;
};

/* ///////////////////////////////////////////////////////
/
/                   WebSockets setup
/
*/ ////////////////////////////////////////////////////////

const setCaller = (initialSet: boolean) => {
  const socketCallerOnclose = () => {
    socket.onclose = (_) => {
      // Is there any connection left?
      if (!connection.length) {
        toast({
          alertClass: 'alert-danger',
          content: 'Call ended',
          modal: true,
        });
        setTimeout(() => {
          document.location = `${serverOrigin}/meeting/`;
        }, 3200);
      }
    };
  };
  document.title = 'Chair Leg';
  if (initialSet) {
    socket.onopen = function () {
      socket.onmessage = callerSignalling;
      // send join message to the bridge
      socket.send(
        JSON.stringify({
          token: callToken,
          type: 'join',
        })
      );
      socketCallerOnclose();
    };
  } else {
    socket.onmessage = callerSignalling;
    socketCallerOnclose();
  }
};

const setCallee = (initialSet: boolean) => {
  const socketCalleeOnclose = () => {
    socket.onclose = (_) => {
      // Is there any connection left?
      if (!connection.length) {
        toast({
          alertClass: 'alert-danger',
          content: 'Call ended ',
          modal: true,
        });
        setTimeout(() => {
          document.location = `${serverOrigin}`;
        }, 3200);
      }
    };
  };
  partySide = 'callee';
  document.title = 'Callee Leg';
  if (initialSet) {
    socket.onopen = function () {
      socket.onmessage = calleeSignalling;
      // send join message to the bridge
      socket.send(
        JSON.stringify({
          token: callToken,
          type: 'join',
        })
      );
      socketCalleeOnclose();
    };
  } else {
    socket.onmessage = calleeSignalling;
    socketCalleeOnclose();
  }
};

const callerReceivesCalleeArrived = (signal: Signal) => {
  const pc = createPeerConnection(signal);
  const { peerConnection, fromParty } = pc;
  setDataChannel(pc);

  // add camera and mic stream to pc
  const stream = allMediaStreams.find(
    (stream) => stream.videoId === 'local_video'
  );

  const { mediaStream } = stream!;

  mediaStream
    .getTracks()
    .forEach((track) => peerConnection.addTrack(track, mediaStream));

  // if video is in mute send canvas instead
  if (noVideoCall) {
    const canvasStream = allMediaStreams.find(
      (stream) => stream.videoId === 'canvas'
    );
    const sender = peerConnection
      .getSenders()
      .find((sender) => sender.track && sender.track.kind === 'video');
    if (sender && canvasStream) {
      sender.replaceTrack(canvasStream.mediaStream.getVideoTracks()[0]);
    }
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
          toParty: fromParty,
        })
      );
    })
    .catch(function (error) {
      console.log(error);
    });
};

////////////////////////////////////
//
//  handle signals as a caller
//
////////////////////////////////////

type MessageType =
  | 'caller_arrived'
  | 'callee_arrived'
  | 'ice-candidate'
  | 'description'
  | 'hang-up'
  | 'hard-reset'
  | 'waiting-room'
  | 'party_arrived'
  | 'reset'
  | 'full-bridge'
  | 'not-available';

type Signal = {
  token: string;
  type: MessageType;
  fromParty: string;
  toParty?: string;
  sdp?: RTCSessionDescription;
  candidate?: RTCIceCandidateInit;
};

const callerSignalling = (event: MessageEvent) => {
  const signal: Signal = JSON.parse(event.data);
  if (signal.type === 'caller_arrived') {
    // Server asks this instance to be Callee Leg
    // probably there is already another instance
    // with the same credentials in the bridge
    // Set Callee without joining again
    setCallee(false);
  } else if (signal.type === 'callee_arrived') {
    callerReceivesCalleeArrived(signal);
  } else if (signal.type === 'ice-candidate') {
    const pc = connection.find(
      (pc) => pc.token === signal.token && pc.fromParty === signal.fromParty
    );
    if (pc) {
      const { peerConnection } = pc;

      // if remoteDescription not set, queue iceCandidate
      if (peerConnection && peerConnection.remoteDescription) {
        peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
      } else {
        connection.forEach((pc) => {
          if (pc.token === signal.token && pc.fromParty === signal.fromParty) {
            pc.iceCandidates.push(signal.candidate!);
          }
        });
      }
    }
  } else if (signal.type === 'description') {
    const pc = connection.find(
      (pc) => pc.token === signal.token && pc.fromParty === signal.fromParty
    );
    if (pc) {
      const { peerConnection, iceCandidates, fromParty } = pc;

      console.log(
        `New description message received. Set remote description. Type is ${
          signal.sdp ? signal.sdp.type : 'no valid SDP'
        }`
      );
      if (signal.sdp && signal.sdp.type === 'answer') {
        peerConnection
          .setRemoteDescription(signal.sdp)
          .then(function () {
            console.log('Remote Session Description set.');
            // read iceCandidates in queue and apply to pc
            iceCandidates.forEach((candidate) => {
              peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            });
            connection.forEach((pc) => {
              if (
                pc.token === signal.token &&
                pc.fromParty === signal.fromParty
              ) {
                pc.iceCandidates = [];
              }
            });
          })
          .catch(function (error) {
            console.log(error);
          });
      } else {
        peerConnection
          .setRemoteDescription(signal.sdp!)
          .then(function () {
            console.log('Remote Session Description set. Creating answer');
            // read iceCandidates in queue and apply to pc
            iceCandidates.forEach((candidate) =>
              peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
            );
            connection.forEach((pc) => {
              if (
                pc.token === signal.token &&
                pc.fromParty === signal.fromParty
              ) {
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
                toParty: fromParty,
              })
            );
          })
          .catch(function (error) {
            console.log(error);
          });
      }
    }
  } else if (signal.type === 'hang-up') {
    const pc = connection.find((pc) => pc.token === signal.token);

    if (pc) {
      console.log('Received hang up notification from other peer');
      const token = signal.token;
      const fromParty = signal.fromParty;
      removeRemotePC({ token, fromParty, pcDisconnect: false });
    }
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

const calleeSignalling = (event: MessageEvent) => {
  const signal: Signal = JSON.parse(event.data);
  if (signal.type === 'waiting-room') {
    setTimeout(() => {
      // send join message to the bridge
      socket.send(
        JSON.stringify({
          token: callToken,
          type: 'join',
        })
      );
    }, 15000);
  } else if (signal.type === 'party_arrived') {
    // callee will create a peer connection to the other callee
    const pc = createPeerConnection(signal);
    const { peerConnection, fromParty } = pc;
    setDataChannel(pc);

    // add camera and mic stream to pc
    const { mediaStream } = allMediaStreams.find(
      (stream) => stream.videoId === 'local_video'
    )!;
    mediaStream
      .getTracks()
      .forEach((track) => peerConnection.addTrack(track, mediaStream));

    // if video is in mute send canvas instead
    if (noVideoCall) {
      const canvasStream = allMediaStreams.find(
        (stream) => stream.videoId === 'canvas'
      );
      const sender = peerConnection
        .getSenders()
        .find((sender) => sender.track && sender.track.kind === 'video');
      if (sender && canvasStream) {
        sender.replaceTrack(canvasStream.mediaStream.getVideoTracks()[0]);
      }
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
            toParty: fromParty,
          })
        );
      })
      .catch(function (error) {
        console.log(error);
      });
  } else if (signal.type === 'caller_arrived') {
    // This leg is a callee probably due a browser address paste or
    // by a browser reset
    // It is signed as owner but the partySide at the local storage
    // was empty and this leg does not know.
    // The server checks the signed cookie with the jwt and sends
    // this message as it checks there is already an owner at the
    // room
    // If it is a browser reset of the only owner,
    // the server will propably take measures when the server does not
    // receive a response from the owner.
    // Otherwise, wait for the ice-candidates, if it is a second
    // owner
    console.log(`Ignoring ${signal.type} received as a callee`);
  } else if (signal.type === 'callee_arrived') {
    // This leg is a callee probably due to a browser address paste
    // or because the server asked the owner to behave as a callee
    // as there was another caller that initiated the bridge in the server
    // Implicitly upgrading to caller
    console.log('self upgrade to caller');
    partySide = 'caller';
    setCaller(false);
    // behaves as the caller receiving callee_arrived
    callerReceivesCalleeArrived(signal);
  } else {
    let peerConnection: RTCPeerConnection;
    let pc = connection.find(
      (pc) => pc.token === signal.token && pc.fromParty === signal.fromParty
    );
    if (!pc) {
      pc = createPeerConnection(signal);
      peerConnection = pc.peerConnection;
      // Set listeners for data channel
      peerConnection.addEventListener('datachannel', (event) =>
        onDataChannel(event, pc!)
      );
      // add camera and mic stream to pc
      const stream = allMediaStreams.find(
        (stream) => stream.videoId === 'local_video'
      );
      if (stream) {
        const { mediaStream } = stream;

        // add mediaStream to pc
        mediaStream
          .getTracks()
          .forEach((track) => peerConnection.addTrack(track, mediaStream));
      }
      // if video is in mute send canvas instead
      if (noVideoCall) {
        const canvasStream = allMediaStreams.find(
          (stream) => stream.videoId === 'canvas'
        );
        const sender = peerConnection
          .getSenders()
          .find((sender) => sender.track && sender.track.kind === 'video');
        if (sender && canvasStream)
          sender.replaceTrack(canvasStream.mediaStream.getVideoTracks()[0]);
      }
    } else {
      peerConnection = pc.peerConnection;
    }
    if (signal.type === 'ice-candidate') {
      // if remoteDescription not set, queue iceCandidate
      if (peerConnection && peerConnection.remoteDescription) {
        peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
      } else {
        connection.forEach((pc) => {
          if (pc.token === signal.token && pc.fromParty === signal.fromParty) {
            pc.iceCandidates.push(signal.candidate!);
          }
        });
      }
    } else if (signal.type === 'description') {
      const pc = connection.find(
        (pc) => pc.token === signal.token && pc.fromParty === signal.fromParty
      );
      if (pc) {
        const { iceCandidates, fromParty } = pc;

        console.log(
          `New description message received. Set remote description. Type is ${
            signal.sdp!.type
          }`
        );
        if (signal.sdp!.type === 'offer') {
          peerConnection
            .setRemoteDescription(signal.sdp!)
            .then(function () {
              console.log('Remote Session Description set. Creating answer');
              // read iceCandidates in queue and apply to pc
              iceCandidates.forEach((candidate) => {
                peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
              });
              connection.forEach((pc) => {
                if (
                  pc.token === signal.token &&
                  pc.fromParty === signal.fromParty
                ) {
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
                  toParty: fromParty,
                })
              );
            })
            .catch(function (error) {
              console.log(error);
            });
        } else {
          peerConnection
            .setRemoteDescription(signal.sdp!)
            .then(function () {
              console.log('Remote Session Description set.');
              // read iceCandidates in queue and apply to pc
              iceCandidates.forEach((candidate) =>
                peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
              );
              connection.forEach((pc) => {
                if (
                  pc.token === signal.token &&
                  pc.fromParty === signal.fromParty
                ) {
                  pc.iceCandidates = [];
                }
              });
            })
            .catch(function (error) {
              console.log(error);
            });
        }
      }
    } else if (signal.type === 'hang-up') {
      // the server cleared the bridge?
      if (signal.fromParty === 'owner') {
        toast({
          alertClass: 'alert-danger',
          content: 'Hang-up received',
          modal: true,
        });
        console.log('Received hang up notification from other peer');
        setTimeout(() => {
          document.location = `${serverOrigin}`;
        }, 3200);
      } else {
        const token = signal.token;
        const fromParty = signal.fromParty;
        removeRemotePC({ token, fromParty, pcDisconnect: false });
      }
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
  }
};

type SignalAndDisconnect = {
  token: Signal['token'];
  fromParty: Signal['fromParty'];
  pcDisconnect: boolean;
};

const removeRemotePC = ({
  token,
  fromParty,
  pcDisconnect,
}: SignalAndDisconnect) => {
  allMediaStreams = allMediaStreams.filter(
    (mediaStream) =>
      mediaStream.videoId !== 'remote_video' ||
      (mediaStream.videoId === 'remote_video' &&
        mediaStream.fromParty !== fromParty)
  );
  const pc = connection.find(
    (pc) => pc.token === token && pc.fromParty === fromParty
  );
  if (pc) {
    const { peerConnection, position: pos, remoteShareVideo } = pc;
    // return the position placement to the array of positions
    if (pos) {
      position.unshift(pos);
    }
    // close the pc
    peerConnection.close();

    if (remoteShareVideo) {
      checkRemoveTrack(true);
    }
    // remove pc from the array of pcs
    connection = connection.filter(
      (pc) => pc.token !== token || pc.fromParty !== fromParty
    );
    // remove the video element
    const remoteVideoContainer = document.querySelector(
      `.${pos}`
    )! as HTMLDivElement;
    const remoteVideos = Array.from(
      remoteVideoContainer.children
    ) as HTMLVideoElement[];

    remoteVideos.map((child) => {
      if (child.classList.contains('remote_video')) {
        if (child && child.srcObject) {
          child.pause();
          (<MediaStream>child.srcObject)
            .getTracks()
            .forEach((track) => track.stop());
          child.removeAttribute('src');
          child.load();
          // remove the video element
          child.remove();
        }
      }
    });
    const videoContainer = document.querySelector('#videoContainer')!;
    // remove the div element
    for (const child of videoContainer.children) {
      if (child.classList.contains(`${pos}`)) {
        child.remove();
      }
    }

    if (!connection.length) {
      // mute video
      mute.classList.remove('unmute');
      mute.disabled = true;
      video.muted = true;
      allMediaStreams.forEach((streamObj) => {
        if (streamObj.videoId === 'local_video') {
          streamObj.mediaStream.getAudioTracks()[0].enabled = false;
        }
      });
      shareScreen.disabled = true;
      replaceScreen.disabled = true;
      shareVideo.disabled = true;
      canvasChat.disabled = true;
      if (partySide === 'callee') {
        document.location = `${serverOrigin}`;
      }
    }
    if (partySide === 'caller' && pcDisconnect) {
      socket.send(
        JSON.stringify({
          token,
          type: 'pcDisconnect',
          toParty: fromParty,
        })
      );
    }
  }
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
  removeAllPC();
  if (partySide === 'caller') {
    setTimeout(() => {
      document.location = `${serverOrigin}/meeting/`;
    }, 2000);
  } else {
    setTimeout(() => {
      document.location = `${serverOrigin}`;
    }, 2000);
  }
};

const removeAllPC = () => {
  connection.forEach((pc) => {
    pc.peerConnection.close();
  });
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
 **/
const createVideo = (
  videoid: VideoId,
  event: RTCTrackEvent,
  fromParty: Signal['fromParty']
) => {
  // creates a video element
  const vid = document.createElement('video');
  // add the #id for this particular video
  vid.id = videoid;
  vid.className = 'smallVideoR';
  vid.setAttribute('autoplay', 'true');
  const divContainer = document.createElement('div');
  if (videoid === 'video_share') {
    divContainer.className = 'sharedVideoContainer';
    vid.className = 'shareVideo';
    if (videoContainer.classList.contains('videoContainerNoChat')) {
      videoContainer.classList.add('videoContainerNoChatShare');
    } else {
      videoContainer.classList.add('videoContainerChatShare');
    }
    divContainer.append(vid);

    // Insert video in the DOM
    videoContainer.append(divContainer);

    // Add remote stream tracks to the new video
    vid.srcObject = event.streams[0];
  } else {
    // assign a position for this video on screen
    const pos = position.shift();
    divContainer.className = `remoteVideoContainer ${pos}`;
    connection.forEach((pc) => {
      if (pc.fromParty === fromParty && pos) {
        pc.position = pos;
      }
    });
    divContainer.append(vid);

    // Insert video in the DOM
    videoContainer.append(divContainer);

    // Add remote stream tracks to the new video
    vid.srcObject = event.streams[0];

    //
    // Web Audio to show mic activity on the remote side
    //
    const { dataArray, analyser } = buildAudioGraph({
      stream: event.streams[0],
    });
    const canvasAudio = document.createElement('canvas');
    canvasAudio.className = 'canvasAudio noCanvasAudio';
    canvasAudio.setAttribute('height', '30');
    canvasAudio.setAttribute('width', '60');
    divContainer.append(canvasAudio);
    const canvasContext = canvasAudio.getContext('2d')!;
    const width = canvasAudio.width;
    const height = canvasAudio.height;
    requestAnimationFrame(() =>
      viewAudioGraph({
        canvasElement: canvasAudio,
        canvasContext,
        width,
        height,
        analyser,
        dataArray,
        treshold: 100,
      })
    );
  }

  // Add event listener for double click
  vid.addEventListener('dblclick', videoDblClick);

  return { mediaStream: event.streams[0], videoElement: vid, divContainer };
};
//
// This function checks if a track was removed to
// remove sharing video elements
//
const checkRemoveTrack = (pcIsGone: boolean) => {
  let timeout = true;
  const oneMediaStream = allMediaStreams.find(
    (mediaStream) => mediaStream.videoId === 'video_share'
  );

  if (!oneMediaStream) {
    // media already removed
    return;
  }

  const videoTracks = oneMediaStream.mediaStream.getTracks();

  if (!videoTracks.length || pcIsGone) {
    // Remove object
    allMediaStreams = allMediaStreams.filter(
      (mediaStream) => mediaStream.videoId !== 'video_share'
    );

    const videoElement = document.getElementById(
      'video_share'
    )! as HTMLVideoElement;
    if (videoElement.srcObject) {
      (<MediaStream>videoElement.srcObject)
        .getTracks()
        .forEach((track) => track.stop());
      videoElement.srcObject = null;
    }
    videoElement.remove();
    const divElement = document.querySelector(
      '.sharedVideoContainer'
    )! as HTMLDivElement;
    divElement.remove();
    const videoContainer = document.querySelector(
      '#videoContainer'
    )! as HTMLDivElement;
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
    .getDisplayMedia()
    .then((stream) => {
      const screenTrack = stream.getTracks()[0];
      // replaces local video sender track
      // indicates sharing screen for no video canvas replacement
      sharingScreen = true;
      connection.forEach((pc) => {
        const sender = pc.peerConnection
          .getSenders()
          .find((sender) => sender.track && sender.track.kind === 'video');
        if (sender) {
          sender.replaceTrack(screenTrack);
        }
      });

      // set callback for ended track
      // this is called when replaceScreen share has ended
      screenTrack.onended = function () {
        sharingScreen = false;
        replaceScreen.disabled = false;
        // check whether this party is sharing a video
        const videoStream = allMediaStreams.find(
          (stream) => stream.videoId === 'video_share'
        );
        if (!videoStream) {
          // let the button to share screen enabled
          shareScreen.disabled = false;
        }
        // check status of camera on / off
        if (noVideoCall) {
          // camera is off, sends canvas stream
          const canvasStream = allMediaStreams.find(
            (stream) => stream.videoId === 'canvas'
          );
          const canvasVideoTrack =
            canvasStream && canvasStream.mediaStream.getTracks()[0];
          // canvas media stream object holds sender from local_video

          connection.forEach((pc) => {
            const sender = pc.peerConnection
              .getSenders()
              .find((sender) => sender.track && sender.track.kind === 'video');
            if (sender && canvasVideoTrack) {
              sender.replaceTrack(canvasVideoTrack);
            }
          });
        } else {
          // camera is on, sends local media video
          const originalStream = allMediaStreams.find(
            (stream) => stream.videoId === 'local_video'
          );

          const originalTrack =
            originalStream && originalStream.mediaStream.getTracks()[1];

          connection.forEach((pc) => {
            const sender = pc.peerConnection
              .getSenders()
              .find((sender) => sender.track && sender.track.kind === 'video');
            if (sender && originalTrack) {
              sender.replaceTrack(originalTrack);
            }
          });
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
    .getDisplayMedia()
    .then((stream) => {
      const screenTrack = stream.getTracks()[0];
      // screen sent in a new track
      connection.forEach((pc) => {
        const { peerConnection, sendersSharedScreen } = pc;
        stream
          .getTracks()
          .forEach((track) =>
            sendersSharedScreen.push(peerConnection.addTrack(track, stream))
          );
      });
      // store media stream in peer connection object
      allMediaStreams.push({
        mediaStream: stream,
        videoId: 'screen',
      });
      // disable share video buttons
      shareVideo.disabled = true;

      screenTrack.onended = function () {
        // get senders
        connection.forEach((pc) => {
          const { peerConnection, sendersSharedScreen } = pc;
          sendersSharedScreen.forEach((sender) =>
            peerConnection.removeTrack(sender)
          );
          pc.sendersSharedScreen = [];
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

type setupSSS = {
  peerConnection: RTCPeerConnection;
  sendersSharedScreen: Pc['sendersSharedScreen'];
};

const setupSingleSharedScreen = ({
  peerConnection,
  sendersSharedScreen,
}: setupSSS) => {
  const mediaStreamObj = allMediaStreams.find(
    (stream) => stream.videoId === 'screen'
  );
  if (mediaStreamObj) {
    const { mediaStream } = mediaStreamObj;
    mediaStream.getTracks().forEach((track) => {
      sendersSharedScreen.push(peerConnection.addTrack(track, mediaStream));
    });
  }
};
//
// The following functions are related to sharing a video
//
interface HTMLVideoElementWithCaptureStream extends HTMLMediaElement {
  captureStream(): MediaStream;
}
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

  let myVideo = document.querySelector(
    '#myVideo'
  ) as HTMLVideoElementWithCaptureStream;
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
  } else {
    console.log('captureStream() not supported');
  }
};

const setupCaptureStream = (myVideoStream: MediaStream) => {
  const videoTracks = myVideoStream.getVideoTracks();

  // Add tracks
  connection.forEach((pc) => {
    const { peerConnection, sendersSharedVideo } = pc;
    myVideoStream.getTracks().forEach((track) => {
      sendersSharedVideo.push(peerConnection.addTrack(track, myVideoStream));
    });
  });

  // store media stream object
  allMediaStreams.push({
    mediaStream: myVideoStream,
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
  shareScreen.parentNode!.append(buttonElement);
  // add event to stop video
  buttonElement.addEventListener('click', stopVideo);

  // MediaStreamTrack.onended.
  // Call Back probably not called ever. Fixed it with map. TODO: Test it
  videoTracks.forEach((videoTrack) => {
    videoTrack.onended = function () {
      console.log('track onended called');
      allMediaStreams = allMediaStreams.filter(
        (streamsObj) => streamsObj.videoId !== 'myVideo'
      );

      connection.forEach((pc) => {
        const { peerConnection, sendersSharedVideo } = pc;
        sendersSharedVideo.forEach((track) =>
          peerConnection.removeTrack(track)
        );
        pc.sendersSharedVideo = [];
      });
      shareVideo.disabled = false;
      if (!sharingScreen) {
        shareScreen.disabled = false;
        replaceScreen.disabled = false;
      }
    };
  });
};

const setupSingleCaptureStream = ({
  peerConnection,
  sendersSharedVideo,
}: {
  peerConnection: RTCPeerConnection;
  sendersSharedVideo: RTCRtpSender[];
}) => {
  const mediaStreamObj = allMediaStreams.find(
    (stream) => stream.videoId === 'myVideo'
  );
  if (mediaStreamObj) {
    const { mediaStream } = mediaStreamObj;
    mediaStream.getTracks().forEach((track) => {
      sendersSharedVideo.push(peerConnection.addTrack(track, mediaStream));
    });
  }
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
  const videosContainer = document.querySelector('#videoContainer')!;
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
    let playPromise = (
      document.querySelector('#myVideo')! as HTMLVideoElementWithCaptureStream
    ).play();

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
  let videoElement = document.querySelector(
    '#myVideo'
  )! as HTMLVideoElementWithCaptureStream;

  videoElement.removeEventListener('loadeddata', checkSharing);
  let myVideoObj = allMediaStreams.find(
    (mediaStream) => mediaStream.videoId === 'myVideo'
  );

  // In case the video share did not succeed we remove it
  // but the stream may not be built
  if (myVideoObj) {
    connection.forEach((pc) => {
      const { peerConnection, sendersSharedVideo } = pc;
      sendersSharedVideo.forEach((track) => {
        peerConnection.removeTrack(track);
      });
      pc.sendersSharedVideo = [];
    });

    allMediaStreams = allMediaStreams.filter(
      (mediaStream) => mediaStream.videoId !== 'myVideo'
    );
    document.querySelector('#stopVideo')!.remove();
  }
  videoElement.pause();
  videoElement.currentTime = 0;
  videoElement.textContent = '';
  videoElement.srcObject = null;
  videoElement.load();
  videoElement.remove();
  // Change grid layout for regular videos
  const videoContainer = document.querySelector('#videoContainer')!;
  if (videoContainer.classList.contains('videoContainerNoChat')) {
    videoContainer.classList.remove('videoContainerNoChatShare');
  } else {
    videoContainer.classList.remove('videoContainerChatShare');
  }
  // remove container for video sharing
  document.querySelector('.localVideoShareContainer')!.remove();
  shareVideo.disabled = false;

  if (!sharingScreen) {
    shareScreen.disabled = false;
    replaceScreen.disabled = false;
  }
};

//
// Here ends video sharing
//

const videoDblClick = (event: MouseEvent) => {
  event.preventDefault();
  event.stopPropagation();
  const t = event.target as HTMLVideoElement;
  t.classList.toggle('fullScreen');
  if ((<HTMLElement>t.parentNode).id === 'localVideoContainer') {
    (<HTMLElement>t.parentNode).classList.toggle('fullScreenLocal');
    // set canvas width and height accordingly otherwise its
    // size won't match the video when changing its size
    canvasOverlay.width = t.offsetWidth;
    canvasOverlay.height = t.offsetHeight;
  }
};

const muteLocalVideo = (event: MouseEvent) => {
  const t = event.target as HTMLVideoElement;
  // console.log(t.nodeName, t.parentNode);
  if (t.nodeName === 'IMG') {
    (<HTMLElement>t.parentNode).classList.toggle('unmute');
  } else {
    t.classList.toggle('unmute');
  }
  connection.forEach((pc) => {
    const sender = pc.peerConnection.getSenders()[0];
    if (sender.track && sender.track.kind === 'audio') {
      sender.track.enabled = video.muted;
    }
  });
  allMediaStreams.forEach((streamObj) => {
    if (streamObj.videoId === 'local_video') {
      streamObj.mediaStream.getAudioTracks()[0].enabled = video.muted;
    }
  });
  video.muted = !video.muted;
};

const buildAudioGraph = ({ stream }: { stream: MediaStream }) => {
  const audioContext = new AudioContext();

  const sourceNode = audioContext.createMediaStreamSource(stream);

  // Create an analyser node
  const analyser = audioContext.createAnalyser();

  // power of 2
  analyser.fftSize = 32;
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  sourceNode.connect(analyser);
  analyser.connect(audioContext.destination);
  return { dataArray, analyser };
};

type AudioGraph = {
  canvasElement: HTMLCanvasElement;
  canvasContext: CanvasRenderingContext2D;
  width: HTMLCanvasElement['width'];
  height: HTMLCanvasElement['height'];
  analyser: AnalyserNode;
  dataArray: Uint8Array;
  treshold: number;
};

const viewAudioGraph = ({
  canvasElement,
  canvasContext,
  width,
  height,
  analyser,
  dataArray,
  treshold,
}: AudioGraph) => {
  canvasContext.save();
  canvasContext.fillStyle = 'rgba(0, 0, 0, 0.01)';
  canvasContext.fillRect(0, 0, width, height);

  analyser.getByteFrequencyData(dataArray);
  const nbFreq = dataArray.length;

  const spaceWidth = 4;
  const barWidth = 2;
  const numberBars = Math.floor(1.1 * Math.round(width / spaceWidth));
  let magnitude;

  canvasContext.lineCap = 'square';
  let mute = true;
  for (let i = 0; i < numberBars; ++i) {
    magnitude = 0.15 * dataArray[Math.round((i * nbFreq) / numberBars)];
    if (magnitude) {
      mute = false;
    }

    canvasContext.fillStyle =
      'hsl( ' + Math.round((i * 360) / numberBars) + ', 100%, 50%)';
    canvasContext.fillRect(i * spaceWidth, height, barWidth, -magnitude);
  }

  if (mute) {
    treshold--;
    if (!treshold) {
      treshold = 100;
      canvasElement.classList.add('noCanvasAudio');
    }
  } else {
    treshold--;
    if (!treshold) {
      treshold = 100;
      canvasElement.classList.remove('noCanvasAudio');
    }
  }
  canvasContext.restore();

  requestAnimationFrame(() =>
    viewAudioGraph({
      canvasElement,
      canvasContext,
      width,
      height,
      analyser,
      dataArray,
      treshold,
    })
  );
};

export { partySide, callToken, connection };
