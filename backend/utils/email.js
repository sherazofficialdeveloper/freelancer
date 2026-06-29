import { getMailerTransporter } from './mailer.js';

export const sendEmail = async (to, subject, text, html = '') => {
  try {
    const transporter = await getMailerTransporter();
    const from = process.env.SMTP_FROM || '"Farelanceru" <no-reply@farelanceru.com>';
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html: html || text
    });
    console.log(`📬 [Mailer] Email successfully sent to [${to}]. MsgId: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error(`❌ [Mailer] Failed sending email to [${to}]: ${err.message}`);
    return false;
  }
};

export default {
  sendEmail
};
