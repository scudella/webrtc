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
import { copyrightDate } from './utils/date.js';

window.onload = function init() {
  const query = new URLSearchParams(window.location.search);
  const inputPassword = document.getElementById('password');
  const form = document.querySelector('.form');
  const sectionMeeting = document.querySelector('.meeting');
  const sectionPage = document.querySelector('.page');
  copyrightDate();
  let password = '';

  const getPassword = (e) => {
    password = e.target.value;
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    form.classList.add('no-form');
    sectionMeeting.classList.add('no-meeting');
    sectionPage.classList.remove('no-page');
    try {
      const response = await axios.post('/api/v1/auth/reset-password', {
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
