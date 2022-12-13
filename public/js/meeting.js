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

import { toast } from './utils/toast.js';
import { fetchRoom, fetchUser } from './utils/user.js';
import { copyrightDate } from './utils/date.js';

window.onload = async function init() {
  let callToken = '';
  let create = true;
  const logoutButton = document.getElementById('logout');
  const urlField = document.querySelector('#url');
  const inputCode = document.querySelector('#givenToken');
  const tokenGen = document.querySelector('#tokenGen');
  const videoButton = document.getElementById('startvideo');
  const avatar = document.querySelector('.user');
  const avatarPic = document.querySelector('.avatar');
  const codeCopy = document.getElementById('codeCopy');
  const codeCheck = document.getElementById('codeCheck');
  const urlCopy = document.getElementById('urlCopy');
  const urlCheck = document.getElementById('urlCheck');
  const btnCreate = document.getElementById('btn-create');
  const btnJoin = document.getElementById('btn-join');
  const meetTitle = document.getElementById('meet-title');
  copyrightDate();

  const processGen = () => {
    callToken = `${Date.now()}-${Math.round(Math.random() * 10000)}`;
    inputCode.value = callToken;
    urlField.value = `${document.location.origin}/app/#${callToken}`;
  };

  const inputURL = () => {
    const result = urlField.value.match(/#[A-Za-z0-9-]+/);
    if (result) {
      inputCode.value = result[0].substring(1);
      callToken = inputCode.value;
    } else {
      urlField.value = '';
      inputCode.value = '';
      callToken = '';
    }
  };

  const inputToken = () => {
    const result = inputCode.value.match(/[A-Za-z0-9-]+/);
    if (result) {
      inputCode.value = result[0];
      urlField.value = `${document.location.origin}/app/#${inputCode.value}`;
      callToken = inputCode.value;
    } else {
      urlField.value = '';
      inputCode.value = '';
      callToken = '';
    }
  };
  const videoCall = async () => {
    if (!callToken) {
      toast({
        alertClass: 'alert-danger',
        content: 'Please, provide a meeting code',
        modal: true,
      });
    } else {
      if (callToken.length < 8) {
        toast({
          alertClass: 'alert-danger',
          content: 'Meeting code minimum length is 8',
          modal: true,
        });
      } else {
        if (create) {
          // create a room
          try {
            const room = { name: callToken };
            const response = await axios.post(
              `/api/v1/meeting/update-room`,
              room
            );
            toast({
              alertClass: 'alert-success',
              content: response.data.msg,
              modal: true,
            });
            // store token to app usage
            localStorage.setItem('callToken', callToken);
            localStorage.setItem('partySide', 'caller');
            setTimeout(() => {
              document.location = `${document.location.origin}/app/#${callToken}`;
            }, 2000);
          } catch (error) {
            toast({ alertClass: 'alert-danger', error, modal: true });
          }
        } else {
          // join another meeting
          // store token to app usage
          localStorage.setItem('callToken', callToken);
          localStorage.setItem('partySide', 'callee');
          document.location = `${document.location.origin}/app/#${callToken}`;
        }
      }
    }
  };

  const logoutUser = async () => {
    try {
      await axios.delete('/api/v1/auth/logout');
      localStorage.removeItem('user');
      localStorage.removeItem('partySide');
      document.location = `${document.location.origin}`;
    } catch (error) {
      console.log(error);
    }
  };

  const codeToClip = async () => {
    await navigator.clipboard.writeText(inputCode.value);
    codeCopy.classList.add('no-copy');
    codeCheck.classList.remove('no-copy');
    setTimeout(() => {
      codeCheck.classList.add('no-copy');
      codeCopy.classList.remove('no-copy');
    }, 2000);
  };

  const urlToClip = async () => {
    await navigator.clipboard.writeText(urlField.value);
    urlCopy.classList.add('no-copy');
    urlCheck.classList.remove('no-copy');
    setTimeout(() => {
      urlCheck.classList.add('no-copy');
      urlCopy.classList.remove('no-copy');
    }, 2000);
  };

  const formCreate = () => {
    btnJoin.disabled = false;
    btnCreate.disabled = true;
    meetTitle.innerText = 'Create a new meeting';
    tokenGen.disabled = false;
    urlField.disabled = true;
    create = true;
    if (room) {
      inputCode.value = room;
      urlField.value = `${document.location.origin}/app/#${inputCode.value}`;
      callToken = inputCode.value;
    }
  };
  const formJoin = () => {
    btnJoin.disabled = true;
    btnCreate.disabled = false;
    meetTitle.innerText = 'Join a meeting';
    tokenGen.disabled = true;
    urlField.disabled = false;
    create = false;
    inputCode.value = '';
    urlField.value = '';
    callToken = '';
  };

  tokenGen.addEventListener('click', processGen);
  videoButton.addEventListener('click', videoCall);
  inputCode.addEventListener('input', inputToken);
  urlField.addEventListener('input', inputURL);
  if (localStorage.getItem('user')) {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
      avatar.innerText = user.name.substring(0, 26);
      avatarPic.src = user.picture;
    }
  }
  logoutButton.addEventListener('click', logoutUser);
  codeCopy.addEventListener('click', codeToClip);
  urlCopy.addEventListener('click', urlToClip);
  btnCreate.addEventListener('click', formCreate);
  btnJoin.addEventListener('click', formJoin);

  const user = await fetchUser();
  if (!user) {
    document.location = document.location.origin;
  }
  const room = await fetchRoom();
  if (room) {
    inputCode.value = room;
    urlField.value = `${document.location.origin}/app/#${inputCode.value}`;
    callToken = inputCode.value;
  }
};
