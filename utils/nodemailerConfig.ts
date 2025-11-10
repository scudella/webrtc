import * as dotenv from 'dotenv';

dotenv.config();

const host = process.env.EMAIL_HOST ?? '';
const port = Number(process.env.EMAIL_PORT) ?? 587;
const user = process.env.EMAIL_USER ?? '';
const pass = process.env.EMAIL_PASSWORD ?? '';
const domainName = process.env.DOMAIN_NAME ?? '';
const keySelector = process.env.KEY_SELECTOR ?? '';
const privateKey = process.env.PRIVATE_KEY ?? '';

const nodemailerConfig = {
  host,
  port,
  auth: {
    user,
    pass,
  },
  tls: {
    rejectUnauthorized: false,
  },
  dkim: {
    domainName,
    keySelector,
    privateKey,
  },
};

export default nodemailerConfig;
