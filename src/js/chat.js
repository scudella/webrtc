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

import { peerConnection } from './webrtc.js';
let canvas;
let ctx;
let messages = [];
let toggleCanvas = false;
let x = 10,
  y = 10;
let dataChannel = null;

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

function toggleCanvasChat() {
  // Remove menu from the front of the canvas
  const links = document.querySelector('.menu');
  links.classList.toggle('show-menu');
  // draw canvas
  if (!toggleCanvas) {
    toggleCanvas = true;
    // create element and attributes
    let canvasElement = document.createElement('canvas');
    canvasElement.id = 'chat';
    canvasElement.className = 'chat';
    canvasElement.setAttribute('height', '380');
    canvasElement.setAttribute('width', '300');

    // insert at message id div
    let messageid = document.getElementById('message');
    messageid.append(canvasElement);

    // create input for chat
    let inputElement = document.createElement('input');
    inputElement.type = 'text';
    inputElement.id = 'chatInput';
    inputElement.className = 'chatInput';
    inputElement.placeholder = 'Type a message';
    let inputSend = document.getElementById('inputSend');
    inputSend.append(inputElement);

    // Enable chat input
    let chat = document.querySelector('#chatInput');
    chat.addEventListener('input', chatInput);

    // create send button
    let sendButtonElement = document.createElement('button');
    sendButtonElement.id = 'send';
    sendButtonElement.textContent = 'Send';
    inputSend.append(sendButtonElement);

    // Enable send chat button
    let sendMessage = document.querySelector('#send');
    sendMessage.addEventListener('click', sendMessageChat);

    canvas = document.querySelector('#chat');
    ctx = canvas.getContext('2d');

    // Check if there is any message already sent
    printMessage(canvas, ctx, messages);
  }

  // destroy canvas
  else {
    toggleCanvas = false;

    let chat = document.getElementById('chat');
    chat.removeAttribute('height');
    chat.removeAttribute('width');
    chat.remove();

    let chatInput = document.getElementById('chatInput');
    chatInput.removeEventListener('input', chatInput);
    chatInput.remove();

    let sendButton = document.getElementById('send');
    sendButton.textContent = '';
    sendButton.removeEventListener('click', sendMessageChat);
    sendButton.remove();
  }
}

function setDataChannel() {
  dataChannel = peerConnection.createDataChannel('chat');
  console.log('data channel created ');
  console.log(dataChannel);

  dataChannel.onopen = function () {
    console.log('Caller data channel opened');
  };

  dataChannel.onmessage = receiveMessage;
}

function receiveMessage(event) {
  let date = new Date();
  date.toDateString();
  let messageR = new Message('Remote', event.data, false, date);
  messages.push(messageR);
  console.log(messages.length);
  if (toggleCanvas) {
    printMessage(canvas, ctx, messages);
  }
}

function onDataChannel(event) {
  dataChannel = event.channel;
  dataChannel.onopen = function () {
    console.log('Data channel opened');
  };
  dataChannel.onmessage = receiveMessage;
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
  let messageL = new Message('local', chatInput.value, true, date);
  messages.push(messageL);
  // console.log(messages.length);
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

let roundedRect = function (ctx, x, y, width, height, radius, fill, stroke) {
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

export { setDataChannel, onDataChannel, dataChannel, toggleCanvasChat };
