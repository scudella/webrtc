require('dotenv').config();
const { OAuth2Client } = require('google-auth-library');

const client = new OAuth2Client({
  clientId: process.env.GOOGLE_WEB_CLIENT_ID,
});

async function verifyGoogleJWT(token) {
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: [
        process.env.GOOGLE_WEB_CLIENT_ID,
        process.env.GOGGLE_ANDROID_CLIENT_ID,
      ],
    });
    const payload = ticket.getPayload();
    return payload;
    // If request specified a G Suite domain:
    // const domain = payload['hd'];
  } catch (error) {
    console.log(error);
  }
}

module.exports = { verifyGoogleJWT };
