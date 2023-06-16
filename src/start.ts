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

import { toast } from './utils/toast';
import { copyrightDate } from './utils/date';
import axios from 'axios';

window.onload = function init() {
  const videoButton = document.getElementById(
    'startvideo'
  )! as HTMLButtonElement;
  const inputCode = document.querySelector('#givenToken')! as HTMLInputElement;
  const urlField = document.querySelector('#url')! as HTMLInputElement;
  const codeCopy = document.getElementById('codeCopy')! as HTMLElement;
  const codeCheck = document.getElementById('codeCheck')! as HTMLElement;
  const urlCopy = document.getElementById('urlCopy')! as HTMLElement;
  const urlCheck = document.getElementById('urlCheck')! as HTMLElement;
  copyrightDate();

  const fetchUser = async () => {
    try {
      await axios.get(`/api/v1/users/showMe`);
      document.location = `${document.location.origin}/meeting/`;
    } catch (error) {
      console.log('user not logged');
    }
  };

  const inputURL = () => {
    const result = urlField.value.match(/#[A-Za-z0-9-]+/);
    if (result) {
      inputCode.value = result[0].substring(1);
    } else {
      inputCode.value = '';
    }
  };

  const inputToken = () => {
    const result = inputCode.value.match(/[A-Za-z0-9-]+/);
    if (result) {
      inputCode.value = result[0];
      urlField.value = `${document.location.origin}/app/#${inputCode.value}`;
    } else {
      urlField.value = '';
      inputCode.value = '';
    }
  };
  const videoCall = () => {
    if (!inputCode.value) {
      toast({
        alertClass: 'alert-danger',
        content: 'Please, provide a meeting code',
      });
    } else {
      // store token to app usage
      localStorage.setItem('callToken', inputCode.value);
      localStorage.setItem('partySide', 'callee');
      localStorage.setItem('user', '');
      document.location = `${document.location.origin}/app/#${inputCode.value}`;
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

  videoButton.addEventListener('click', videoCall);
  inputCode.addEventListener('input', inputToken);
  urlField.addEventListener('input', inputURL);
  codeCopy.addEventListener('click', codeToClip);
  urlCopy.addEventListener('click', urlToClip);
  fetchUser();
};
