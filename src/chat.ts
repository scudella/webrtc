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

import { partySide, callToken, connection, Pc } from './webrtc';
let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let messages: Message[] = [];
let toggleCanvas = false;
let dbWebRTC: IDBDatabase;
let queue: Message[] = [];

type Message = {
  fromName: string;
  message: string;
  fromMyself: boolean;
  date: Date;
  callToken: string;
  partySide: string;
};

const toggleCanvasChat = () => {
  // Remove menu from the front of the canvas
  document.querySelector('.menu')!.classList.toggle('show-menu');
  if (!toggleCanvas) {
    // draw canvas
    toggleCanvas = true;
    // decrease width for videos
    const videoContainer = document.getElementById(
      'videoContainer'
    )! as HTMLDivElement;
    videoContainer.classList.add('videoContainerChat');
    videoContainer.classList.remove('videoContainerNoChat');
    if (videoContainer.classList.contains('videoContainerNoChatShare')) {
      videoContainer.classList.remove('videoContainerNoChatShare');
      videoContainer.classList.add('videoContainerChatShare');
    }
    // Create containers for chat
    const chatContainer = document.createElement('div');
    chatContainer.id = 'chatContent';
    chatContainer.className = 'chatContainer';
    document.querySelector('.sc')!.append(chatContainer);
    const canvasContainer = document.createElement('div');
    canvasContainer.id = 'message';
    canvasContainer.className = 'item-canvas';
    chatContainer.append(canvasContainer);
    const inputContainer = document.createElement('div');
    inputContainer.id = 'inputTextArea';
    inputContainer.className = 'inputData';
    chatContainer.append(inputContainer);
    const sliderContainer = document.createElement('div');
    sliderContainer.id = 'sliderWrapper';
    sliderContainer.className = 'sliderWrapper';
    chatContainer.append(sliderContainer);

    // create canvas element and attributes
    const canvasElement = document.createElement('canvas');
    canvasElement.id = 'chat';
    canvasElement.className = 'chat';
    canvasElement.setAttribute('height', '360');
    canvasElement.setAttribute('width', '352');

    canvasContainer.append(canvasElement);

    // create text area input for chat
    const inputElement = document.createElement('textarea');
    inputElement.id = 'chatInput';
    inputElement.className = 'chatInput';
    // inputElement.classList.add('item-input');
    inputElement.placeholder = 'Type a message';
    // Set for 30 chars
    inputElement.cols = 30;
    // Set for 2 rows
    inputElement.rows = 2;
    // Max size of the message
    inputElement.maxLength = 160;
    // Wrap without inserting CRLF, but respecting it
    inputElement.wrap = 'soft';
    inputElement.className = 'item-input';

    // create send button
    const sendButtonElement = document.createElement('button');
    sendButtonElement.id = 'send';
    sendButtonElement.textContent = 'Send';
    sendButtonElement.className = 'item-send';

    inputContainer.append(inputElement, sendButtonElement);
    inputElement.focus();
    // Enable chat input
    inputElement.addEventListener('input', chatInputHandler);

    // Enable send chat button
    sendButtonElement.addEventListener('click', sendMessageChat);

    // Create input type range
    const slider = document.createElement('input');
    slider.id = 'slider';
    slider.setAttribute('type', 'range');
    slider.setAttribute('min', '1');
    slider.setAttribute('max', '10');
    slider.setAttribute('step', '1');
    slider.setAttribute('value', '1');
    slider.className = 'slider';
    sliderContainer.append(slider);
    slider.addEventListener('input', slideMessage);

    canvas = document.querySelector('#chat')!;
    ctx = canvas.getContext('2d')!;

    if (!dbWebRTC) {
      // If database not already created, create it, or open it!
      // If there is any messages it will be printed in readAllMessages()
      createDatabase('webrtcAppDB');
    }
    // Check if there is any message already sent
    // If the database is open it will be printed here.
    printMessage(canvas, ctx, messages, 1);
    slider.setAttribute('max', `${messages.length}`);
  }

  // destroy canvas
  else {
    toggleCanvas = false;

    // Remove chat containers and elements
    const chat = document.getElementById('chat')!;
    chat.removeAttribute('height');
    chat.removeAttribute('width');
    chat.remove();
    document.getElementById('message')!.remove();

    const chatInput = document.getElementById('chatInput')!;
    chatInput.removeEventListener('input', chatInputHandler);
    chatInput.remove();

    const sendButton = document.getElementById('send')! as HTMLButtonElement;
    sendButton.textContent = '';
    sendButton.removeEventListener('click', sendMessageChat);
    sendButton.remove();
    document.getElementById('inputTextArea')!.remove();

    const slider = document.getElementById('slider')!;
    slider.removeEventListener('input', slideMessage);
    slider.remove();
    document.getElementById('sliderWrapper')!.remove();
    document.getElementById('chatContent')!.remove();
    // increase width for videos
    const videoContainer = document.getElementById('videoContainer')!;
    videoContainer.classList.add('videoContainerNoChat');
    videoContainer.classList.remove('videoContainerChat');
    if (videoContainer.classList.contains('videoContainerChatShare')) {
      videoContainer.classList.remove('videoContainerChatShare');
      videoContainer.classList.add('videoContainerNoChatShare');
    }
  }
};

// Set the data channel for the caller side
const setDataChannel = (pc: Pc) => {
  // sets the label for the data channel
  const dataChannel = pc.peerConnection.createDataChannel('chat');
  pc.chatDataChannel = dataChannel;

  // set call back for the channel opened
  dataChannel.onopen = () => {
    // set the call back for receiving messages
    dataChannel.onmessage = receiveMessage;
    console.log('Caller data channel opened');
  };
};

const receiveMessage = (event: MessageEvent) => {
  // receive object from the other party
  const obj = JSON.parse(event.data);
  // save remote login
  const name = obj.name;
  // save the message
  const msg = obj.message;

  // read my login from local storage
  let myUser, myName;
  if (localStorage.getItem('user')) {
    myUser = JSON.parse(localStorage.getItem('user')!);
  }
  if (myUser != null) {
    myName = myUser.name;
  }
  if (name === myName) {
    console.log(
      'Login from remote message is equal to local. Are you at localhost?'
    );
  }

  const date = new Date();

  // create a new object message with the remote login,
  // the received message, indicating that is not from myself
  // the date, the ws token without the # tag and the caller or callee side
  const messageR: Message = {
    fromName: name,
    message: msg,
    fromMyself: false,
    date,
    callToken,
    partySide,
  };

  if (!dbWebRTC) {
    // If database not already created, create it, or open it!
    createDatabase('webrtcAppDB');
  }

  // Need to make sure database is already opened.
  if (!dbWebRTC) {
    // postpone adding message until database opened.
    queue.push(messageR);
  } else {
    addMessage(messageR);
    messages.push(messageR);
    // print in the canvas if it is built.
    if (toggleCanvas) {
      printMessage(canvas, ctx, messages, 1);
      // Set slider max attribute
      document
        .getElementById('slider')!
        .setAttribute('max', `${messages.length}`);
    }
  }
};

// peer_connection call back for ondatachannel on the callee side
const onDataChannel = (event: RTCDataChannelEvent, pc: Pc) => {
  // setting data channel
  const dataChannel = event.channel;
  pc.chatDataChannel = dataChannel;
  // when channel opens, just send message to the console
  dataChannel.onopen = function () {
    console.log('Data channel opened');
  };
  // set the call back for receiving messages
  dataChannel.onmessage = receiveMessage;
};

const chatInputHandler = () => {
  const chatInput = document.querySelector(
    '#chatInput'
  )! as HTMLTextAreaElement;
  const send = document.querySelector('#send')! as HTMLButtonElement;
  // The text area takes care of the message formatting
  // we just enable or disable the button in case there is
  // any character entered
  if (chatInput.value.length) {
    send.disabled = false;
  } else {
    send.disabled = true;
  }
};

const sendMessageChat = () => {
  const chatInput = document.querySelector(
    '#chatInput'
  )! as HTMLTextAreaElement;
  // Set focus back to the text area
  chatInput.focus();
  const send = document.querySelector('#send')! as HTMLButtonElement;
  // get a new date
  const date = new Date();
  // if there is no login set, let us use 'local'
  let user, name: string;

  if (localStorage.getItem('user')) {
    user = JSON.parse(localStorage.getItem('user')!);
    if (user != null) {
      name = user.name;
    } else {
      name = 'Anonymous';
    }
  } else {
    name = 'Anonymous';
  }

  // create a new message object with login; the content of
  // the text area; setting that is from myself; the date;
  // the ws token without # tag; and the indication of
  // caller or callee. The party side is required when
  // accessing as local host and sharing the same indexed db.
  const messageL: Message = {
    fromName: name,
    message: chatInput.value,
    fromMyself: true,
    date,
    callToken,
    partySide,
  };
  // add message to the indexed db
  addMessage(messageL);
  // add message to the queue
  messages.push(messageL);
  // reprint the messages to the canvas
  // with this in the bottom
  printMessage(canvas, ctx, messages, 1);
  // Set slider max attribute
  document.getElementById('slider')!.setAttribute('max', `${messages.length}`);
  // send the message to the other parties as an object
  // including the login to print in their canvas.
  // Each party put its own date and time.
  connection.forEach((pc) => {
    pc.chatDataChannel &&
      pc.chatDataChannel.send(
        JSON.stringify({
          message: chatInput.value,
          name,
        })
      );
  });
  // disable the send button
  send.disabled = true;
  // cleans up the input message
  chatInput.value = '';
};

const printMessage = (
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  messages: Message[],
  messagePos: number
) => {
  let x: number, y: number;
  // Set y to the bottom of the canvas
  y = canvas.height;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // Get 1st the last message
  for (let i = messages.length - messagePos + 1; i > 0; i--) {
    // Select the font
    ctx.font = 'bold 10px serif';
    let currentMessage = messages[i - 1];

    // format message to fit the box
    const formattedMessage = formatMessage(currentMessage.message);
    const messageHeight = 25 + 15 * formattedMessage.length;
    //
    // Move y coordinate up for the next message
    y += -10 - messageHeight;
    // console.log(`y= ${y}, messageHeight = ${messageHeight}`);

    // Format right or left and different background colors
    // if message from myself or from someone else

    // Draw the placeholder for the message
    if (currentMessage.fromMyself) {
      x = 45;
      ctx.strokeStyle = 'rgb(33,33,33)';
      ctx.fillStyle = 'rgb(137, 207, 242)';
      ctx.lineWidth = 1;
      roundedRect(
        ctx,
        x - 5,
        y - 15,
        canvas.width - 55,
        messageHeight,
        20,
        true,
        true
      );
    } else {
      x = 15;
      ctx.strokeStyle = 'rgb(33,33,33)';
      ctx.fillStyle = 'rgb(100, 227, 172)';
      ctx.lineWidth = 1;
      roundedRect(
        ctx,
        x - 5,
        y - 15,
        canvas.width - 55,
        messageHeight,
        20,
        true,
        true
      );
    }

    // Print from name
    ctx.fillStyle = 'rgb(33,33,33';
    ctx.fillText(currentMessage.fromName.toString(), x + 5, y);

    // format the date according to: last 24hs, last week, or older
    const dateTime = formatDate(currentMessage.date);

    // Print the date
    ctx.fillText(dateTime, x + 140 - dateTime.length, y);
    // Change font size for the message content
    ctx.font = '14px serif';
    let internalY = y;
    formattedMessage.forEach((message) => {
      ctx.fillText(message.toString(), x + 20, internalY + 15);
      internalY += 15;
    });
  }
};

const roundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: boolean,
  stroke: boolean
) => {
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

  // Fill and / or stroke
  if (fill) {
    ctx.fill();
  }
  if (stroke) {
    ctx.stroke();
  }
};

//*
//* While the textarea element formats the message, it does not
//* insert CRLF at the wrap, even when you do wrap:hard.
//* This function helps to format the message in the canvas.
//*

const formatMessage = (message: string) => {
  // Array for the break lines
  const messageLines = [];
  let lineLength = 30;
  // Mark the initial of the new line
  let charPos = 0;
  let j = 1;
  // To assess if the break is within a word
  let isWord = true;
  let lastSpacePos = 0;
  let i;

  for (i = 0; i < message.length; i++) {
    if (j < lineLength) {
      let char = message.charAt(i);
      if (char === '\n') {
        // end of line found
        // slice - start to end. end not included
        messageLines.push(message.slice(charPos, i));
        // Advances charPos to the initial of the new line
        charPos += j;
        lastSpacePos = charPos;
        j = 1;
        isWord = false;
      } else if (
        char === ' ' ||
        char === ',' ||
        char === '\t' ||
        char === '.' ||
        char === ';' ||
        char === '!' ||
        char === '?' ||
        char === ')'
      ) {
        isWord = false;
        lastSpacePos = i;
        j++;
      } else {
        isWord = true;
        j++;
      }
    } else {
      // message arrived at end of line without \n
      i--;
      j--;
      if (isWord) {
        // get line up to the last blank if there is any
        if (lastSpacePos > charPos) {
          messageLines.push(message.slice(charPos, lastSpacePos));
          // Position to the last blank
          charPos += j - (i - lastSpacePos);
          i = lastSpacePos;
          j = 1;
          isWord = false;
        } else {
          // No blank in the last line.
          // slice - start to end. end not included
          messageLines.push(message.slice(charPos, i + 1));
          charPos += j;
          lastSpacePos = charPos;
          j = 1;
        }
      } else {
        messageLines.push(message.slice(charPos, i));
        charPos += j;
        lastSpacePos = charPos;
        j = 1;
      }
    }
  }
  // Reached end of message
  if (j > 1) {
    messageLines.push(message.slice(charPos, i));
  }
  return messageLines;
};

const formatDate = (date: Date) => {
  // Get a new date
  const now = new Date();
  const diff = new Date();

  // decrease 1 week in miliseconds from today
  diff.setTime(now.getTime() - 6.048e8);
  // if date is over 7 days, use whole date format
  if (diff > date) {
    return date.toLocaleString();
    //
    // It is not over 7 days but the same week day?
    // better use whole date format
    // eliminate case when the message is from today
  } else if (
    date.getDay() === diff.getDay() &&
    now.getDay() !== date.getDay()
  ) {
    return date.toLocaleString();
  }
  // decrease 1 day in miliseconds
  diff.setTime(now.getTime() - 8.64e7);
  // if date is over 1 day, use day of week and time
  if (diff > date) {
    return date.toDateString().slice(0, 3) + date.toLocaleString().slice(9);
  } else {
    // less than 24hs but it is today or yesterday
    //
    if (now.getDay() === date.getDay()) {
      // today
      return date.toLocaleTimeString('en-US');
    } else {
      // yesterday
      return date.toDateString().slice(0, 3) + date.toLocaleString().slice(9);
    }
  }
};

const createDatabase = (dbName: string) => {
  if (!window.indexedDB) {
    window.alert(
      "Your browser doesn't support a stable version of IndexedDB. You won't be able to save messages."
    );
    return;
  }
  // Open database with version = 1. Use integer valueonly !
  const request = indexedDB.open(dbName, 1);

  request.onupgradeneeded = function (event) {
    console.log(
      'request.onupgradeneeded, we are creating a new version of the dataBase'
    );
    dbWebRTC = (<IDBOpenDBRequest>event.target)!.result;

    // Create an objectStore to hold information about the chat messages. We're
    // going  to use an autoincrement key.
    //
    const objectStore = dbWebRTC.createObjectStore('messages', {
      autoIncrement: true,
    });

    // Create indexes to search messages by name, token and party. We may have duplicates
    // so we can't use a unique index.
    objectStore.createIndex('name', 'fromName', { unique: false });

    objectStore.createIndex('token', 'token', { unique: false });

    objectStore.createIndex('party', 'partySide', { unique: false });

    // Provide an welcome message

    const dateTime = new Date();

    const welcomeMessage: Message = {
      fromName: 'webrtc',
      message:
        'Hello! Welcome to WebRTC App! Type your message in the field below and press send!',
      fromMyself: false,
      date: dateTime,
      callToken,
      partySide,
    };
    messages.push(welcomeMessage);
  };

  request.onsuccess = function (event) {
    console.log('request.onsuccess, database opened');
    // The result is the database itself
    dbWebRTC = (<IDBOpenDBRequest>event.target)!.result;
    // Are there any messages received in the queue?
    // Load in the database
    queue.forEach((message) => addMessage(message));
    queue = [];
    // Populate messages[] with any previous interaction with the current token
    readAllMessages();
  };
};

const addMessage = (message: Message) => {
  // Create a read / write transaction
  const transaction = dbWebRTC.transaction(['messages'], 'readwrite');

  // Do something when all the data is added to the database.
  transaction.oncomplete = function (_) {
    // console.log('All done adding messages to the database!');
  };

  transaction.onerror = function (event) {
    console.log(
      `transaction.onerror errcode ${
        (event.target as IDBTransaction).error?.name
      }`
    );
  };

  const objectStore = transaction.objectStore('messages');

  // Save message in the message store
  const request = objectStore.add(message);

  request.onsuccess = function (_) {
    // console.log(`Message ${event} added.`);
  };

  request.onerror = function (event: Event) {
    console.log(
      `request.onerror, could not insert message, errorcode = ${event.target}`
    );
  };
};

const readAllMessages = () => {
  if (!dbWebRTC) {
    console.log('Error! dbWebRTC not opened');
  } else {
    const objectStore = dbWebRTC
      .transaction('messages')
      .objectStore('messages');
    // the array of messages that will hold results

    objectStore.openCursor().onsuccess = function (event: Event) {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        // add a message in the array with the same token and party
        // party is used to avoid duplicated messages in localhost usage
        if (
          cursor.value.partySide === partySide &&
          cursor.value.callToken === callToken
        ) {
          messages.push(cursor.value);
        }
        cursor.continue();
      } else {
        // print messages if canvas is present
        if (toggleCanvas) {
          printMessage(canvas, ctx, messages, 1);
          document
            .getElementById('slider')!
            .setAttribute('max', `${messages.length}`);
        }
      }
    };
  }
};

const slideMessage = () => {
  const slider = document.getElementById('slider')! as HTMLInputElement;
  printMessage(canvas, ctx, messages, +slider.value);
};

export { setDataChannel, onDataChannel, toggleCanvasChat };
