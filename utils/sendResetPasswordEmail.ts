import { SentMessageInfo } from 'nodemailer';
import sendEmail from './sendEmail.js';

const sendResetPasswordEmail = async ({
  name,
  email,
  token,
  origin,
}: {
  name: string;
  email: string;
  token: string;
  origin: string;
}): Promise<SentMessageInfo> => {
  const resetURL = `${origin}/user/reset-password?token=${token}&email=${email}`;

  const message = `<p>Please reset your password by clicking in the following link : <a href="${resetURL}">Reset password</a></p>`;

  return await sendEmail({
    to: email,
    subject: 'Reset password',
    html: `<h4> Hello ${name},</h4>
    ${message}
    `,
  });
};

export default sendResetPasswordEmail;
