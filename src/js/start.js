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
  const processGen = () => {
    const givenToken = document.querySelector('#givenToken');
    callToken = Date.now() + '-' + Math.round(Math.random() * 10000);
    givenToken.value = callToken;
    const urlField = document.querySelector('#url');
    urlField.value = `${document.location.origin}/#${callToken}`;
  };
  const videoCall = () => {
    if (callToken === '' || callToken === undefined) {
      // Check if there is a manual setup
      const givenToken = document.querySelector('#givenToken');
      callToken = givenToken.value;
      if (callToken === '' || callToken === undefined) {
        alert('Please provide a valid entry');
      } else {
        // store token to app usage
        sessionStorage.setItem('callToken', callToken);
        document.location = `${document.location.origin}/app.html`;
      }
    } else {
      // store token to app usage
      sessionStorage.setItem('callToken', callToken);
      document.location = `${document.location.origin}/app.html`;
    }
  };
  const tokenGen = document.querySelector('#tokenGen');
  tokenGen.addEventListener('click', processGen);
  const videoButton = document.getElementById('startvideo');
  videoButton.addEventListener('click', videoCall);
};
