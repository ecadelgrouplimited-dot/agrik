import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function generateNumericCode(length = 6): string {
  const max = 10 ** length;
  const code = Math.floor(Math.random() * max)
    .toString()
    .padStart(length, "0");
  return code;
}

export function hashCode(code: string): Promise<string> {
  return bcrypt.hash(code, 10);
}

export function verifyCode(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash);
}
