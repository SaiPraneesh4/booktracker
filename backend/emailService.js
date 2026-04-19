/**
 * emailService.js
 *
 * EmailJS REST API reference: https://www.emailjs.com/docs/rest-api/send/
 *
 * The correct payload shape is:
 * {
 *   service_id:      "service_xxx",
 *   template_id:     "template_xxx",
 *   user_id:         "YOUR_PUBLIC_KEY",   <-- Public Key from Account page
 *   template_params: { ... }
 * }
 *
 * Despite the name "Public Key", this is what authenticates server-side calls.
 * There is no separate private key needed for the REST API.
 */
const axios = require("axios");

async function sendEmail(templateId, params) {
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;   // renamed from PRIVATE_KEY

  // Log exactly what is missing so .env issues are obvious
  if (!serviceId)  console.error("[EMAIL] EMAILJS_SERVICE_ID is not set in .env");
  if (!publicKey)  console.error("[EMAIL] EMAILJS_PUBLIC_KEY is not set in .env");
  if (!templateId) console.error("[EMAIL] templateId is undefined — check EMAILJS_TEMPLATE_* vars in .env");

  if (!serviceId || !publicKey || !templateId) {
    throw new Error("EmailJS config incomplete — check .env variables");
  }

  const payload = {
    service_id:      serviceId,
    template_id:     templateId,
    user_id:         publicKey,    // EmailJS REST API field name for Public Key
    template_params: params,
  };

  console.log(`[EMAIL] Sending "${templateId}" to ${params.to_email || params.admin_email || "?"}`);

  try {
    const res = await axios.post(
      "https://api.emailjs.com/api/v1.0/email/send",
      payload,
      { headers: { "Content-Type": "application/json" }, timeout: 15000 }
    );
    console.log(`[EMAIL] OK ${res.status}: ${res.data}`);
  } catch (err) {
    const status   = err.response?.status;
    const ejsError = err.response?.data;
    console.error(`[EMAIL] FAILED ${status}:`, ejsError || err.message);
    const reason = typeof ejsError === "string"
      ? ejsError
      : ejsError?.error || ejsError?.message || err.message;
    throw new Error(`EmailJS failed (${status}): ${reason}`);
  }
}

async function sendPriceAlert({ toEmail, bookTitle, bookUrl, currentPrice, targetPrice }) {
  return sendEmail(process.env.EMAILJS_TEMPLATE_PRICE_ALERT, {
    to_email:      toEmail,
    book_title:    bookTitle,
    book_url:      bookUrl,
    current_price: `Rs.${currentPrice}`,
    target_price:  `Rs.${targetPrice}`,
    message:       `"${bookTitle}" has dropped to Rs.${currentPrice} — at or below your target of Rs.${targetPrice}. Grab it here: ${bookUrl}`,
  });
}

async function sendMagicLink({ toEmail, magicUrl }) {
  return sendEmail(process.env.EMAILJS_TEMPLATE_MAGIC_LINK, {
    to_email:  toEmail,
    magic_url: magicUrl,
    message:   "Click the link below to view all the books you are tracking. The link expires in 24 hours.",
  });
}

async function sendFeedback({ fromEmail, message, adminEmail }) {
  return sendEmail(process.env.EMAILJS_TEMPLATE_FEEDBACK, {
    admin_email: adminEmail,
    from_email:  fromEmail,
    message,
    subject:     `BookTracker feedback from ${fromEmail}`,
  });
}

module.exports = { sendPriceAlert, sendMagicLink, sendFeedback };