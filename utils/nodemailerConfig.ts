require('dotenv').config();

module.exports = {
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false,
  },
  dkim: {
    domainName: process.env.DOMAIN_NAME,
    keySelector: process.env.KEY_SELECTOR,
    privateKey: process.env.PRIVATE_KEY,
  },
};
