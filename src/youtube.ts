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
  Pc,
  connection,
  myBridgeId,
  sharingScreen,
  createStopButton,
} from './webrtc';
import {} from './types/index.d';
import { toast } from './utils/toast';

// let isYoutubeIframeReady = false;
let player: YT.Player;
let isYoutubeOwner: boolean;
let messageTimestamp: number = 0;
let youtubeVideoId: string;
let isPlayList: boolean = false;
let playListId: string = '';
let playlist: string[] = [];
let playlistIndex: number;
let videoIdDesired: string = '';

const shareVideo = document.querySelector('#shareVideo')! as HTMLButtonElement;
const shareScreen = document.getElementById(
  'sharescreen'
)! as HTMLButtonElement;
const replaceScreen = document.getElementById(
  'replace-screen'
)! as HTMLButtonElement;
const shareYtube = document.getElementById('shareYtube')! as HTMLButtonElement;
const videosContainer = document.querySelector(
  '#videoContainer'
)! as HTMLDivElement;
const youtubeShareContainer = document.getElementById(
  'youtubeShareContainer'
)! as HTMLDivElement;
const playerIframe = document.getElementById(
  'youtubePlayer'
)! as HTMLIFrameElement;
const links = document.querySelector('.menu')! as HTMLDivElement;
const youtubeModal = document.querySelector(
  '.youtube-modal'
)! as HTMLDivElement;
const ytVideoId = document.getElementById('ytvideo-id')! as HTMLInputElement;
const playlistId = document.getElementById('playlist-id')! as HTMLInputElement;
const ytButton = document.getElementById('yt-submit')! as HTMLButtonElement;
const ytCancel = document.getElementById('yt-cancel')! as HTMLButtonElement;
const navToggle = document.querySelector('.nav-toggle')! as HTMLButtonElement;

window.onYouTubeIframeAPIReady = function () {
  console.log('iframeReady');

  // hide controls and related videos are not working
  // set to show controls anyway as unmute by software is
  // also not working.
  player = new YT.Player('youtubePlayer', {
    height: '360',
    width: '640',
    playerVars: {
      enablejsapi: 1, // YT.JsApi.Enable
      origin: document.location.origin,
      fs: 1, // YT.FullscreenButton.Show
      autoplay: 0, // YT.AutoPlay.NoAutoPlay
      rel: 1, // YT.RelatedVideos.Show
      controls: 1, // YT.Controls.ShowLoadPlayer
      autohide: 0, // YT.AutoHide.AlwaysVisible,
    },
    events: {
      onReady: onPlayerReady,
      onStateChange: onPlayerStateChange,
      onError: onPlayerError,
    },
  });
};

// The API will call this function when the video player is ready.
const onPlayerReady = (event: YT.PlayerEvent) => {
  console.log('player ready');
  // set to mute as sometimes when it is umuted the video does not start
  // programatically
  event.target.mute();
  // event.target.playVideo();
  console.log('onPlayerReady', player.getPlayerState());
  // Check if the video has loaded
  if (player.getDuration() <= 0 && isYoutubeOwner) {
    toast({
      alertClass: 'alert-danger',
      content: 'Youbube video id is invalid',
      modal: true,
    });
  } else if (isYoutubeOwner && isPlayList && player.getPlayerState() === 5) {
    playlist = player.getPlaylist();
    console.log(playlist);
    const videoUrl = player.getVideoUrl();
    const videoId = videoUrl.replace(/(.*)v=/, '');
    console.log(`url video id: ${videoId}`);
    console.log(`desired video id: ${videoIdDesired}`);
    const isVideoId = (playlistVideoId: string) => playlistVideoId === videoId;
    playlistIndex = playlist.findIndex(isVideoId);
    console.log(playlistIndex);
    player.loadVideoById(playlist[playlistIndex]);
  }
};

function onPlayerStateChange(event: YT.OnStateChangeEvent) {
  console.log(`State changed to ${event.data}`);

  if (isYoutubeOwner) {
    // YT.PlayerState.UNSTARTED
    if (event.data === -1) {
      console.log('state unstarted');
      // YT.PlayerState.ENDED
    } else if (event.data === 0) {
      console.log('state ended');
      // YT.PlayerState.PLAYING
    } else if (event.data === 1) {
      const seconds = player.getCurrentTime();
      const videoURL = player.getVideoUrl();
      const videoId = videoURL.replace(/(.*)v=/, '');

      sendYoutubeDataChannel(
        'ytPlayVideo',
        myBridgeId,
        false,
        undefined,
        videoId,
        seconds
      );
      // YT.PlayerState.PAUSED
    } else if (event.data === 2) {
      // Do not control pause,
      // the browser pauses when tab is out of focus.
      //
      // YT.PlayerState.BUFFERING
    } else if (event.data === 3) {
      console.log('state buffering');
      // YT.PlayerState.CUED
    } else if (event.data === 5) {
      console.log('state cued');
      if (isPlayList) {
        const seconds = player.getCurrentTime();
        const videoURL = player.getVideoUrl();
        const videoId = videoURL.replace(/(.*)v=/, '');

        sendYoutubeDataChannel(
          'ytLoadVideo',
          myBridgeId,
          false,
          undefined,
          videoId,
          seconds
        );
      }
    }
  }
}

function onPlayerError(event: YT.OnErrorEvent) {
  console.log(`youtube player error: ${event.data}`);
}

// Set the data channel for the caller side
const setYoutubeDataChannel = (pc: Pc) => {
  // sets the label for the data channel
  const dataChannel = pc.peerConnection.createDataChannel('youtube');
  pc.youtubeDataChannel = dataChannel;

  // set call back for the channel opened
  dataChannel.onopen = function () {
    // set the call back for receiving messages
    dataChannel.onmessage = receiveYoutubeMessage;
    console.log('Chair data channel opened for youtube');
  };
};

type Command =
  | 'ytSetupVideo'
  | 'ytRemoveVideo'
  | 'ytPlayVideo'
  | 'ytPauseVideo'
  | 'ytLoadVideo'
  | 'ytMuteVideo'
  | 'ytUnmuteVideo';

const receiveYoutubeMessage = (event: MessageEvent) => {
  // receive object from the other party
  if (event.isTrusted) {
    if (event.timeStamp > messageTimestamp) {
      messageTimestamp = event.timeStamp;

      const {
        command,
        bridgeId,
        videoId,
        seconds,
      }: {
        command: Command;
        bridgeId: string;
        videoId: string;
        seconds: number;
      } = JSON.parse(event.data);

      if (command === 'ytSetupVideo') {
        isYoutubeOwner = false;
        // save the youtube owner
        connection.forEach((pc) => {
          if (pc.fromParty === bridgeId) {
            pc.youtubeOwner = true;
          } else {
            pc.youtubeOwner = false;
          }
        });
        youtubeSetup(videoId);
      } else if (command === 'ytRemoveVideo') {
        removeYoutube();
      } else if (command === 'ytPlayVideo') {
        console.log('play video command');
        if (player.seekTo) {
          const videoURL = player.getVideoUrl();
          const currentVideoId = videoURL.replace(/(.*)v=/, '');
          if (videoId === currentVideoId) {
            player.seekTo(seconds, true);
            player.playVideo();
          } else {
            player.loadVideoById(videoId, seconds);
          }

          console.log(player.getPlayerState());
        } else {
          console.log('youtube player not ready yet');
        }
      } else if (command === 'ytPauseVideo') {
        if (player.getPlayerState() === 2) {
          // video is already paused
          console.log('pause video command, video was paused. Does nothing');
        } else if (player.getPlayerState() === 1) {
          console.log('pause video command, video was playing');
          player.pauseVideo();
        } else {
          console.log(
            `pause video command, video was in ${player.getPlayerState()} state`
          );
        }
      } else if (command === 'ytLoadVideo') {
        console.log('Load video command');
        if (player.seekTo) {
          const videoURL = player.getVideoUrl();
          const isPlayList = videoURL.includes('list=PL');
          if (isPlayList) {
            player.loadVideoById(videoId, seconds);
          } else {
            const currentVideoId = videoURL.replace(/(.*)v=/, '');
            if (videoId === currentVideoId) {
              player.seekTo(seconds, true);
              player.playVideo();
              console.log(player.getPlayerState());
            } else {
              player.loadVideoById(videoId, seconds);
            }
          }
        } else {
          console.log('youtube player not ready yet');
        }
      } else if (command === 'ytMuteVideo') {
        console.log('mute video');
        player.mute();
      } else if (command === 'ytUnmuteVideo') {
        player.unMute();
      }
    } else if (messageTimestamp === event.timeStamp) {
      console.log(`duplicated message`);
      console.log(event);
    } else {
      console.log(
        `youtube message timestamp is out of order: Previous ${messageTimestamp}, current: ${
          event.timeStamp
        }. Diff: ${messageTimestamp - event.timeStamp}`
      );
    }
  } else {
    console.log('Message not trusted');
  }
};

const handleYoutube = (_: Event) => {
  isYoutubeOwner = true;
  links.classList.toggle('show-menu');
  youtubeModal.classList.toggle('yt-modal-noshow');
  navToggle.disabled = true;
  ytButton.addEventListener('click', handleSubmit);
  ytCancel.addEventListener('click', cancelYoutube);
};

const cancelYoutube = (_: MouseEvent) => {
  isYoutubeOwner = false;
  youtubeModal.classList.toggle('yt-modal-noshow');
  navToggle.disabled = false;
};

const handleSubmit = (_: MouseEvent) => {
  if (!ytVideoId.value && !playlistId.value) {
    toast({
      alertClass: 'alert-danger',
      content: 'Please provide an Youbube video or playlist id',
      modal: true,
    });
    return;
  }

  youtubeModal.classList.toggle('yt-modal-noshow');
  navToggle.disabled = false;

  let youtubeString = ytVideoId.value;
  ytVideoId.value = '';
  if (youtubeString) {
    if (youtubeString.includes('list=PL')) {
      isPlayList = true;
      playListId = youtubeString.replace(/(.*)list=PL/, '');
      console.log(playListId);
      youtubeVideoId = `https://www.youtube.com/embed?listType=playlist&list=PL${playListId}&autoplay=0&enablejsapi=1&origin=${document.location.origin}`;
      if (youtubeString.includes('watch?v=')) {
        youtubeString = youtubeString.replace(/(.*)v=/, '');
        videoIdDesired = youtubeString.substring(0, youtubeString.indexOf('&'));
      }
    } else if (youtubeString.includes('watch?v=')) {
      isPlayList = false;
      youtubeString = youtubeString.replace(/(.*)v=/, '');
      console.log(youtubeString);
      youtubeVideoId = `https://www.youtube.com/embed/${youtubeString}?&autoplay=0&enablejsapi=1&origin=${document.location.origin}`;
    } else {
      isPlayList = false;
      console.log(youtubeString);
      youtubeVideoId = `https://www.youtube.com/embed/${youtubeString}?&autoplay=0&enablejsapi=1&origin=${document.location.origin}`;
    }
  } else {
    youtubeString = playlistId.value;
    playlistId.value = '';

    if (youtubeString.includes('list=PL')) {
      isPlayList = true;
      playListId = youtubeString.replace(/(.*)list=PL/, '');
      console.log(playListId);
      youtubeVideoId = `https://www.youtube.com/embed?listType=playlist&list=PL${playListId}&autoplay=0&enablejsapi=1&origin=${document.location.origin}`;
      if (youtubeString.includes('watch?v=')) {
        youtubeString = youtubeString.replace(/(.*)v=/, '');
        videoIdDesired = youtubeString.substring(0, youtubeString.indexOf('&'));
      }
    } else if (youtubeString.includes('watch?v=')) {
      isPlayList = false;
      youtubeString = youtubeString.replace(/(.*)v=/, '');
      console.log(youtubeString);
      youtubeVideoId = `https://www.youtube.com/embed/${youtubeString}?&autoplay=0&enablejsapi=1&origin=${document.location.origin}`;
    } else if (youtubeString.includes('PL')) {
      isPlayList = true;
      console.log(youtubeString);
      youtubeString = youtubeString.replace(/(.*)PL/, '');
      youtubeVideoId = `https://www.youtube.com/embed?listType=playlist&list=PL${youtubeString}&autoplay=0&enablejsapi=1&origin=${document.location.origin}`;
      videoIdDesired = '';
    } else {
      isPlayList = true;
      console.log(youtubeString);
      youtubeVideoId = `https://www.youtube.com/embed?listType=playlist&list=PL${youtubeString}&autoplay=0&enablejsapi=1&origin=${document.location.origin}`;
      videoIdDesired = '';
    }
  }

  youtubeSetup(youtubeVideoId);
};

const youtubeSetup = (ytVideoId: string) => {
  // disable sharing a new video
  shareVideo.disabled = true;
  // disable sharing a screen
  shareScreen.disabled = true;
  replaceScreen.disabled = true;
  shareYtube.disabled = true;

  // Set css class depending on chat presence
  if (videosContainer.classList.contains('videoContainerNoChat')) {
    videosContainer.classList.add('videoContainerNoChatShare');
  } else {
    videosContainer.classList.add('videoContainerChatShare');
  }
  playerIframe.src = ytVideoId;
  youtubeShareContainer.style.display = 'block';

  // const firstScriptTag = document.getElementsByTagName('script')[1];
  const firstScriptTag = document.querySelector('.unloaded')!;

  if (firstScriptTag.id !== 'loaded') {
    firstScriptTag.id = 'loaded';
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    firstScriptTag.parentNode!.insertBefore(tag, firstScriptTag);
    console.log('init script');
  }
  if (isYoutubeOwner) {
    createStopButton(removeYoutube);
    sendYoutubeDataChannel(
      'ytSetupVideo',
      myBridgeId,
      false,
      undefined,
      ytVideoId
    );
  }
};

const setupSingleYoutube = (pc: Pc) => {
  if (!isYoutubeOwner) return;
  // Set timeout to wait for data channel up
  setTimeout(() => {
    // setup youtube at remote PC
    // Is still up?
    if (isYoutubeOwner) {
      sendYoutubeDataChannel(
        'ytSetupVideo',
        myBridgeId,
        true,
        pc,
        youtubeVideoId
      );
      // send video current time
      // wait for the remote PC to load youtube player
      setTimeout(() => {
        const seconds = player.getCurrentTime();
        sendYoutubeDataChannel(
          'ytPlayVideo',
          myBridgeId,
          true,
          pc,
          '',
          seconds
        );
      }, 2000);
    }
  }, 1000);
};

const removeYoutube = () => {
  // Enable sharing a new video
  shareVideo.disabled = false;
  shareYtube.disabled = false;

  if (!sharingScreen) {
    // Enable sharing a screen
    shareScreen.disabled = false;
    replaceScreen.disabled = false;
  }

  // Set css class depending on chat presence
  if (videosContainer.classList.contains('videoContainerNoChat')) {
    videosContainer.classList.remove('videoContainerNoChatShare');
  } else {
    videosContainer.classList.remove('videoContainerChatShare');
  }

  player.stopVideo();
  player.mute();

  youtubeShareContainer.style.display = 'none';

  if (isYoutubeOwner) {
    // Ask eveyone else to remove the youtube video
    sendYoutubeDataChannel('ytRemoveVideo', myBridgeId, false, undefined);
    links.classList.toggle('show-menu');
    // remove stop button
    document.querySelector('#stopVideo')!.remove();
    isYoutubeOwner = false;
  }
};

const sendYoutubeDataChannel = (
  command: Command,
  bridgeId: string,
  singlePC: boolean,
  pc?: Pc,
  videoId?: string,
  seconds?: number
) => {
  if (!singlePC) {
    connection.forEach((pc) => {
      if (pc.youtubeDataChannel?.readyState === 'open') {
        pc.youtubeDataChannel!.send(
          JSON.stringify({
            command,
            bridgeId,
            videoId,
            seconds,
          })
        );
      } else
        console.log(
          `youtube send command not sent to ${pc.fromParty}. ReadyState not open`
        );
    });
  } else {
    if (pc!.youtubeDataChannel?.readyState === 'open') {
      pc!.youtubeDataChannel!.send(
        JSON.stringify({
          command,
          myBridgeId,
          videoId,
          seconds,
        })
      );
    } else {
      console.log(
        `youtube send command not sent to ${pc!.fromParty}. DataChannel: ${
          pc!.youtubeDataChannel
        }`
      );
    }
  }
};

export {
  setYoutubeDataChannel,
  handleYoutube,
  receiveYoutubeMessage,
  removeYoutube,
  setupSingleYoutube,
};
