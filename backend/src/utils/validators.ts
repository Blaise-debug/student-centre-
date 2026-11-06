export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidUsername(username: string): boolean {
  // letters, numbers, underscores, 3-30 chars
  return /^[a-zA-Z0-9_]{3,30}$/.test(username);
}

export function isValidPassword(password: string): boolean {
  // min 8 chars, at least one letter and one number
  return password.length >= 8 && /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
}