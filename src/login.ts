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
import { googleButtonLogin } from './utils/googleLogin';
import { copyrightDate } from './utils/date';
import axios from 'axios';

window.onload = function init() {
  const inputEmail = document.getElementById('email')! as HTMLInputElement;
  const inputPassword = document.getElementById(
    'password'
  )! as HTMLInputElement;
  const form = document.querySelector('.form')! as HTMLFormElement;
  const sectionMeeting = document.querySelector('.meeting')! as HTMLElement;
  const sectionPage = document.querySelector('.page')! as HTMLElement;
  const alert = document.querySelector('.alert-show')! as HTMLParagraphElement;
  copyrightDate();
  let email = '';
  let password = '';

  const getEmail = (e: Event) => {
    email = (e.target as HTMLInputElement).value;
  };

  const getPassword = (e: Event) => {
    password = (e.target as HTMLInputElement).value;
  };

  const login = async (e: Event) => {
    e.preventDefault();
    form.classList.add('no-form');
    sectionMeeting.classList.add('no-meeting');
    sectionPage.classList.remove('no-page');
    const loginUser = { email, password };
    try {
      const response = await axios.post(`/api/v1/auth/login`, loginUser);
      const user = response.data.user;
      inputEmail.value = '';
      inputPassword.value = '';
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

  const handleCredentialResponse = async (
    response: google.accounts.id.CredentialResponse
  ) => {
    const { credential } = response;
    const checkbox = (
      document.querySelector('.input-checkbox')! as HTMLInputElement
    ).checked;
    const loginUser = { credential, checkbox };
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
    } catch (error: unknown) {
      sectionPage.classList.add('no-page');
      sectionMeeting.classList.remove('no-meeting');
      toast({ alertClass: 'alert-danger', error });
      setTimeout(() => {
        form.classList.remove('no-form');
      }, 3200);
    }
  };

  inputEmail.addEventListener('input', getEmail);
  inputPassword.addEventListener('input', getPassword);
  form.addEventListener('submit', login);

  googleButtonLogin(handleCredentialResponse, 'large', true);
};
