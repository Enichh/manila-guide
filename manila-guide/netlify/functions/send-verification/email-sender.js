/**
 * Sends emails via the injected nodemailer transporter.
 *
 * SRP: One reason to change — how emails are sent (transport mechanism).
 * DIP: Depends on a nodemailer transporter abstraction, injected via constructor.
 */
class EmailSender {
  /**
   * @param {object} transporter - A configured nodemailer transporter.
   * @param {string} fromAddress - The email address to send from.
   */
  constructor(transporter, fromAddress) {
    this.transporter = transporter;
    this.fromAddress = fromAddress;
  }

  /**
   * Sends an email.
   *
   * @param {string} email - Recipient email address.
   * @param {string} subject - Email subject line.
   * @param {string} html - HTML body of the email.
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  async send(email, subject, html) {
    try {
      await this.transporter.sendMail({
        from: `"Manila Guide" <${this.fromAddress}>`,
        to: email,
        subject,
        html,
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = { EmailSender };
