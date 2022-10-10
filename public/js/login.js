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
window.onload = function init() {
  const inputEmail = document.getElementById('email');
  const inputPassword = document.getElementById('password');
  const form = document.querySelector('.form');
  const sectionMeeting = document.querySelector('.meeting');
  const sectionPage = document.querySelector('.page');
  const alert = document.querySelector('.alert-show');
  let email = '';
  let password = '';

  const getEmail = (e) => {
    email = e.target.value;
  };

  const getPassword = (e) => {
    password = e.target.value;
  };

  const login = async (e) => {
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
      alert.classList.add('alert-danger');
      alert.style.opacity = '1';
      axios.isAxiosError(error)
        ? (alert.textContent = error.response.data.msg)
        : (alert.textContent = error);
      setTimeout(() => {
        alert.style.opacity = '0';
        setTimeout(() => {
          alert.textContent = '';
          alert.classList.remove('alert-danger');
          form.classList.remove('no-form');
          form.style.opacity = '0';
          setTimeout(() => {
            form.style.opacity = '1';
          }, 300);
        }, 1200);
      }, 2000);
    }
  };

  inputEmail.addEventListener('input', getEmail);
  inputPassword.addEventListener('input', getPassword);
  form.addEventListener('submit', login);
};