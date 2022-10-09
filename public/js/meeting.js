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
let callToken = '';
window.onload = function init() {
  const logoutButton = document.getElementById('logout');
  const givenToken = document.querySelector('#givenToken');
  const urlField = document.querySelector('#url');
  const inputCode = document.querySelector('.token-form');
  const tokenGen = document.querySelector('#tokenGen');
  const videoButton = document.getElementById('startvideo');
  const avatar = document.querySelector('.user');
  const alert = document.querySelector('.alert-show');
  const codeCopy = document.getElementById('codeCopy');
  const codeCheck = document.getElementById('codeCheck');
  const urlCopy = document.getElementById('urlCopy');
  const urlCheck = document.getElementById('urlCheck');

  const processGen = () => {
    callToken = Date.now() + '-' + Math.round(Math.random() * 10000);
    givenToken.value = callToken;
    urlField.value = `${document.location.origin}/app/#${callToken}`;
  };
  const fetchUser = async () => {
    try {
      const response = await axios.get(`/api/v1/users/showMe`);
      const user = response.data.user;
      // store user to local storage
      localStorage.setItem('user', JSON.stringify(user));
    } catch (error) {
      localStorage.setItem('user', '');
      document.location = `${document.location.origin}`;
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
  const videoCall = () => {
    if (!callToken) {
      alert.textContent = 'Please, provide a meeting code';
      alert.style.opacity = '1';
      setTimeout(() => {
        alert.style.opacity = '0';
      }, 2000);
    } else {
      if (callToken.length < 8) {
        alert.textContent = 'Meeting code minimum length is 8';
        alert.style.opacity = '1';
        setTimeout(() => {
          alert.style.opacity = '0';
        }, 2000);
      } else {
        // store token to app usage
        localStorage.setItem('callToken', callToken);
        document.location = `${document.location.origin}/app/`;
      }
    }
  };

  const logoutUser = async () => {
    try {
      await axios.delete('/api/v1/auth/logout');
      localStorage.removeItem('user');
      document.location = `${document.location.origin}`;
    } catch (error) {
      console.log(error);
    }
  };

  const codeToClip = async () => {
    await navigator.clipboard.writeText(givenToken.value);
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

  tokenGen.addEventListener('click', processGen);
  videoButton.addEventListener('click', videoCall);
  inputCode.addEventListener('input', inputToken);
  const user = JSON.parse(localStorage.getItem('user'));
  logoutButton.addEventListener('click', logoutUser);
  codeCopy.addEventListener('click', codeToClip);
  urlCopy.addEventListener('click', urlToClip);

  if (user) {
    avatar.innerText = user.name;
  }
  fetchUser();
};
