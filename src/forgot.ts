/*  Copyright (c) 2022 Eduardo S. Libardi, All rights reserved. 

Permission to use, copy, modify, and/or distribute this software for any purpose with or 
without fee is hereby granted, provided that the above copyright notice and this permission 
notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS 
SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL 
THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES 
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, 
NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
*/

import { toast } from './utils/toast';
import { copyrightDate } from './utils/date';
import axios from 'axios';

window.onload = function init() {
  const inputEmail = document.getElementById('email')! as HTMLInputElement;
  const form = document.querySelector('.form')! as HTMLFormElement;
  const sectionMeeting = document.querySelector('.meeting')! as HTMLElement;
  const sectionPage = document.querySelector('.page')! as HTMLElement;
  const alert = document.querySelector('.alert-show')! as HTMLParagraphElement;
  copyrightDate();
  let email = '';

  const getEmail = (e: Event) => {
    email = (e.target as HTMLInputElement).value;
  };

  const forgotPassword = async (e: Event) => {
    e.preventDefault();
    form.classList.add('no-form');
    sectionMeeting.classList.add('no-meeting');
    sectionPage.classList.remove('no-page');
    try {
      const response = await axios.post('/api/v1/auth/forgot-password', {
        email,
      });
      inputEmail.value = '';
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
    }
  };

  inputEmail.addEventListener('input', getEmail);
  form.addEventListener('submit', forgotPassword);
};
