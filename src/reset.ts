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
  const query = new URLSearchParams(window.location.search);
  const inputPassword = document.getElementById(
    'password'
  )! as HTMLInputElement;
  const form = document.querySelector('.form')! as HTMLFormElement;
  const sectionMeeting = document.querySelector('.meeting')! as HTMLElement;
  const sectionPage = document.querySelector('.page')! as HTMLElement;
  copyrightDate();
  let password = '';

  const getPassword = (e: Event) => {
    password = (e.target as HTMLInputElement).value;
  };

  const resetPassword = async (e: Event) => {
    e.preventDefault();
    form.classList.add('no-form');
    sectionMeeting.classList.add('no-meeting');
    sectionPage.classList.remove('no-page');
    try {
      await axios.post('/api/v1/auth/reset-password', {
        password,
        token: query.get('token'),
        email: query.get('email'),
      });
      inputPassword.value = '';
      sectionPage.classList.add('no-page');
      sectionMeeting.classList.remove('no-meeting');
      toast({
        alertClass: 'alert-success',
        content: 'Success, redirecting to login page shortly',
      });
      setTimeout(() => {
        document.location = `${document.location.origin}/login/`;
      }, 3200);
    } catch (error) {
      sectionPage.classList.add('no-page');
      sectionMeeting.classList.remove('no-meeting');
      toast({ alertClass: 'alert-danger', error });
      setTimeout(() => {
        form.classList.remove('no-form');
      }, 3200);
    }
  };

  inputPassword.addEventListener('input', getPassword);
  form.addEventListener('submit', resetPassword);
};
