import axios from 'axios';

const fetchClientId = async (agent: 'android' | 'web') => {
  try {
    if (agent === 'web') {
      const response = await axios.get(`/api/v1/auth/show-web-id`);
      return response.data.clientId;
    } else {
      const response = await axios.get(`/api/v1/auth/show-android-id`);
      return response.data.clientId;
    }
  } catch (error) {
    axios.isAxiosError(error)
      ? console.log(error.response!.data.msg)
      : console.log(error);
  }
};

const googleButtonLogin = async (
  callback: (response: any) => Promise<void>,
  size: 'large' | 'medium',
  oneTap: boolean
) => {
  let clientId;
  let uxMode: 'redirect' | 'popup';
  let android = false;
  if (
    navigator.userAgent.includes('Linux; Android 10') ||
    navigator.userAgent.includes('Linux; Android 11') ||
    navigator.userAgent.includes('Linux; Android 12') ||
    navigator.userAgent.includes('moto') ||
    navigator.userAgent.includes('samsung')
  ) {
    clientId = await fetchClientId('android');
    uxMode = 'redirect';
    android = true;
  } else {
    clientId = await fetchClientId('web');
    uxMode = 'popup';
  }

  // android has old libraries. need to implement some alternative
  // https://developers.google.com/identity/sign-in/android/start
  // or do a redirect to a local address
  // so for now do not provide google login button
  if (!android) {
    google.accounts.id.initialize({
      client_id: clientId,
      callback,
      ux_mode: uxMode,
    });
    google.accounts.id.renderButton(
      document.getElementById('googleButton')!,
      { type: 'standard', theme: 'outline', size } // customization attributes
    );
    if (oneTap) {
      google.accounts.id.prompt(); // also display the One Tap dialog
    }
  } else {
    // hide checkbox for avatar update
    (document.querySelector(
      '.input-checkbox'
    ) as HTMLInputElement)!.style.display = 'none';
    (
      document.querySelector('.input-avatar')! as HTMLLabelElement
    ).style.display = 'none';
  }
};

export { googleButtonLogin };
