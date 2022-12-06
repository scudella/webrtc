const fetchClientId = async (agent) => {
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
      ? console.log(error.response.data.msg)
      : console.log(error);
  }
};

const googleButtonLogin = async (callback, size, oneTap) => {
  let clientId;
  if (
    navigator.userAgent.includes('Linux; Android 10') ||
    navigator.userAgent.includes('Linux; Android 11') ||
    navigator.userAgent.includes('Linux; Android 12') ||
    navigator.userAgent.includes('moto') ||
    navigator.userAgent.includes('samsung')
  ) {
    clientId = await fetchClientId('android');
  } else {
    clientId = await fetchClientId('web');
  }

  google.accounts.id.initialize({
    client_id: clientId,
    callback,
  });
  google.accounts.id.renderButton(
    document.getElementById('googleButton'),
    { theme: 'outline', size } // customization attributes
  );
  if (oneTap) {
    google.accounts.id.prompt(); // also display the One Tap dialog
  }
};

export { googleButtonLogin };
