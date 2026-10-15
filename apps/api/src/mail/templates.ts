export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(brand: string, name: string, intro: string, button: string, url: string, outro: string) {
  const text = `Hi ${name},\n\n${intro}\n\n${button}: ${url}\n\n${outro}\n\n- ${brand}`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#111">
<h2 style="margin:0 0 16px">${esc(brand)}</h2>
<p>Hi ${esc(name)},</p><p>${esc(intro)}</p>
<p><a href="${esc(url)}" style="display:inline-block;background:#10b981;color:#111;font-weight:bold;text-decoration:none;padding:12px 20px;border-radius:10px">${esc(button)}</a></p>
<p style="font-size:13px;color:#555">Or paste this link into your browser:<br>${esc(url)}</p>
<p style="font-size:13px;color:#555">${esc(outro)}</p></div>`;
  return { text, html };
}

export const verifyEmailMail = (brand: string, name: string, url: string) => ({
  subject: `Verify your ${brand} email`,
  ...layout(brand, name, `Please confirm your email address to finish setting up your ${brand} account.`, "Verify email", url, "This link works for 24 hours. If you didn't create an account, you can ignore this email."),
});

export const resetPasswordMail = (brand: string, name: string, url: string) => ({
  subject: `Reset your ${brand} password`,
  ...layout(brand, name, "We received a request to reset your password.", "Choose a new password", url, "This link works for 1 hour and can be used once. If you didn't ask for this, ignore this email; your password stays the same."),
});
