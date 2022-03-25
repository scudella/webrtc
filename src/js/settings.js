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

import { serverUrl, port } from './webrtc.js';

window.onload = function init() {
  let login = document.querySelector('#login');
  login.addEventListener('input', loginInput);

  let oldLogin = localStorage.getItem('login');
  if (oldLogin !== '') {
    document.forms['mySettings']['login'].value = oldLogin;
  }

  let replaceVideo = localStorage.getItem('replace');
  if (replaceVideo == null) {
    document.getElementById('newVideo').checked = true;
  } else if (replaceVideo === 'sameVideo') {
    document.getElementById('sameVideo').checked = true;
  } else {
    document.getElementById('newVideo').checked = true;
  }

  function loginInput() {
    // let loginRegex = /^[a-zA-Z][a-zA-Z0-9_-]{7-33}$/;
    let loginRegex = /^[A-Za-z0-9_-]{6,32}$/;
    let validLogin =
      document.forms['mySettings']['login'].value.match(loginRegex);
    if (!validLogin) {
      document.getElementById('login').classList.add('inputInvalid');
    } else {
      document.getElementById('login').classList.remove('inputInvalid');
    }
    console.log(validLogin);
  }

  let form = document.getElementById('form');
  form.addEventListener('submit', formReady);

  function formReady(evt) {
    evt.preventDefault();
    let loginRegex = /^[a-zA-Z][a-zA-Z0-9]/;
    let validLogin =
      document.forms['mySettings']['login'].value.match(loginRegex);
    if (validLogin !== null) {
      let login = document.forms['mySettings']['login'].value;
      localStorage.setItem('login', login);

      let replaceVideo = document.getElementById('sameVideo');
      if (replaceVideo.checked) {
        localStorage.setItem('replace', 'sameVideo');
      } else {
        localStorage.setItem('replace', 'newVideo');
      }
      document.location = `${serverUrl}:${port}`;
      return true;
    } else {
      alert(
        'Login must be filled out with a valid login. Letter followed by alphanumeric'
      );
      return false;
    }
  }
};
const date = document.querySelector('#date');
// set year
date.innerHTML = new Date().getFullYear();
