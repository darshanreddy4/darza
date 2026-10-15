import { esc } from "./templates";

export interface QuestionMailData {
  brand: string;
  name: string;
  product: string;
  question: string;
  answer: string;
  url: string;
}

export function questionMail(d: QuestionMailData) {
  const text = [`Hi ${d.name},`, "", `We've answered your question about ${d.product}.`, "", `Your question: ${d.question}`, `Our answer: ${d.answer}`, "", `See it on the product page: ${d.url}`, "", `- ${d.brand}`].join("\n");
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#111">
<h2 style="margin:0 0 4px">Your question was answered</h2>
<p style="margin:0 0 16px;color:#555">${esc(d.product)}</p>
<p>Hi ${esc(d.name)},</p>
<p style="font-size:14px;color:#555">You asked: ${esc(d.question)}</p>
<p style="background:#f6f6f6;padding:12px;border-radius:8px;font-size:14px">${esc(d.answer)}</p>
<p><a href="${esc(d.url)}" style="display:inline-block;background:#10b981;color:#111;font-weight:bold;text-decoration:none;padding:12px 20px;border-radius:10px">View the product</a></p></div>`;
  return { subject: `Your question about ${d.product} was answered`, text, html };
}
