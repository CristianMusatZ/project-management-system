import net from 'net';
import tls from 'tls';

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

interface SMTPConfig {
  host: string;
  port: number;
  secure: boolean;    // true → SSL/TLS direct (port 465) | false → STARTTLS (port 587)
  user: string;
  pass: string;
  from: string;
  fromName: string;
}

export interface MailOptions {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text?: string;
}

function getConfig(): SMTPConfig | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  return {
    host,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user,
    pass,
    from: process.env.SMTP_FROM || user,
    fromName: process.env.SMTP_FROM_NAME || 'Project Management System',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Low-level SMTP protocol helpers (Node.js net + tls built-ins, no libraries)
// ─────────────────────────────────────────────────────────────────────────────

type RawSocket = net.Socket | tls.TLSSocket;

/**
 * Waits for a complete SMTP response (handles multi-line replies like EHLO).
 * Resolves when it sees a final line "CODE<space>text" with the expected code.
 */
function awaitCode(socket: RawSocket, expectedCode: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let buf = '';

    function onData(chunk: Buffer | string) {
      buf += chunk.toString();
      // Process line by line
      let nlIdx: number;
      while ((nlIdx = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nlIdx).replace(/\r$/, '');
        buf = buf.slice(nlIdx + 1);
        if (line.length < 3) continue;
        const code = parseInt(line.slice(0, 3), 10);
        // Final line: "250 OK" (space after code) or exactly 3 chars
        const isFinal = line.length === 3 || line[3] === ' ';
        if (isFinal) {
          socket.removeListener('data', onData);
          socket.removeListener('error', onError);
          if (code === expectedCode) resolve(line);
          else reject(new Error(`SMTP ${code}: ${line.slice(4).trim()}`));
          return;
        }
      }
    }

    function onError(e: Error) {
      socket.removeListener('data', onData);
      reject(e);
    }

    socket.on('data', onData);
    socket.once('error', onError);
  });
}

/** Send an SMTP command string and wait for the expected response code. */
function smtpCmd(socket: RawSocket, command: string, expectedCode: number): Promise<string> {
  const p = awaitCode(socket, expectedCode);
  socket.write(command + '\r\n');
  return p;
}

/** Open a plain TCP connection to the SMTP server. */
function openTCP(host: string, port: number): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const s = net.createConnection(port, host);
    s.once('connect', () => resolve(s));
    s.once('error', reject);
  });
}

/** Upgrade an existing plain socket to TLS (STARTTLS flow). */
function upgradeToTLS(plain: net.Socket, host: string): Promise<tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    const tlsSock = tls.connect({ socket: plain, host, rejectUnauthorized: false });
    tlsSock.once('secureConnect', () => resolve(tlsSock));
    tlsSock.once('error', reject);
  });
}

/** Open a direct TLS connection (port 465 / SMTPS). */
function openTLS(host: string, port: number): Promise<tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    const s = tls.connect({ host, port, rejectUnauthorized: false });
    s.once('secureConnect', () => resolve(s));
    s.once('error', reject);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// RFC 2822 message builder (multipart/alternative: text + HTML)
// ─────────────────────────────────────────────────────────────────────────────

function buildMessage(config: SMTPConfig, options: MailOptions): string {
  const boundary = `pms-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const msgId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@pms-app>`;
  const textBody = options.text || options.html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  const fromHeader = `"${config.fromName}" <${config.from}>`;
  const toHeader = options.toName ? `"${options.toName}" <${options.to}>` : options.to;

  const parts = [
    `Date: ${new Date().toUTCString()}`,
    `From: ${fromHeader}`,
    `To: ${toHeader}`,
    `Subject: ${options.subject}`,
    `Message-ID: ${msgId}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: 8bit`,
    ``,
    textBody,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: 8bit`,
    ``,
    options.html,
    ``,
    `--${boundary}--`,
  ];

  // Dot-stuffing: SMTP requires lines starting with '.' to be doubled
  return parts.map(l => (l === '.') ? '..' : l).join('\r\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Core SMTP send
// ─────────────────────────────────────────────────────────────────────────────

async function sendViaSMTP(config: SMTPConfig, options: MailOptions): Promise<void> {
  let socket: RawSocket;

  if (config.secure) {
    // Direct TLS (SMTPS, port 465)
    socket = await openTLS(config.host, config.port);
    await awaitCode(socket, 220);             // Server greeting
  } else {
    // Plain → STARTTLS (port 587)
    const plain = await openTCP(config.host, config.port);
    await awaitCode(plain, 220);              // Server greeting
    await smtpCmd(plain, 'EHLO pms-app', 250);
    await smtpCmd(plain, 'STARTTLS', 220);
    socket = await upgradeToTLS(plain, config.host);
  }

  // After TLS negotiation, (re-)identify ourselves
  await smtpCmd(socket, 'EHLO pms-app', 250);

  // AUTH LOGIN
  await smtpCmd(socket, 'AUTH LOGIN', 334);
  await smtpCmd(socket, Buffer.from(config.user).toString('base64'), 334);
  await smtpCmd(socket, Buffer.from(config.pass).toString('base64'), 235);

  // Envelope
  await smtpCmd(socket, `MAIL FROM:<${config.from}>`, 250);
  await smtpCmd(socket, `RCPT TO:<${options.to}>`, 250);

  // Body
  await smtpCmd(socket, 'DATA', 354);
  const message = buildMessage(config, options);
  await smtpCmd(socket, message + '\r\n.', 250);  // CRLF.CRLF = end of data

  socket.write('QUIT\r\n');
  socket.destroy();
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
  const config = getConfig();
  if (!config) {
    console.log(`[EMAIL] SMTP neconfigurat — ar fi trimis la: ${options.to} | Subiect: ${options.subject}`);
    return;
  }
  try {
    await sendViaSMTP(config, options);
    console.log(`[EMAIL] Trimis cu succes → ${options.to}: ${options.subject}`);
  } catch (err) {
    // Email-ul este non-critic — logăm eroarea fără a bloca operațiunea principală
    console.error('[EMAIL] Eroare la trimitere:', err instanceof Error ? err.message : err);
  }
}

/**
 * Trimite email pentru notificarea de tip "task_assigned".
 */
export async function sendTaskAssignedEmail(to: string, toName: string, taskTitle: string, projectName?: string): Promise<void> {
  await sendEmail({
    to,
    toName,
    subject: `📋 Sarcină nouă: ${taskTitle}`,
    html: taskAssignedTemplate(taskTitle, projectName),
    text: `Ai o sarcină nouă asignată: "${taskTitle}"${projectName ? ` în proiectul "${projectName}"` : ''}.`,
  });
}

/**
 * Trimite email pentru notificarea de tip "task_status_changed".
 */
export async function sendStatusChangedEmail(to: string, toName: string, taskTitle: string, newStatus: string): Promise<void> {
  await sendEmail({
    to,
    toName,
    subject: `🔄 Status actualizat: ${taskTitle}`,
    html: statusChangedTemplate(taskTitle, newStatus),
    text: `Sarcina "${taskTitle}" a fost mutată în: ${newStatus.replace('_', ' ')}.`,
  });
}

/**
 * Trimite email pentru notificarea de tip "comment_added".
 */
export async function sendCommentAddedEmail(
  to: string,
  toName: string,
  taskTitle: string,
  authorName: string,
  commentPreview: string
): Promise<void> {
  await sendEmail({
    to,
    toName,
    subject: `💬 Comentariu nou pe: ${taskTitle}`,
    html: commentAddedTemplate(taskTitle, authorName, commentPreview),
    text: `${authorName} a comentat pe sarcina "${taskTitle}": ${commentPreview}`,
  });
}

/**
 * Trimite email generic (pentru extensibilitate ulterioară).
 */
export async function sendGenericNotificationEmail(to: string, toName: string, title: string, message: string): Promise<void> {
  await sendEmail({
    to,
    toName,
    subject: `🔔 ${title}`,
    html: genericTemplate(title, message),
    text: `${title}: ${message}`,
  });
}

/**
 * Trimite email de confirmare cont după înregistrare.
 */
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
    to,
    toName,
    subject: '✉️ Confirmă adresa de email — PMS',
    html,
    text: `Confirmă adresa de email accesând: ${verifyUrl}\nLink-ul expiră în 24 de ore.`,
  });
}

/**
 * Returnează true dacă SMTP este configurat (util pentru a decide dacă se trimite email de verificare).
 */
export function isSmtpConfigured(): boolean {
  return !!process.env.SMTP_HOST && !!process.env.SMTP_USER && !!process.env.SMTP_PASS;
}
