import nodemailer, { SentMessageInfo } from 'nodemailer';
import nodemailerConfig from './nodemailerConfig.js';

const sendEmail = async ({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<SentMessageInfo> => {
  const transporter = nodemailer.createTransport(nodemailerConfig);

  return await transporter.sendMail({
    from: '"WebRTC" <info@scudella.net.br>', // sender address
    to,
    subject,
    html,
  });
};

export default sendEmail;
