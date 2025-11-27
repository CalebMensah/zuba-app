// utils/sendEmailNotification.js
import nodemailer from 'nodemailer';
import { cache } from '../config/redis.js';

// Email transporter configuration
const transporter = nodemailer.createTransport({
  service: 'gmail', // Consider switching to SendGrid, Mailgun, or AWS SES for production
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});

// Brand colors for Zuba
const BRAND_COLORS = {
  primary: '#6366F1', // Indigo
  success: '#10B981', // Green
  danger: '#EF4444', // Red
  warning: '#F59E0B', // Amber
  text: '#1F2937',
  textLight: '#6B7280',
  background: '#F9FAFB',
};

/**
 * Base email template wrapper with consistent branding
 */
const baseTemplate = (content, preheader = '') => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <title>Zuba</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: ${BRAND_COLORS.background};">
  <!-- Preheader text -->
  <div style="display: none; max-height: 0; overflow: hidden;">
    ${preheader}
  </div>
  
  <!-- Email Container -->
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: ${BRAND_COLORS.background};">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <!-- Main Content Card -->
        <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header with Logo -->
          <tr>
            <td style="background: linear-gradient(135deg, ${BRAND_COLORS.primary} 0%, #8B5CF6 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: bold; font-family: Arial, sans-serif;">
                🛍️ Zuba
              </h1>
              <p style="margin: 5px 0 0 0; color: #E0E7FF; font-size: 14px; font-family: Arial, sans-serif;">
                Social Commerce Made Simple
              </p>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px 30px; font-family: Arial, sans-serif; color: ${BRAND_COLORS.text};">
              ${content}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px; background-color: #F3F4F6; border-radius: 0 0 8px 8px; text-align: center; font-family: Arial, sans-serif;">
              <p style="margin: 0 0 15px 0; color: ${BRAND_COLORS.textLight}; font-size: 14px;">
                Follow us on social media
              </p>
              <div style="margin-bottom: 20px;">
                <a href="https://facebook.com/zuba" style="display: inline-block; margin: 0 8px; text-decoration: none; color: ${BRAND_COLORS.primary};">Facebook</a>
                <a href="https://twitter.com/zuba" style="display: inline-block; margin: 0 8px; text-decoration: none; color: ${BRAND_COLORS.primary};">Twitter</a>
                <a href="https://instagram.com/zuba" style="display: inline-block; margin: 0 8px; text-decoration: none; color: ${BRAND_COLORS.primary};">Instagram</a>
              </div>
              <p style="margin: 0; color: ${BRAND_COLORS.textLight}; font-size: 12px;">
                © ${new Date().getFullYear()} Zuba. All rights reserved.
              </p>
              <p style="margin: 10px 0 0 0; color: ${BRAND_COLORS.textLight}; font-size: 11px;">
                This is an automated message. Please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

/**
 * Creates a CTA button
 */
const ctaButton = (text, url, color = BRAND_COLORS.primary) => `
  <div style="text-align: center; margin: 30px 0;">
    <a href="${url}" style="display: inline-block; background-color: ${color}; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; font-family: Arial, sans-serif;">
      ${text}
    </a>
  </div>
`;

/**
 * Email Templates
 */
const templates = {
  verification_status: ({ toName, storeName, status, reason, storeUrl }) => {
    if (status === 'verified') {
      const content = `
        <div style="text-align: center; margin-bottom: 30px;">
          <div style="display: inline-block; background-color: ${BRAND_COLORS.success}; color: white; width: 64px; height: 64px; border-radius: 50%; line-height: 64px; font-size: 32px;">
            ✓
          </div>
        </div>
        <h2 style="color: ${BRAND_COLORS.success}; margin: 0 0 20px 0; font-size: 24px;">
          Your Store is Verified! 🎉
        </h2>
        <p style="font-size: 16px; line-height: 1.6; margin-bottom: 15px;">
          Hi <strong>${toName}</strong>,
        </p>
        <p style="font-size: 16px; line-height: 1.6; margin-bottom: 15px;">
          Great news! Your store <strong>${storeName}</strong> has been successfully verified and is now live on Zuba.
        </p>
        <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
          Customers can now discover and purchase from your store. Start sharing your products with the Zuba community!
        </p>
        ${ctaButton('View Your Store', storeUrl || '#', BRAND_COLORS.success)}
        <div style="background-color: #F0FDF4; border-left: 4px solid ${BRAND_COLORS.success}; padding: 15px; margin-top: 25px;">
          <p style="margin: 0; font-size: 14px; color: ${BRAND_COLORS.text};">
            <strong>💡 Next Steps:</strong><br>
            • Add more products to your store<br>
            • Share your store on social media<br>
            • Engage with customers through our chat feature
          </p>
        </div>
      `;
      return baseTemplate(content, `Your store ${storeName} is now verified!`);
    } else if (status === 'rejected') {
      const content = `
        <div style="text-align: center; margin-bottom: 30px;">
          <div style="display: inline-block; background-color: ${BRAND_COLORS.danger}; color: white; width: 64px; height: 64px; border-radius: 50%; line-height: 64px; font-size: 32px;">
            ✕
          </div>
        </div>
        <h2 style="color: ${BRAND_COLORS.danger}; margin: 0 0 20px 0; font-size: 24px;">
          Store Verification Needs Attention
        </h2>
        <p style="font-size: 16px; line-height: 1.6; margin-bottom: 15px;">
          Hi <strong>${toName}</strong>,
        </p>
        <p style="font-size: 16px; line-height: 1.6; margin-bottom: 15px;">
          We've reviewed your verification request for <strong>${storeName}</strong>, and unfortunately, we need you to make some changes before we can approve it.
        </p>
        <div style="background-color: #FEF2F2; border-left: 4px solid ${BRAND_COLORS.danger}; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px; color: ${BRAND_COLORS.text};">
            <strong>Reason:</strong><br>
            ${reason || 'Please ensure all verification documents are clear and meet our requirements.'}
          </p>
        </div>
        <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
          Don't worry! You can resubmit your verification documents at any time. Our team is here to help if you have questions.
        </p>
        ${ctaButton('Update Verification', storeUrl || '#', BRAND_COLORS.danger)}
      `;
      return baseTemplate(content, `Action needed for ${storeName} verification`);
    }
  },

  welcome: ({ toName, userName, profileUrl }) => {
    const content = `
      <h2 style="color: ${BRAND_COLORS.primary}; margin: 0 0 20px 0; font-size: 24px;">
        Welcome to Zuba! 👋
      </h2>
      <p style="font-size: 16px; line-height: 1.6; margin-bottom: 15px;">
        Hi <strong>${toName}</strong>,
      </p>
      <p style="font-size: 16px; line-height: 1.6; margin-bottom: 15px;">
        We're thrilled to have you join our community of social commerce enthusiasts! Zuba makes it easy to discover amazing products, connect with sellers, and shop with confidence.
      </p>
      ${ctaButton('Complete Your Profile', profileUrl || '#')}
      <div style="background-color: #EEF2FF; border-radius: 8px; padding: 20px; margin-top: 25px;">
        <h3 style="margin: 0 0 15px 0; font-size: 18px; color: ${BRAND_COLORS.primary};">
          Get Started:
        </h3>
        <p style="margin: 0 0 10px 0; font-size: 14px; line-height: 1.6;">
          🛒 <strong>Browse Products</strong> - Discover unique items from verified sellers<br>
          👥 <strong>Follow Sellers</strong> - Stay updated on new products and deals<br>
          💬 <strong>Chat & Shop</strong> - Connect directly with sellers<br>
          ⭐ <strong>Leave Reviews</strong> - Help others make informed decisions
        </p>
      </div>
    `;
    return baseTemplate(content, 'Welcome to Zuba - Let\'s get started!');
  },

  order_confirmation: ({ toName, orderId, items, total, orderUrl, estimatedDelivery }) => {
    const itemsList = items.map(item => `
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #E5E7EB;">
          <strong>${item.name}</strong><br>
          <span style="color: ${BRAND_COLORS.textLight}; font-size: 14px;">Qty: ${item.quantity}</span>
        </td>
        <td style="padding: 10px 0; border-bottom: 1px solid #E5E7EB; text-align: right;">
          ${item.price}
        </td>
      </tr>
    `).join('');

    const content = `
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="display: inline-block; background-color: ${BRAND_COLORS.success}; color: white; width: 64px; height: 64px; border-radius: 50%; line-height: 64px; font-size: 32px;">
          ✓
        </div>
      </div>
      <h2 style="color: ${BRAND_COLORS.primary}; margin: 0 0 20px 0; font-size: 24px;">
        Order Confirmed! 🎉
      </h2>
      <p style="font-size: 16px; line-height: 1.6; margin-bottom: 15px;">
        Hi <strong>${toName}</strong>,
      </p>
      <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
        Thank you for your order! We've received your payment and the seller is preparing your items.
      </p>
      <div style="background-color: #F9FAFB; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <p style="margin: 0 0 10px 0; font-size: 14px; color: ${BRAND_COLORS.textLight};">Order Number</p>
        <p style="margin: 0; font-size: 20px; font-weight: bold; color: ${BRAND_COLORS.primary};">#${orderId}</p>
      </div>
      <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        ${itemsList}
        <tr>
          <td style="padding: 15px 0; font-size: 18px; font-weight: bold;">Total</td>
          <td style="padding: 15px 0; text-align: right; font-size: 18px; font-weight: bold; color: ${BRAND_COLORS.primary};">
            ${total}
          </td>
        </tr>
      </table>
      <p style="font-size: 14px; color: ${BRAND_COLORS.textLight}; margin-bottom: 20px;">
        📦 Estimated delivery: <strong>${estimatedDelivery || '3-5 business days'}</strong>
      </p>
      ${ctaButton('Track Your Order', orderUrl || '#')}
    `;
    return baseTemplate(content, `Order #${orderId} confirmed!`);
  },

  order_shipped: ({ toName, orderId, trackingNumber, trackingUrl, estimatedDelivery }) => {
    const content = `
      <h2 style="color: ${BRAND_COLORS.primary}; margin: 0 0 20px 0; font-size: 24px;">
        Your Order is On Its Way! 📦
      </h2>
      <p style="font-size: 16px; line-height: 1.6; margin-bottom: 15px;">
        Hi <strong>${toName}</strong>,
      </p>
      <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
        Great news! Your order <strong>#${orderId}</strong> has been shipped and is heading your way.
      </p>
      ${trackingNumber ? `
        <div style="background-color: #EEF2FF; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0; font-size: 14px; color: ${BRAND_COLORS.textLight};">Tracking Number</p>
          <p style="margin: 0; font-size: 18px; font-weight: bold; color: ${BRAND_COLORS.primary};">${trackingNumber}</p>
        </div>
      ` : ''}
      <p style="font-size: 14px; color: ${BRAND_COLORS.textLight}; margin-bottom: 20px;">
        📅 Estimated arrival: <strong>${estimatedDelivery || '2-3 business days'}</strong>
      </p>
      ${ctaButton('Track Package', trackingUrl || '#')}
    `;
    return baseTemplate(content, `Order #${orderId} is on the way!`);
  },

  password_reset: ({ toName, resetUrl, expiryTime }) => {
    const content = `
      <h2 style="color: ${BRAND_COLORS.primary}; margin: 0 0 20px 0; font-size: 24px;">
        Reset Your Password 🔐
      </h2>
      <p style="font-size: 16px; line-height: 1.6; margin-bottom: 15px;">
        Hi <strong>${toName}</strong>,
      </p>
      <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
        We received a request to reset your password. Click the button below to create a new password.
      </p>
      ${ctaButton('Reset Password', resetUrl || '#')}
      <div style="background-color: #FEF3C7; border-left: 4px solid ${BRAND_COLORS.warning}; padding: 15px; margin-top: 25px;">
        <p style="margin: 0; font-size: 14px; color: ${BRAND_COLORS.text};">
          ⏰ This link will expire in <strong>${expiryTime || '1 hour'}</strong>.<br>
          If you didn't request this, please ignore this email.
        </p>
      </div>
      <p style="font-size: 14px; color: ${BRAND_COLORS.textLight}; margin-top: 20px;">
        For security reasons, never share this link with anyone.
      </p>
    `;
    return baseTemplate(content, 'Reset your Zuba password');
  },

  new_follower: ({ toName, followerName, followerUsername, profileUrl }) => {
    const content = `
      <h2 style="color: ${BRAND_COLORS.primary}; margin: 0 0 20px 0; font-size: 24px;">
        You Have a New Follower! 👥
      </h2>
      <p style="font-size: 16px; line-height: 1.6; margin-bottom: 15px;">
        Hi <strong>${toName}</strong>,
      </p>
      <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
        <strong>${followerName}</strong> (@${followerUsername}) just started following you on Zuba!
      </p>
      ${ctaButton('View Profile', profileUrl || '#')}
      <p style="font-size: 14px; color: ${BRAND_COLORS.textLight}; margin-top: 20px; text-align: center;">
        Keep posting great products to grow your following!
      </p>
    `;
    return baseTemplate(content, `${followerName} started following you`);
  },

  cart_reminder: ({ toName, items, cartUrl }) => {
    const content = `
      <h2 style="color: ${BRAND_COLORS.primary}; margin: 0 0 20px 0; font-size: 24px;">
        Don't Forget Your Items! 🛒
      </h2>
      <p style="font-size: 16px; line-height: 1.6; margin-bottom: 15px;">
        Hi <strong>${toName}</strong>,
      </p>
      <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
        You left <strong>${items} item${items > 1 ? 's' : ''}</strong> in your cart. These popular items won't last long!
      </p>
      ${ctaButton('Complete Your Purchase', cartUrl || '#')}
      <div style="background-color: #FEF3C7; border-radius: 8px; padding: 15px; margin-top: 25px; text-align: center;">
        <p style="margin: 0; font-size: 14px; color: ${BRAND_COLORS.text};">
          🎁 <strong>Limited time:</strong> Free shipping on orders over $50!
        </p>
      </div>
    `;
    return baseTemplate(content, 'Your cart is waiting!');
  },

  review_request: ({ toName, orderId, productName, reviewUrl }) => {
    const content = `
      <h2 style="color: ${BRAND_COLORS.primary}; margin: 0 0 20px 0; font-size: 24px;">
        How Was Your Purchase? ⭐
      </h2>
      <p style="font-size: 16px; line-height: 1.6; margin-bottom: 15px;">
        Hi <strong>${toName}</strong>,
      </p>
      <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
        We hope you're enjoying your recent purchase of <strong>${productName}</strong>! Your feedback helps other shoppers make great decisions.
      </p>
      ${ctaButton('Write a Review', reviewUrl || '#')}
      <p style="font-size: 14px; color: ${BRAND_COLORS.textLight}; margin-top: 20px; text-align: center;">
        It only takes a minute and helps our community grow! 🌟
      </p>
    `;
    return baseTemplate(content, 'Share your experience with us');
  },

  generic: ({ toName, title, message, ctaText, ctaUrl }) => {
    const content = `
      <h2 style="color: ${BRAND_COLORS.primary}; margin: 0 0 20px 0; font-size: 24px;">
        ${title || 'Notification from Zuba'}
      </h2>
      <p style="font-size: 16px; line-height: 1.6; margin-bottom: 15px;">
        Hi <strong>${toName}</strong>,
      </p>
      <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
        ${message || 'You have a new notification from Zuba.'}
      </p>
      ${ctaText && ctaUrl ? ctaButton(ctaText, ctaUrl) : ''}
    `;
    return baseTemplate(content, title || 'Notification from Zuba');
  },
};

/**
 * Converts HTML email to plain text version
 */
const htmlToPlainText = (html) => {
  return html
    .replace(/<style[^>]*>.*<\/style>/gi, '')
    .replace(/<script[^>]*>.*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Sends an email notification with retry logic
 */
export const sendEmailNotification = async ({ 
  to, 
  toName, 
  subject, 
  template, 
  templateData = {},
  retries = 3 
}) => {
  // Rate limiting check
  const rateLimitKey = `email_rate_limit:${to}`;
  try {
    const recentEmails = await cache.get(rateLimitKey);
    if (recentEmails && parseInt(recentEmails) > 10) {
      console.warn(`Rate limit exceeded for ${to}`);
      return { success: false, error: 'Rate limit exceeded' };
    }
  } catch (err) {
    console.error('Cache error:', err);
  }

  let attempt = 0;
  let lastError;

  while (attempt < retries) {
    try {
      // Get template
      const templateFn = templates[template] || templates.generic;
      const htmlContent = templateFn({ toName, ...templateData });
      const textContent = htmlToPlainText(htmlContent);

      const mailOptions = {
        from: `"Zuba" <${process.env.EMAIL_ADDRESS}>`,
        to,
        subject,
        html: htmlContent,
        text: textContent,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', info.messageId);

      // Update rate limit counter
      try {
        await cache.incr(rateLimitKey);
        await cache.expire(rateLimitKey, 3600); // 1 hour window
      } catch (err) {
        console.error('Cache increment error:', err);
      }

      return { success: true, messageId: info.messageId };
    } catch (error) {
      lastError = error;
      attempt++;
      console.error(`Email send attempt ${attempt} failed:`, error.message);
      
      if (attempt < retries) {
        // Exponential backoff: wait 2^attempt seconds
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  console.error('All email send attempts failed:', lastError);
  return { success: false, error: lastError.message };
};
