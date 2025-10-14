const logger = require('../utils/logger');
const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = this.createTransporter();
  }

    createTransporter() {
      // Check if SMTP is configured
      if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
        logger.warn('SMTP not configured, emails will be logged only');
        return {
          sendMail: (mailOptions) => {
            logger.info('EMAIL WOULD BE SENT:', {
              to: mailOptions.to,
              subject: mailOptions.subject,
              // Don't log the full HTML content for security
            });
            return Promise.resolve({ messageId: 'mock-message-id' });
          },
        };
      }

      // Create real nodemailer transporter
      return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
        tls: {
          // Do not fail on invalid certs for Gmail
          rejectUnauthorized: false
        }
      });
    }

    // ADD THIS MISSING METHOD
    async sendUserVerificationEmail(email, name, userId, applicationId) {
      const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/user/verify-email?token=${userId}`;
      const subject = `Verify Your Email Address`;
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .button { background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; }
            .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Verify Your Email</h1>
            </div>
            <div class="content">
              <p>Hello ${name},</p>
              <p>Thank you for registering! Please verify your email address by clicking the button below:</p>
              <p style="text-align: center;">
                <a href="${verificationLink}" class="button">Verify Email Address</a>
              </p>
              <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
              <p style="word-break: break-all; background: #fff; padding: 10px; border-radius: 4px;">
                ${verificationLink}
              </p>
              <p>This verification link will expire in 24 hours.</p>
            </div>
            <div class="footer">
              <p>If you didn't create an account, please ignore this email.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      try {
        await this.transporter.sendMail({
          to: email,
          subject,
          html,
          from: process.env.SMTP_FROM || 'noreply@authjet.com',
        });
        
        logger.info('User verification email sent successfully', { email, userId, applicationId });
      } catch (error) {
        logger.error('Failed to send user verification email:', error);
        throw error;
      }
    }

    // ADD THIS MISSING METHOD
    async sendRoleRequestEmail(clientEmail, clientName, userEmail, userName, currentRole, requestedRole, expiresAt) {
      const subject = `Role Upgrade Request - ${userName}`;
      const expiresDate = new Date(expiresAt).toLocaleDateString();
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #F59E0B; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .request-info { background: #fff; border: 1px solid #ddd; padding: 15px; margin: 15px 0; }
            .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Role Upgrade Request</h1>
            </div>
            <div class="content">
              <p>Hello ${clientName},</p>
              <p>A user has requested a role upgrade in your application.</p>
              
              <div class="request-info">
                <p><strong>User:</strong> ${userName} (${userEmail})</p>
                <p><strong>Current Role:</strong> ${currentRole}</p>
                <p><strong>Requested Role:</strong> ${requestedRole}</p>
                <p><strong>Request Expires:</strong> ${expiresDate}</p>
              </div>
              
              <p>Please log in to your AuthJet dashboard to review this request.</p>
              <p>You have 3 days to approve or reject this request before it expires.</p>
            </div>
            <div class="footer">
              <p>AuthJet - Role Management System</p>
            </div>
          </div>
        </body>
        </html>
      `;

      try {
        await this.transporter.sendMail({
          to: clientEmail,
          subject,
          html,
          from: process.env.SMTP_FROM || 'noreply@authjet.com',
        });
        
        logger.info('Role request email sent successfully', { 
          clientEmail, 
          clientName, 
          userEmail, 
          requestedRole 
        });
      } catch (error) {
        logger.error('Failed to send role request email:', error);
        throw error;
      }
    }


  async sendWelcomeEmail(email, clientName) {
    const subject = `Welcome to ${clientName}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to ${clientName}</h1>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>Welcome to ${clientName}! Your account has been successfully created.</p>
            <p>You can now sign in to your account using your email address.</p>
            <p>If you have any questions, please don't hesitate to contact our support team.</p>
          </div>
          <div class="footer">
            <p>This email was sent by AuthJet on behalf of ${clientName}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await this.transporter.sendMail({
        to: email,
        subject,
        html,
        from: process.env.SMTP_FROM || 'noreply@authjet.com',
      });
      
      logger.info('Welcome email sent successfully', { email, clientName });
    } catch (error) {
      logger.error('Failed to send welcome email:', error);
      throw error;
    }
  }

  async sendClientWelcomeEmail(contactEmail, clientName, apiKey, secretKey) {
    const subject = `Welcome to AuthJet - Your API Credentials`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .credentials { background: #fff; border: 1px solid #ddd; padding: 15px; margin: 15px 0; }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; margin: 15px 0; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to AuthJet</h1>
          </div>
          <div class="content">
            <p>Hello ${clientName},</p>
            <p>Your AuthJet account has been successfully created! Here are your API credentials:</p>
            
            <div class="credentials">
              <p><strong>API Key:</strong> <code>${apiKey}</code></p>
              <p><strong>Secret Key:</strong> <code>${secretKey}</code></p>
            </div>
            
            <div class="warning">
              <p><strong>Important:</strong> Save your Secret Key now! You won't be able to see it again.</p>
            </div>
            
            <p>You can start integrating AuthJet into your application using our documentation.</p>
            <p>If you have any questions, please visit our documentation or contact support.</p>
          </div>
          <div class="footer">
            <p>AuthJet - Secure Authentication as a Service</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await this.transporter.sendMail({
        to: contactEmail,
        subject,
        html,
        from: process.env.SMTP_FROM || 'noreply@authjet.com',
      });
      
      logger.info('Client welcome email sent successfully', { contactEmail, clientName });
    } catch (error) {
      logger.error('Failed to send client welcome email:', error);
      throw error;
    }
  }

  async sendApiKeyResetEmail(contactEmail, clientName, newApiKey, newSecretKey) {
    const subject = `AuthJet - API Credentials Reset`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #DC2626; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .credentials { background: #fff; border: 1px solid #ddd; padding: 15px; margin: 15px 0; }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; margin: 15px 0; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>API Credentials Reset</h1>
          </div>
          <div class="content">
            <p>Hello ${clientName},</p>
            <p>Your AuthJet API credentials have been reset as requested.</p>
            <p><strong>All previous API keys are now invalid.</strong></p>
            
            <div class="credentials">
              <p><strong>New API Key:</strong> <code>${newApiKey}</code></p>
              <p><strong>New Secret Key:</strong> <code>${newSecretKey}</code></p>
            </div>
            
            <div class="warning">
              <p><strong>Important:</strong> Save your new Secret Key now! You won't be able to see it again.</p>
              <p>Update your application with the new credentials immediately.</p>
            </div>
            
            <p>If you did not request this reset, please contact our support team immediately.</p>
          </div>
          <div class="footer">
            <p>AuthJet - Secure Authentication as a Service</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await this.transporter.sendMail({
        to: contactEmail,
        subject,
        html,
        from: process.env.SMTP_FROM || 'noreply@authjet.com',
      });
      
      logger.info('API key reset email sent successfully', { contactEmail, clientName });
    } catch (error) {
      logger.error('Failed to send API key reset email:', error);
      throw error;
    }
  }

  async sendPasswordResetEmail(email, resetToken, clientName) {
    const resetLink = `${process.env.CLIENT_DASHBOARD_URL}/reset-password?token=${resetToken}`;
    const subject = `Reset Your ${clientName} Password`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .button { background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset</h1>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>You requested to reset your password for ${clientName}.</p>
            <p>Click the button below to reset your password:</p>
            <p style="text-align: center;">
              <a href="${resetLink}" class="button">Reset Password</a>
            </p>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request this reset, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>This email was sent by AuthJet on behalf of ${clientName}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await this.transporter.sendMail({
        to: email,
        subject,
        html,
        from: process.env.SMTP_FROM || 'noreply@authjet.com',
      });
      
      logger.info('Password reset email sent successfully', { email, clientName });
    } catch (error) {
      logger.error('Failed to send password reset email:', error);
      throw error;
    }
  }

  // Generic send method used by admin controller
  async send(mailOptions) {
    try {
      const result = await this.transporter.sendMail({
        ...mailOptions,
        from: mailOptions.from || process.env.EMAIL_FROM || 'noreply@authjet.com',
      });
      
      logger.info('Email sent successfully', { 
        to: mailOptions.to, 
        subject: mailOptions.subject,
        messageId: result.messageId 
      });
      
      return result;
    } catch (error) {
      logger.error('Failed to send email:', {
        error: error.message,
        to: mailOptions.to,
        subject: mailOptions.subject
      });
      throw error;
    }
  }
}

module.exports = new EmailService();