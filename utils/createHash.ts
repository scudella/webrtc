import crypto from 'crypto';

const hashString = (token: string): string =>
  crypto.createHash('md5').update(token).digest('hex');

export default hashString;
