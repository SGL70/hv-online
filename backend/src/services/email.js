const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM   = process.env.FROM_EMAIL || 'HvSoldat <onboarding@resend.dev>';
const APP_URL = process.env.FRONTEND_URL || 'http://bataljon.lan';

function resolve(email) {
  if (!email) return null;
  // Omdirigera mock-användare (@test.se) till DEV_EMAIL
  if (email.endsWith('@test.se')) return process.env.DEV_EMAIL || null;
  return email;
}

async function send(to, subject, html) {
  if (!resend) return;
  const recipient = resolve(to);
  if (!recipient) return;
  try {
    await resend.emails.send({ from: FROM, to: recipient, subject, html });
  } catch (e) {
    console.error('[email]', e.message);
  }
}

function wrap(body) {
  return `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#222">
    <div style="background:#1d3557;padding:16px 24px;border-radius:8px 8px 0 0">
      <span style="color:#fff;font-weight:bold;font-size:16px">HvSoldat</span>
    </div>
    <div style="background:#f8f9fa;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e0e0e0">
      ${body}
      <p style="margin-top:16px;font-size:14px;color:#444">Logga in i <strong>HvSoldat</strong> för att hantera ärendet.</p>
      <p style="font-size:11px;color:#aaa;margin-top:24px">Du får detta mail för att du är registrerad i HvSoldat.</p>
    </div>
  </div>`;
}

// ─── Notifikationsfunktioner ─────────────────────────────────────────────────

// Rapport inskickad → notifiera PC/granskarens roll
async function notifyReportSubmitted(submitter, reviewerEmail, reportInfo) {
  const { typ, aktivitet, datum } = reportInfo;
  await send(
    reviewerEmail,
    `Nytt ärende att attestera — ${submitter.name}`,
    wrap(`<h2 style="color:#1d3557;margin-top:0">Nytt ärende att attestera</h2>
      <p><strong>${submitter.name}</strong> har skickat in ett ärende.</p>
      <table style="font-size:14px;border-collapse:collapse">
        <tr><td style="color:#666;padding:3px 12px 3px 0">Typ</td><td><strong>${typ}</strong></td></tr>
        <tr><td style="color:#666;padding:3px 12px 3px 0">Avser</td><td>${aktivitet}</td></tr>
        <tr><td style="color:#666;padding:3px 12px 3px 0">Datum</td><td>${datum}</td></tr>
      </table>`)
  );
}

// Rapport returnerad → notifiera soldaten
async function notifyReportReturned(soldatEmail, reportInfo) {
  const { typ, aktivitet, datum, comment } = reportInfo;
  await send(
    soldatEmail, `Ditt ärende har avfärdats — ${typ}`,
    wrap(`<h2 style="color:#1d3557;margin-top:0">Ärende avfärdat</h2>
      <p>Din redovisning har avfärdats och skickats tillbaka till dig.</p>
      <table style="font-size:14px;border-collapse:collapse">
        <tr><td style="color:#666;padding:3px 12px 3px 0">Typ</td><td><strong>${typ}</strong></td></tr>
        <tr><td style="color:#666;padding:3px 12px 3px 0">Avser</td><td>${aktivitet}</td></tr>
        <tr><td style="color:#666;padding:3px 12px 3px 0">Datum</td><td>${datum}</td></tr>
        ${comment ? `<tr><td style="color:#666;padding:3px 12px 3px 0">Kommentar</td><td>${comment}</td></tr>` : ''}
      </table>`)
  );
}

// Rapport attesterad → notifiera soldaten
async function notifyReportApproved(soldatEmail, reportInfo) {
  const { typ, aktivitet, datum } = reportInfo;
  await send(
    soldatEmail,
    `Ditt ärende är attesterat — ${typ}`,
    wrap(`<h2 style="color:#1d3557;margin-top:0">Ärende attesterat</h2>
      <p>Din redovisning har attesterats och skickas vidare till MR-gruppen för utbetalning.</p>
      <table style="font-size:14px;border-collapse:collapse">
        <tr><td style="color:#666;padding:3px 12px 3px 0">Typ</td><td><strong>${typ}</strong></td></tr>
        <tr><td style="color:#666;padding:3px 12px 3px 0">Avser</td><td>${aktivitet}</td></tr>
        <tr><td style="color:#666;padding:3px 12px 3px 0">Datum</td><td>${datum}</td></tr>
      </table>`)
  );
}

// Ny inventering → notifiera lista av soldater
async function notifyInventoryStarted(emails, deadline) {
  const deadlineText = deadline
    ? `<p>Svarstid: <strong>${new Date(deadline).toLocaleDateString('sv-SE')}</strong></p>`
    : '';
  for (const email of emails) {
    await send(
      email,
      'Kompaniinventering startad — bekräfta din utrustning',
      wrap(`<h2 style="color:#1d3557;margin-top:0">Kompaniinventering</h2>
        <p>En ny kompaniinventering har startats. Logga in och bekräfta din utrustning.</p>
        ${deadlineText}`)
    );
  }
}

// Ny aktivitet → notifiera lista av användare
async function notifyNewActivity(emails, activity) {
  const start = activity.start_time
    ? new Date(activity.start_time).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })
    : '';
  for (const email of emails) {
    await send(
      email,
      `Ny aktivitet: ${activity.title}`,
      wrap(`<h2 style="color:#1d3557;margin-top:0">Ny aktivitet</h2>
        <table style="font-size:14px;border-collapse:collapse">
          <tr><td style="color:#666;padding:3px 12px 3px 0">Titel</td><td><strong>${activity.title}</strong></td></tr>
          ${start ? `<tr><td style="color:#666;padding:3px 12px 3px 0">Start</td><td>${start}</td></tr>` : ''}
          ${activity.description ? `<tr><td style="color:#666;padding:3px 12px 3px 0">Info</td><td>${activity.description}</td></tr>` : ''}
        </table>
        <p style="font-size:13px;color:#555;margin-top:12px">Svara på OSA via appen.</p>`)
    );
  }
}

// Ny nyhet → notifiera lista av användare
async function notifyNewNews(emails, post) {
  for (const email of emails) {
    await send(
      email,
      `Nyhet: ${post.title}`,
      wrap(`<h2 style="color:#1d3557;margin-top:0">${post.title}</h2>
        ${post.body ? `<p style="font-size:14px;color:#444">${post.body.slice(0, 300)}${post.body.length > 300 ? '…' : ''}</p>` : ''}`)
    );
  }
}

// Utrustningsärende beslutat → notifiera soldaten
async function notifyEquipmentDecided(soldatEmail, action, itemName, comment) {
  const approved = action === 'approve';
  await send(
    soldatEmail,
    `Utrustningsärende ${approved ? 'godkänt' : 'avslaget'} — ${itemName}`,
    wrap(`<h2 style="color:#1d3557;margin-top:0">Utrustningsärende ${approved ? 'godkänt' : 'avslaget'}</h2>
      <p>Ditt ärende för <strong>${itemName}</strong> har ${approved ? 'godkänts' : 'avslagits'}.</p>
      ${comment ? `<p style="font-size:14px;color:#555">Kommentar: ${comment}</p>` : ''}`)
  );
}

module.exports = {
  notifyReportSubmitted,
  notifyReportReturned,
  notifyReportApproved,
  notifyInventoryStarted,
  notifyNewActivity,
  notifyNewNews,
  notifyEquipmentDecided,
};
