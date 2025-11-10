import { CustomUser } from './types.js';

declare module 'websocket' {
  interface request {
    user?: CustomUser;
  }
  interface connection {
    id: string;
  }
}
