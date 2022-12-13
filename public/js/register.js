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
import { googleButtonLogin } from './utils/googleLogin.js';
import { copyrightDate } from './utils/date.js';

window.onload = function init() {
  const inputName = document.getElementById('name');
  const inputEmail = document.getElementById('email');
  const inputPassword = document.getElementById('password');
  const form = document.querySelector('.form');
  const sectionMeeting = document.querySelector('.meeting');
  const sectionPage = document.querySelector('.page');
  const alert = document.querySelector('.alert-show');
  copyrightDate();
  let name = '';
  let email = '';
  let password = '';

  const getName = (e) => {
    name = e.target.value;
  };

  const getEmail = (e) => {
    email = e.target.value;
  };

  const getPassword = (e) => {
    password = e.target.value;
  };

  const register = async (e) => {
    e.preventDefault();
    form.classList.add('no-form');
    sectionMeeting.classList.add('no-meeting');
    sectionPage.classList.remove('no-page');
    const registerUser = { name, email, password };
    try {
      const response = await axios.post(`/api/v1/auth/register`, registerUser);
      inputName.value = '';
      inputEmail.value = '';
      inputPassword.value = '';
      // send alert to read email
      sectionPage.classList.add('no-page');
      sectionMeeting.classList.remove('no-meeting');
      alert.classList.add('alert-success');
      alert.style.opacity = '1';
      alert.textContent = response.data.msg;
    } catch (error) {
      sectionPage.classList.add('no-page');
      sectionMeeting.classList.remove('no-meeting');
      toast({ alertClass: 'alert-danger', error });
      setTimeout(() => {
        form.classList.remove('no-form');
      }, 3200);
    }
  };

  const handleCredentialResponse = async (response) => {
    const { credential } = response;
    const loginUser = { credential };
    form.classList.add('no-form');
    sectionMeeting.classList.add('no-meeting');
    sectionPage.classList.remove('no-page');
    try {
      const resp = await axios.post(`/api/v1/auth/login`, loginUser);
      const user = resp.data.user;
      // send welcome message
      sectionPage.classList.add('no-page');
      sectionMeeting.classList.remove('no-meeting');
      alert.classList.add('alert-success');
      alert.style.opacity = '1';
      alert.textContent = `Welcome, ${user.name}. Redirecting to meeting setup...`;
      setTimeout(() => {
        // store user to local storage
        localStorage.setItem('user', JSON.stringify(user));
        document.location = `${document.location.origin}/meeting/`;
      }, 2000);
    } catch (error) {
      sectionPage.classList.add('no-page');
      sectionMeeting.classList.remove('no-meeting');
      toast({ alertClass: 'alert-danger', error });
      setTimeout(() => {
        form.classList.remove('no-form');
      }, 3200);
    }
  };

  inputName.addEventListener('input', getName);
  inputEmail.addEventListener('input', getEmail);
  inputPassword.addEventListener('input', getPassword);
  form.addEventListener('submit', register);

  googleButtonLogin(handleCredentialResponse, 'medium', false);
};
