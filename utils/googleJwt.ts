import * as dotenv from 'dotenv';
import { type TokenPayload, OAuth2Client } from 'google-auth-library';

dotenv.config();

const client = new OAuth2Client({
  clientId: process.env.GOOGLE_WEB_CLIENT_ID,
});

async function verifyGoogleJWT(
  token: string
): Promise<TokenPayload | undefined> {
  const googleWebClientId = process.env.GOOGLE_WEB_CLIENT_ID ?? '-';
  const googleAndroidClientId = process.env.GOGGLE_ANDROID_CLIENT_ID ?? '-';
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: [googleWebClientId, googleAndroidClientId],
    });
    const payload = ticket.getPayload();
    return payload;
    // If request specified a G Suite domain:
    // const domain = payload['hd'];
  } catch (error) {
    console.log(error);
    return undefined;
  }
}

export { verifyGoogleJWT };
