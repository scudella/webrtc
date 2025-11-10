import sendEmail from './sendEmail.js';
import { SentMessageInfo } from 'nodemailer';

const sendVerificationEmail = async ({
  name,
  email,
  verificationToken,
  origin,
}: {
  name: string;
  email: string;
  verificationToken: string;
  origin: string;
}): Promise<SentMessageInfo> => {
  const verifyEmail = `${origin}/user/verify-email?token=${verificationToken}&email=${email}`;

  const message = `<p>Please confirm your email by clicking in the following link : <a href="${verifyEmail}">Verify Email</a></p>`;

  return await sendEmail({
    to: email,
    subject: 'Email confirmation',
    html: `<h4> Hello ${name}</h4>
    ${message}
    `,
  });
};

export default sendVerificationEmail;
