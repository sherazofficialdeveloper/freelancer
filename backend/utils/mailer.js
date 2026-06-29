import { Resend } from 'resend';

let resendInstance = null;

// Initialize Resend client if key is configured
const getResendClient = () => {
  if (!resendInstance && process.env.RESEND_API_KEY) {
    try {
      resendInstance = new Resend(process.env.RESEND_API_KEY);
      console.log('✨ [Mailer] Resend Email API client initialized successfully.');
    } catch (err) {
      console.error('❌ [Mailer] Failed to initialize Resend client:', err.message);
    }
  }
  return resendInstance;
};

/**
 * Base email dispatcher utilizing the official Resend API.
 * Falls back to styled console logger if RESEND_API_KEY is not defined.
 */
export const sendMailWithResend = async ({ to, subject, html, text }) => {
  const from = process.env.EMAIL_FROM || '"Farelanceru" <onboarding@resend.dev>';
  const client = getResendClient();

  if (client) {
    try {
      const data = await client.emails.send({
        from,
        to,
        subject,
        html: html || text,
        text: text || ''
      });
      console.log(`✉️ [Resend SUCCESS] Dispatched to: ${to}. Email ID: ${data.id || (data.data && data.data.id) || 'N/A'}`);
      return { success: true, messageId: data.id || (data.data && data.data.id) || 'resend-ok' };
    } catch (err) {
      console.error(`❌ [Resend ERROR] Failed sending to ${to}: ${err.message}`);
    }
  }

  // Developer mode fallback logger
  const appName = process.env.APP_NAME || 'Farelanceru';
  console.log(`
╔═══════════════════════════════════════════════════════════════════════════╗
  📨 [MOCK EMAIL DISPATCH LOG] (${appName})
  TO:      ${to}
  FROM:    ${from}
  SUBJECT: ${subject}
╚═══════════════════════════════════════════════════════════════════════════╝
${html || text}
─────────────────────────────────────────────────────────────────────────────
`);
  return { success: true, messageId: 'mock-id-resend-fallback' };
};

/**
 * Legacy compatible function so other controllers don't throw imports exception
 */
export const getMailerTransporter = async () => {
  return {
    sendMail: async (options) => {
      const res = await sendMailWithResend({
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text
      });
      return { messageId: res.messageId, previewUrl: 'https://resend.com' };
    }
  };
};

// Premium visual brand styles
const BRAND_PRIMARY = '#4f46e5'; // Indigo
const BRAND_ACCENT = '#10b981'; // Green
const BRAND_WARN = '#ef4444'; // Red
const BG_DARK = '#0f172a'; // Slate dark

/**
 * 1. Email Verification OTP Email
 * Includes OTP and a Verify Email button.
 */
export const sendVerificationEmail = async (email, name, otp) => {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const verificationLink = `${appUrl}/verify-otp.html?email=${encodeURIComponent(email)}&otp=${encodeURIComponent(otp)}`;

  const html = `
    <div style="font-family: 'Inter', Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 40px 30px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.02);">
      <div style="text-align: center; margin-bottom: 30px;">
        <span style="font-size: 32px; font-weight: 800; color: ${BRAND_PRIMARY}; letter-spacing: -1px;">Farelanceru</span>
        <div style="width: 40px; height: 3px; background-color: ${BRAND_PRIMARY}; margin: 8px auto 0 auto; border-radius: 99px;"></div>
      </div>
      <h2 style="color: #0f172a; font-size: 22px; font-weight: 700; text-align: center; margin-top: 0; margin-bottom: 24px;">Verify Your Email Address</h2>
      <p style="color: #475569; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">Hello ${name},</p>
      <p style="color: #475569; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">Thank you for registering on Farelanceru. To activate your secure workspace account, please verify your email using one of the quick options below:</p>
      
      <!-- Option 1: Copy-Paste OTP -->
      <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 30px;">
        <p style="color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; margin: 0 0 8px 0; letter-spacing: 0.05em;">Verification OTP Code</p>
        <span style="font-family: 'JetBrains Mono', Courier, monospace; font-size: 36px; font-weight: 800; color: ${BRAND_PRIMARY}; letter-spacing: 6px; display: block;">${otp}</span>
        <p style="color: #94a3b8; font-size: 11px; margin: 8px 0 0 0;">Code is active for 15 minutes.</p>
      </div>

      <!-- Option 2: Instant Verify Link Button -->
      <div style="text-align: center; margin-bottom: 30px;">
        <a href="${verificationLink}" target="_blank" style="background-color: ${BRAND_PRIMARY}; color: #ffffff; padding: 14px 32px; font-size: 15px; font-weight: 700; text-decoration: none; border-radius: 8px; display: inline-block; box-shadow: 0 4px 12px rgba(79,70,229,0.25); transition: background-color 0.2s;">Verify Email Address</a>
      </div>

      <p style="color: #94a3b8; font-size: 12px; line-height: 1.5; margin-bottom: 24px; text-align: center;">If the button above does not work, copy and paste this link into your browser:<br><a href="${verificationLink}" style="color: ${BRAND_PRIMARY}; text-decoration: underline; word-break: break-all;">${verificationLink}</a></p>
      
      <hr style="border: 0; border-top: 1px solid #f1f5f9; margin-bottom: 24px;" />
      <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">This is a mandatory system verification email.<br>If you did not initiate this registration, please ignore this email.</p>
    </div>
  `;

  await sendMailWithResend({
    to: email,
    subject: `🔑 Email Verification OTP: ${otp} - Farelanceru`,
    html
  });
};

/**
 * 2. Welcome Email
 * Dispatched instantly upon email verification completion.
 */
export const sendWelcomeEmail = async (email, name, username, role) => {
  const html = `
    <div style="font-family: 'Inter', Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 40px 30px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.02);">
      <div style="text-align: center; margin-bottom: 30px;">
        <span style="font-size: 32px; font-weight: 800; color: ${BRAND_PRIMARY}; letter-spacing: -1px;">Farelanceru</span>
        <div style="width: 40px; height: 3px; background-color: ${BRAND_PRIMARY}; margin: 8px auto 0 auto; border-radius: 99px;"></div>
      </div>
      <h2 style="color: #0f172a; font-size: 22px; font-weight: 700; text-align: center; margin-top: 0; margin-bottom: 16px;">Welcome to Farelanceru! 🚀</h2>
      <p style="color: #10b981; font-size: 14px; font-weight: 600; text-align: center; margin-bottom: 30px; text-transform: uppercase; letter-spacing: 0.05em;">Your secure workspace is activated</p>
      
      <p style="color: #475569; font-size: 15px; line-height: 1.6; margin-bottom: 16px;">Hello ${name},</p>
      <p style="color: #475569; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">We are absolutely thrilled to welcome you to the Farelanceru marketplace platform. Your account is verified, secure, and ready for launch.</p>
      
      <div style="background-color: #f8fafc; border-radius: 12px; padding: 18px; margin-bottom: 30px; border: 1px solid #e2e8f0;">
        <p style="margin: 0 0 8px 0; font-size: 14px; color: #334155;"><strong>Profile Username:</strong> <span style="color: ${BRAND_PRIMARY};">@${username}</span></p>
        <p style="margin: 0; font-size: 14px; color: #334155;"><strong>Assigned Role:</strong> <span style="text-transform: uppercase; font-weight: 700; color: ${BRAND_ACCENT};">${role}</span></p>
      </div>

      <div style="text-align: center; margin-bottom: 30px;">
        <a href="${process.env.APP_URL || 'http://localhost:3000'}/dashboard.html" target="_blank" style="background-color: ${BRAND_PRIMARY}; color: #ffffff; padding: 14px 32px; font-size: 15px; font-weight: 700; text-decoration: none; border-radius: 8px; display: inline-block; box-shadow: 0 4px 12px rgba(79,70,229,0.25);">Explore Your Dashboard</a>
      </div>

      <p style="color: #475569; font-size: 15px; line-height: 1.6; margin-bottom: 30px;">Join our active ecosystem of verified buyers and expert freelancers to construct amazing projects, collaborate smoothly, and build success.</p>
      
      <hr style="border: 0; border-top: 1px solid #f1f5f9; margin-bottom: 24px;" />
      <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">Farelanceru Platform Inc. All rights reserved.</p>
    </div>
  `;

  await sendMailWithResend({
    to: email,
    subject: '🚀 Welcome to Farelanceru - Your secure workspace is activated!',
    html
  });
};

/**
 * 3. Forgot Password / Reset OTP Email
 */
export const sendForgotPasswordEmail = async (email, name, otp) => {
  const html = `
    <div style="font-family: 'Inter', Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 40px 30px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.02);">
      <div style="text-align: center; margin-bottom: 30px;">
        <span style="font-size: 32px; font-weight: 800; color: ${BRAND_PRIMARY}; letter-spacing: -1px;">Farelanceru</span>
      </div>
      <h2 style="color: #0f172a; font-size: 22px; font-weight: 700; text-align: center; margin-top: 0; margin-bottom: 24px;">Reset Your Password</h2>
      <p style="color: #475569; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">Hello ${name},</p>
      <p style="color: #475569; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">We received a request to recover your password. Please use the following 6-digit Security Code (OTP) to complete your password update:</p>
      
      <div style="background-color: #fdf2f8; border: 1px dashed #fbcfe8; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 30px;">
        <p style="color: #be185d; font-size: 12px; font-weight: 600; text-transform: uppercase; margin: 0 0 8px 0; letter-spacing: 0.05em;">Security Verification OTP</p>
        <span style="font-family: 'JetBrains Mono', Courier, monospace; font-size: 36px; font-weight: 800; color: #db2777; letter-spacing: 6px; display: block;">${otp}</span>
        <p style="color: #f472b6; font-size: 11px; margin: 8px 0 0 0;">This OTP code expires in 15 minutes.</p>
      </div>

      <p style="color: #475569; font-size: 14px; line-height: 1.6; margin-bottom: 30px;">If you did not request a password recovery, you can safely ignore this email. Your current password remains perfectly secure.</p>
      
      <hr style="border: 0; border-top: 1px solid #f1f5f9; margin-bottom: 24px;" />
      <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">Farelanceru Security Team</p>
    </div>
  `;

  await sendMailWithResend({
    to: email,
    subject: `🔑 Password Recovery Security Code: ${otp} - Farelanceru`,
    html
  });
};

/**
 * 4. Password Changed Notification Email
 */
export const sendPasswordChangedEmail = async (email, name) => {
  const html = `
    <div style="font-family: 'Inter', Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 40px 30px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.02);">
      <div style="text-align: center; margin-bottom: 30px;">
        <span style="font-size: 32px; font-weight: 800; color: ${BRAND_PRIMARY}; letter-spacing: -1px;">Farelanceru</span>
      </div>
      <h2 style="color: #0f172a; font-size: 22px; font-weight: 700; text-align: center; margin-top: 0; margin-bottom: 24px;">Password Updated Successfully</h2>
      <p style="color: #475569; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">Hello ${name},</p>
      
      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 30px; color: #15803d;">
        <i class="fa-solid fa-circle-check" style="font-size: 24px; margin-bottom: 10px; display: inline-block;"></i>
        <p style="margin: 0; font-size: 15px; font-weight: 600;">Your account password has been successfully updated.</p>
      </div>

      <p style="color: #475569; font-size: 15px; line-height: 1.6; margin-bottom: 30px;">If this modification was performed by you, no further action is necessary. Your workspace is fully secure.</p>
      
      <div style="background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 12px; padding: 20px; margin-bottom: 30px; color: #9f1239;">
        <p style="margin: 0; font-size: 13px; font-weight: 700;">🚨 Security Warning!</p>
        <p style="margin: 6px 0 0 0; font-size: 13px; line-height: 1.5;">If you did not make this modification, please contact our support team immediately or initiate a Forgot Password recovery right away to safeguard your account data.</p>
      </div>

      <hr style="border: 0; border-top: 1px solid #f1f5f9; margin-bottom: 24px;" />
      <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">Farelanceru Security Team</p>
    </div>
  `;

  await sendMailWithResend({
    to: email,
    subject: '⚠️ Security Notification: Password Changed - Farelanceru',
    html
  });
};

/**
 * 5. Login Alert Email
 * Contains login time, browser, device, IP address, and security warning.
 */
export const sendLoginAlertEmail = async (email, name, browser, device, ipAddress, loginTime = new Date()) => {
  const formattedTime = new Date(loginTime).toUTCString();
  const html = `
    <div style="font-family: 'Inter', Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 40px 30px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.02);">
      <div style="text-align: center; margin-bottom: 30px;">
        <span style="font-size: 32px; font-weight: 800; color: ${BRAND_PRIMARY}; letter-spacing: -1px;">Farelanceru</span>
      </div>
      <h2 style="color: #0f172a; font-size: 22px; font-weight: 700; text-align: center; margin-top: 0; margin-bottom: 24px;">New Login Notification</h2>
      <p style="color: #475569; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">Hello ${name},</p>
      <p style="color: #475569; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">We detected a successful sign-in to your Farelanceru account. Please verify the connection details below:</p>
      
      <div style="background-color: #f8fafc; border-radius: 12px; padding: 20px; border: 1px solid #cbd5e1; margin-bottom: 30px; font-size: 14px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: 600; width: 120px;">Timestamp</td>
            <td style="padding: 6px 0; color: #1e293b; font-weight: 600;">${formattedTime}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Browser</td>
            <td style="padding: 6px 0; color: #1e293b; font-weight: 600;">${browser}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Device Type</td>
            <td style="padding: 6px 0; color: #1e293b; font-weight: 600;">${device}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: 600;">IP Address</td>
            <td style="padding: 6px 0; color: #1e293b; font-weight: 600; font-family: monospace;">${ipAddress}</td>
          </tr>
        </table>
      </div>

      <div style="background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 12px; padding: 20px; margin-bottom: 30px; color: #9f1239; font-size: 14px; line-height: 1.5;">
        <p style="margin: 0; font-weight: 700;">🚨 Didn't perform this login?</p>
        <p style="margin: 6px 0 0 0;">If this login was not performed by you, please change your password immediately on your settings console to secure your profile and active services.</p>
      </div>

      <hr style="border: 0; border-top: 1px solid #f1f5f9; margin-bottom: 24px;" />
      <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">Farelanceru Security Team</p>
    </div>
  `;

  await sendMailWithResend({
    to: email,
    subject: `🚨 Security Notification: New login detected from ${browser} (${device})`,
    html
  });
};

/**
 * 6. Admin Broadcast Emails
 */
export const sendAdminBroadcastEmail = async (email, name, subject, messageBody, headerTitle = 'Farelanceru Bulletin', brandColor = BRAND_PRIMARY, bodyWrapStyle = '') => {
  const html = `
    <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #cbd5e1; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.01);">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: ${brandColor}; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -1px;">Farelanceru</h2>
        <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;">${headerTitle}</p>
      </div>
      <hr style="border: 0; border-top: 1px solid #cbd5e1; margin-bottom: 24px;" />
      <p style="color: #1e293b; font-size: 15px; font-weight: 600; margin-bottom: 16px;">Hello ${name || 'User'},</p>
      <div style="color: #334155; font-size: 15px; line-height: 1.6; white-space: pre-line; ${bodyWrapStyle} margin-bottom: 30px;">
        ${messageBody}
      </div>
      <hr style="border: 0; border-top: 1px solid #cbd5e1; margin-top: 24px; margin-bottom: 16px;" />
      <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0; line-height: 1.5;">
        You are receiving this communication from the Farelanceru Administration Console.<br>
        Please do not reply directly to this mail as this inbox is unmonitored.
      </p>
    </div>
  `;

  await sendMailWithResend({
    to: email,
    subject,
    html
  });
};

/**
 * 7. Project Notifications Email
 */
export const sendProjectNotificationEmail = async (email, name, projectTitle, actionType, details) => {
  const html = `
    <div style="font-family: 'Inter', Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 40px 30px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.02);">
      <div style="text-align: center; margin-bottom: 30px;">
        <span style="font-size: 32px; font-weight: 800; color: ${BRAND_PRIMARY}; letter-spacing: -1px;">Farelanceru</span>
      </div>
      <h2 style="color: #0f172a; font-size: 22px; font-weight: 700; text-align: center; margin-top: 0; margin-bottom: 24px;">Project Activity Update</h2>
      <p style="color: #475569; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">Hello ${name},</p>
      
      <div style="background-color: #f8fafc; border-left: 4px solid ${BRAND_PRIMARY}; border-radius: 8px; padding: 16px; margin-bottom: 30px;">
        <p style="margin: 0 0 6px 0; font-size: 14px; color: #64748b; font-weight: 600; text-transform: uppercase;">Activity</p>
        <p style="margin: 0 0 12px 0; font-size: 16px; color: #1e293b; font-weight: 700;">${actionType}</p>
        <p style="margin: 0 0 4px 0; font-size: 14px; color: #64748b; font-weight: 600;">Project Title</p>
        <p style="margin: 0; font-size: 15px; color: #1e293b; font-weight: 600;">${projectTitle}</p>
      </div>

      <p style="color: #475569; font-size: 15px; line-height: 1.6; margin-bottom: 30px;">${details}</p>
      
      <div style="text-align: center; margin-bottom: 30px;">
        <a href="${process.env.APP_URL || 'http://localhost:3000'}/dashboard.html" target="_blank" style="background-color: ${BRAND_PRIMARY}; color: #ffffff; padding: 14px 32px; font-size: 15px; font-weight: 700; text-decoration: none; border-radius: 8px; display: inline-block; box-shadow: 0 4px 12px rgba(79,70,229,0.25);">Go to Project Workspace</a>
      </div>

      <hr style="border: 0; border-top: 1px solid #f1f5f9; margin-bottom: 24px;" />
      <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">Farelanceru Platform Notifications</p>
    </div>
  `;

  await sendMailWithResend({
    to: email,
    subject: `💼 Project Update: ${actionType} - ${projectTitle}`,
    html
  });
};

/**
 * 8. Payment Notifications Email
 */
export const sendPaymentNotificationEmail = async (email, name, amount, type, status, txId) => {
  const isSuccess = status.toLowerCase() === 'completed' || status.toLowerCase() === 'success';
  const headerColor = isSuccess ? BRAND_ACCENT : BRAND_WARN;

  const html = `
    <div style="font-family: 'Inter', Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 40px 30px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.02);">
      <div style="text-align: center; margin-bottom: 30px;">
        <span style="font-size: 32px; font-weight: 800; color: ${BRAND_PRIMARY}; letter-spacing: -1px;">Farelanceru</span>
      </div>
      <h2 style="color: #0f172a; font-size: 22px; font-weight: 700; text-align: center; margin-top: 0; margin-bottom: 24px;">Financial Transaction Receipt</h2>
      <p style="color: #475569; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">Hello ${name},</p>
      
      <div style="background-color: #f8fafc; border-radius: 12px; padding: 24px; border: 1px solid #e2e8f0; margin-bottom: 30px; text-align: center;">
        <p style="color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; margin: 0 0 8px 0;">Transaction Amount</p>
        <span style="font-size: 36px; font-weight: 800; color: ${BRAND_PRIMARY};">${amount}</span>
        <div style="display: inline-block; padding: 4px 12px; border-radius: 99px; font-size: 12px; font-weight: 700; background-color: ${isSuccess ? '#ecfdf5' : '#fef2f2'}; color: ${headerColor}; margin-top: 12px; text-transform: uppercase;">
          ${status}
        </div>
      </div>

      <div style="background-color: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 30px; font-size: 14px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: 600; width: 120px;">Type</td>
            <td style="padding: 6px 0; color: #1e293b; font-weight: 600; text-transform: capitalize;">${type}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Transaction ID</td>
            <td style="padding: 6px 0; color: #1e293b; font-weight: 600; font-family: monospace;">${txId}</td>
          </tr>
        </table>
      </div>

      <p style="color: #475569; font-size: 14px; line-height: 1.6; margin-bottom: 30px; text-align: center;">Your funds are handled securely via our modern encrypted escrow ledger wallet system.</p>

      <div style="text-align: center; margin-bottom: 30px;">
        <a href="${process.env.APP_URL || 'http://localhost:3000'}/wallet.html" target="_blank" style="background-color: ${BRAND_PRIMARY}; color: #ffffff; padding: 14px 32px; font-size: 15px; font-weight: 700; text-decoration: none; border-radius: 8px; display: inline-block; box-shadow: 0 4px 12px rgba(79,70,229,0.25);">Manage Wallet & Ledger</a>
      </div>

      <hr style="border: 0; border-top: 1px solid #f1f5f9; margin-bottom: 24px;" />
      <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">Farelanceru Escrow Ledger Services</p>
    </div>
  `;

  await sendMailWithResend({
    to: email,
    subject: `💳 Payment Receipt: ${amount} ${type} is ${status} - Farelanceru`,
    html
  });
};

/**
 * 9. Message Notifications Email
 */
export const sendMessageNotificationEmail = async (email, name, senderUsername, messageSnippet) => {
  const html = `
    <div style="font-family: 'Inter', Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 40px 30px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.02);">
      <div style="text-align: center; margin-bottom: 30px;">
        <span style="font-size: 32px; font-weight: 800; color: ${BRAND_PRIMARY}; letter-spacing: -1px;">Farelanceru</span>
      </div>
      <h2 style="color: #0f172a; font-size: 22px; font-weight: 700; text-align: center; margin-top: 0; margin-bottom: 24px;">New Inbox Message</h2>
      <p style="color: #475569; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">Hello ${name},</p>
      
      <p style="color: #475569; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">You received a new direct workspace message from <strong style="color: ${BRAND_PRIMARY};">@${senderUsername}</strong>:</p>

      <div style="background-color: #f8fafc; border-radius: 12px; padding: 20px; border: 1px solid #cbd5e1; margin-bottom: 30px; font-style: italic; color: #334155; font-size: 15px; line-height: 1.6;">
        "${messageSnippet}"
      </div>

      <div style="text-align: center; margin-bottom: 30px;">
        <a href="${process.env.APP_URL || 'http://localhost:3000'}/chat.html" target="_blank" style="background-color: ${BRAND_PRIMARY}; color: #ffffff; padding: 14px 32px; font-size: 15px; font-weight: 700; text-decoration: none; border-radius: 8px; display: inline-block; box-shadow: 0 4px 12px rgba(79,70,229,0.25);">Reply instantly</a>
      </div>

      <hr style="border: 0; border-top: 1px solid #f1f5f9; margin-bottom: 24px;" />
      <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">Farelanceru Real-Time Workspace</p>
    </div>
  `;

  await sendMailWithResend({
    to: email,
    subject: `💬 New Message from @${senderUsername} - Farelanceru`,
    html
  });
};
