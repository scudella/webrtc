import nodemailer from 'nodemailer';
import nodemailerConfig from './nodemailerConfig.js';

const sendEmail = async ({ to, subject, html }) => {
  const transporter = nodemailer.createTransport(nodemailerConfig);

  return transporter.sendMail({
    from: '"WebRTC" <info@scudella.net.br>', // sender address
    to,
    subject,
    html,
  });
};

export default sendEmail;
