import string from 'string-sanitizer';

function sanitizeName(name) {
  const sanitizedName = string.sanitize.keepSpace(name);
  if (name === sanitizedName) {
    return true;
  }
  return false;
}

function sanitizeEmail(email) {
  return string.validate.isEmail(email);
}

export { sanitizeName, sanitizeEmail };
