import * as sanitizer from 'string-sanitizer';
import validator from 'validator';

function sanitizeName(name: string): boolean {
  const sanitizedName = sanitizer.sanitize.keepSpace(name);
  if (name === sanitizedName) {
    return true;
  }
  return false;
}

function sanitizeEmail(email: string): boolean {
  return validator.isEmail(email);
}

export { sanitizeName, sanitizeEmail };
