import { Types, HydratedDocument } from 'mongoose';

export interface IRoom {
  name: string;
  capacity: number;
  sfu: boolean;
  ip: string;
  userAgent: string;
  loginRequired: boolean;
  sameDomain: boolean;
  ownerRequired: boolean;
  user: Types.ObjectId;
}

export type IRoomDocument = HydratedDocument<IRoom>;
