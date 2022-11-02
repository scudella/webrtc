const fetchUser = async () => {
  try {
    const response = await axios.get(`/api/v1/users/showMe`);
    const user = response.data.user;
    // store user to local storage
    localStorage.setItem('user', JSON.stringify(user));
    return user;
  } catch (error) {
    localStorage.setItem('user', '');
  }
};

const fetchRoom = async () => {
  // get room already created
  try {
    const response = await axios.get(`/api/v1/meeting/show-my-room`);
    return response.data.room;
  } catch (error) {
    axios.isAxiosError(error)
      ? console.log(error.response.data.msg)
      : console.log(error);
  }
};

export { fetchRoom, fetchUser };
