// ─────────────────────────────────────────────────────────────────────────────
// Brevo (ex-Sendinblue) email service
// Docs: https://developers.brevo.com/reference/sendtransacemail
// ─────────────────────────────────────────────────────────────────────────────

export interface MailOptions {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text?: string;
}

function getBrevoKey(): string | null {
  return process.env.BREVO_API_KEY || null;
}

function getSender() {
  return {
    name: process.env.BREVO_FROM_NAME || 'Project Management System',
    email: process.env.BREVO_FROM || 'dl.cristianmusat@gmail.com',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Core send via Brevo REST API
// ─────────────────────────────────────────────────────────────────────────────

async function sendViaBrevo(apiKey: string, options: MailOptions): Promise<void> {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: getSender(),
      to: [{ email: options.to, name: options.toName || options.to }],
      subject: options.subject,
      htmlContent: options.html,
      textContent: options.text || options.html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim(),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Brevo API ${res.status}: ${body}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Email HTML templates
// ─────────────────────────────────────────────────────────────────────────────

const baseTemplate = (title: string, bodyContent: string) => `
<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);padding:28px 36px;">
            <p style="margin:0;color:#ffffff;font-size:13px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;opacity:.85;">
              Project Management System
            </p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px;">
            ${bodyContent}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 36px;border-top:1px solid #e5e7eb;background:#f9fafb;">
            <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">
              Ai primit acest email deoarece ești asociat cu un proiect în PMS.<br>
              Aceste notificări pot fi dezactivate din setările contului.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

function taskAssignedTemplate(taskTitle: string, projectName?: string): string {
  return baseTemplate('Sarcină nouă asignată', `
    <div style="width:48px;height:48px;background:#ede9fe;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px;">
      <span style="font-size:24px;">📋</span>
    </div>
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Sarcină nouă asignată</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">
      Ți-a fost asignată o sarcină nouă${projectName ? ` în proiectul <strong style="color:#4f46e5;">${projectName}</strong>` : ''}.
    </p>
    <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0;font-size:16px;font-weight:600;color:#4f46e5;">${taskTitle}</p>
    </div>
    <p style="margin:0;font-size:14px;color:#6b7280;">
      Accesează aplicația pentru a vedea detaliile și pentru a începe lucrul.
    </p>
  `);
}

function statusChangedTemplate(taskTitle: string, newStatus: string): string {
  const statusColors: Record<string, string> = {
    'todo': '#6b7280',
    'in_progress': '#3b82f6',
    'in_review': '#f59e0b',
    'done': '#10b981',
  };
  const color = statusColors[newStatus] || '#6b7280';

  return baseTemplate('Status sarcină actualizat', `
    <div style="width:48px;height:48px;background:#eff6ff;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px;">
      <span style="font-size:24px;">🔄</span>
    </div>
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Status actualizat</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">
      Statusul unei sarcini la care ești asociat a fost modificat.
    </p>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin-bottom:16px;">
      <p style="margin:0 0 8px;font-size:13px;color:#9ca3af;font-weight:500;text-transform:uppercase;letter-spacing:.05em;">Sarcină</p>
      <p style="margin:0;font-size:15px;font-weight:600;color:#111827;">${taskTitle}</p>
    </div>
    <div style="display:inline-block;background:${color}1a;border:1px solid ${color}40;border-radius:6px;padding:6px 14px;">
      <span style="font-size:13px;font-weight:600;color:${color};">→ ${newStatus.replace('_', ' ').toUpperCase()}</span>
    </div>
  `);
}

function commentAddedTemplate(taskTitle: string, authorName: string, commentPreview: string): string {
  return baseTemplate('Comentariu nou', `
    <div style="width:48px;height:48px;background:#ecfdf5;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px;">
      <span style="font-size:24px;">💬</span>
    </div>
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Comentariu nou</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">
      <strong style="color:#111827;">${authorName}</strong> a adăugat un comentariu pe o sarcină la care ești asociat.
    </p>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin-bottom:16px;">
      <p style="margin:0 0 8px;font-size:13px;color:#9ca3af;font-weight:500;text-transform:uppercase;letter-spacing:.05em;">Sarcină</p>
      <p style="margin:0 0 16px;font-size:15px;font-weight:600;color:#111827;">${taskTitle}</p>
      <div style="border-left:3px solid #10b981;padding-left:12px;">
        <p style="margin:0;font-size:14px;color:#374151;font-style:italic;">${commentPreview}</p>
      </div>
    </div>
  `);
}

function genericTemplate(title: string, message: string): string {
  return baseTemplate(title, `
    <div style="width:48px;height:48px;background:#f0f9ff;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px;">
      <span style="font-size:24px;">🔔</span>
    </div>
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">${title}</h1>
    <p style="margin:0;font-size:15px;color:#6b7280;line-height:1.6;">${message}</p>
  `);
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export async function sendEmail(options: MailOptions): Promise<void> {
  const apiKey = getBrevoKey();
  if (!apiKey) {
    console.log(`[EMAIL] BREVO_API_KEY neconfigurat — ar fi trimis la: ${options.to} | Subiect: ${options.subject}`);
    return;
  }
  try {
    await sendViaBrevo(apiKey, options);
    console.log(`[EMAIL] Trimis cu succes → ${options.to}: ${options.subject}`);
  } catch (err) {
    console.error('[EMAIL] Eroare la trimitere:', err instanceof Error ? err.message : err);
  }
}

export async function sendTaskAssignedEmail(to: string, toName: string, taskTitle: string, projectName?: string): Promise<void> {
  await sendEmail({
    to, toName,
    subject: `📋 Sarcină nouă: ${taskTitle}`,
    html: taskAssignedTemplate(taskTitle, projectName),
    text: `Ai o sarcină nouă asignată: "${taskTitle}"${projectName ? ` în proiectul "${projectName}"` : ''}.`,
  });
}

export async function sendStatusChangedEmail(to: string, toName: string, taskTitle: string, newStatus: string): Promise<void> {
  await sendEmail({
    to, toName,
    subject: `🔄 Status actualizat: ${taskTitle}`,
    html: statusChangedTemplate(taskTitle, newStatus),
    text: `Sarcina "${taskTitle}" a fost mutată în: ${newStatus.replace('_', ' ')}.`,
  });
}

export async function sendCommentAddedEmail(
  to: string, toName: string, taskTitle: string, authorName: string, commentPreview: string
): Promise<void> {
  await sendEmail({
    to, toName,
    subject: `💬 Comentariu nou pe: ${taskTitle}`,
    html: commentAddedTemplate(taskTitle, authorName, commentPreview),
    text: `${authorName} a comentat pe sarcina "${taskTitle}": ${commentPreview}`,
  });
}

export async function sendGenericNotificationEmail(to: string, toName: string, title: string, message: string): Promise<void> {
  await sendEmail({
    to, toName,
    subject: `🔔 ${title}`,
    html: genericTemplate(title, message),
    text: `${title}: ${message}`,
  });
}

export async function sendEmailVerificationEmail(to: string, toName: string, verifyUrl: string): Promise<void> {
  const html = baseTemplate('Confirmă adresa de email', `
    <div style="width:48px;height:48px;background:#eff6ff;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px;">
      <span style="font-size:24px;">✉️</span>
    </div>
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Confirmare cont</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">
      Bine ai venit, <strong style="color:#111827;">${toName || to}</strong>!<br/>
      Apasă butonul de mai jos pentru a-ți confirma adresa de email și a activa contul.
    </p>
    <a href="${verifyUrl}"
       style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 28px;border-radius:8px;margin-bottom:24px;">
      Confirmă adresa de email
    </a>
    <p style="margin:16px 0 0;font-size:13px;color:#9ca3af;">
      Link-ul expiră în <strong>24 de ore</strong>. Dacă nu ai creat un cont, ignoră acest email.
    </p>
    <p style="margin:8px 0 0;font-size:12px;color:#d1d5db;">
      Sau copiază URL-ul: ${verifyUrl}
    </p>
  `);
  await sendEmail({
    to, toName,
    subject: '✉️ Confirmă adresa de email — PMS',
    html,
    text: `Confirmă adresa de email accesând: ${verifyUrl}\nLink-ul expiră în 24 de ore.`,
  });
}

/**
 * Returnează true dacă Brevo este configurat.
 */
export function isSmtpConfigured(): boolean {
  return !!process.env.BREVO_API_KEY;
}
