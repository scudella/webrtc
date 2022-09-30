const sendEmail = require('./sendEmail');

const sendResetPasswordEmail = async ({ name, email, token, origin }) => {
  const resetURL = `${origin}/user/reset-password?token=${token}&email=${email}`;

  const message = `<p>Please reset your password by clicking in the following link : <a href="${resetURL}">Reset password</a></p>`;

  return sendEmail({
    to: email,
    subject: 'Reset password',
    html: `<h4> Hello ${name},</h4>
    ${message}
    `,
  });
};

module.exports = sendResetPasswordEmail;
