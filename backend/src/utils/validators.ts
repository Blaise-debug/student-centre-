export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidUsername(username: string): boolean {
  // letters, numbers, underscores, 3-30 chars
  return /^[a-zA-Z0-9_]{3,30}$/.test(username);
}

export function isValidPassword(password: string): boolean {
  // bcrypt only processes 72 bytes; reject longer inputs rather than silently truncating them.
  return (
    password.length >= 8 &&
    Buffer.byteLength(password, 'utf8') <= 72 &&
    /[a-zA-Z]/.test(password) &&
    /[0-9]/.test(password)
  );
}
