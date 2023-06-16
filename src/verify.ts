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

import { copyrightDate } from './utils/date';
import axios from 'axios';

window.onload = function init() {
  const query = new URLSearchParams(window.location.search);
  const section = document.querySelector('.section')! as HTMLElement;
  const sectionPage = document.querySelector('.page')! as HTMLElement;
  const message = document.getElementById(
    'verify-message'
  )! as HTMLHeadingElement;
  const button = document.querySelector('.no-button')! as HTMLAnchorElement;
  copyrightDate();

  const verifyToken = async () => {
    try {
      await axios.post('/api/v1/auth/verify-email', {
        verificationToken: query.get('token'),
        email: query.get('email'),
      });
      sectionPage.classList.add('no-page');
      section.classList.remove('no-section');
      message.innerText = 'Account confirmed';
      button.classList.remove('no-button');
    } catch (error) {
      sectionPage.classList.add('no-page');
      section.classList.remove('no-section');
      message.innerText =
        'There Was An Error, \n\n Please Check Your Verification Link';
    }
  };
  verifyToken();
};
