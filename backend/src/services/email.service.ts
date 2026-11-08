
import { Resend } from 'resend';
import { env } from '../config/env';

const resend = new Resend(env.RESEND_API_KEY);

export async function sendVerificationEmail(
  recipient: string,
  code: string,
  expiryMinutes = 10,
): Promise<void> {
  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: recipient,
    subject: 'Verify your Students\' Centre email',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: auto; color: #222;">
        <h2>Verify your email address</h2>
        <p>Welcome to Students' Centre!</p>
        <p>Use the verification code below to confirm your email address:</p>
        <div style="font-size: 30px; font-weight: bold; letter-spacing: 8px; padding: 16px; background: #f3f4f6; text-align: center;">
          ${code}
        </div>
        <p>This code expires in ${expiryMinutes} minutes.</p>
        <p>If you did not create a Students' Centre account, you can ignore this email.</p>
      </div>
    `,
    text: `Welcome to Students' Centre. Your email verification code is ${code}. It expires in ${expiryMinutes} minutes.`,
  });

  if (error) {
    console.error('[Email] Resend delivery failed:', error.message);
    throw new Error('Unable to send verification email');
  }
}

export async function sendPasswordResetEmail(
  recipient: string,
  resetUrl: string,
  expiryMinutes = 30
): Promise<void> {
  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: recipient,
    subject: 'Reset your Students\' Centre password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: auto; color: #1A2E1E;">
        <h2>Reset your password</h2>
        <p>We received a request to reset the password for your Students' Centre account.</p>
        <p><a href="${resetUrl}" style="display:inline-block;background:#129A51;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">Reset password</a></p>
        <p>This link expires in ${expiryMinutes} minutes and can be used once.</p>
        <p>If you did not request this change, ignore this email. Your current password will remain active.</p>
      </div>
    `,
    text: `Reset your Students' Centre password using this link: ${resetUrl}\nThis link expires in ${expiryMinutes} minutes and can be used once. If you did not request this, ignore this email.`,
  });

  if (error) {
    console.error('[Email] Password reset delivery failed:', error.message);
    throw new Error('Unable to send password reset email');
  }
}

