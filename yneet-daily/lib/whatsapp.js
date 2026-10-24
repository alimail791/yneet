// WhatsApp Cloud API helpers (same Meta app and number as the Raise Academy bot).
// OTP needs an approved AUTHENTICATION template; the reward message needs an approved UTILITY or MARKETING template.
const V = process.env.WA_API_VERSION || 'v21.0';

async function sendTemplate(phone10, name, components, lang) {
  const token = process.env.WA_TOKEN, phoneId = process.env.WA_PHONE_ID;
  if (!token || !phoneId || !name) return { skipped: true };
  const r = await fetch(`https://graph.facebook.com/${V}/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp', to: '91' + phone10, type: 'template',
      template: { name, language: { code: lang || process.env.WA_TEMPLATE_LANG || 'en' }, components }
    })
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(body?.error?.message || `WhatsApp API ${r.status}`); e.meta = body; throw e; }
  return body;
}

// Standard Meta authentication template: body {{1}} = code, plus a copy-code button carrying the same code.
const sendOtp = (phone, code) => sendTemplate(phone, process.env.WA_OTP_TEMPLATE, [
  { type: 'body', parameters: [{ type: 'text', text: code }] },
  { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] }
]);

// Reward template body example: "Congrats {{1}}! 3 friends joined YNeet Daily with your link. Your free month code: {{2}}"
const sendReward = (phone, name, code) => sendTemplate(phone, process.env.WA_REWARD_TEMPLATE, [
  { type: 'body', parameters: [{ type: 'text', text: name }, { type: 'text', text: code }] }
]);

const configured = () => !!(process.env.WA_TOKEN && process.env.WA_PHONE_ID && process.env.WA_OTP_TEMPLATE);

module.exports = { sendOtp, sendReward, configured };
