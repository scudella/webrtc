import axios, { isAxiosError } from 'axios';
import type { LoginResponseData } from '../register';

export interface RoomResponseData {
  room: string;
}

const fetchUser = async () => {
  try {
    const response = await axios.get<LoginResponseData>(`/api/v1/users/showMe`);
    const user = response.data.user;
    // store user to local storage
    localStorage.setItem('user', JSON.stringify(user));
    return user;
  } catch (error) {
    localStorage.setItem('user', '');
    return undefined;
  }
};

const fetchRoom = async () => {
  // get room already created
  try {
    const response = await axios.get<RoomResponseData>(
      `/api/v1/meeting/show-my-room`
    );
    return response.data.room;
  } catch (error) {
    isAxiosError(error)
      ? console.log(error.response && error.response.data.msg)
      : console.log(error);
    return undefined;
  }
};

export { fetchRoom, fetchUser };
