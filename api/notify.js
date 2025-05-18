// api/notify.js
// -----------------------------------------------------------------------------
// Désactive le bodyParser Next.js pour pouvoir lire le corps brut (text/plain)
export const config = {
  api: {
    bodyParser: false,
  },
};

const TOKEN        = process.env.TELEGRAM_TOKEN;
const CHAT         = process.env.CHAT_ID;
const IPINFO_TOKEN = process.env.IPINFO_TOKEN || '';

// -----------------------------------------------------------------------------
// UTIL : essaye ipinfo → ipwho → ip-api jusqu'à trouver ISP + pays
async function geoLookup(ip) {
  let isp = 'inconnue';
  let country = 'inconnue';

  // 1) ipinfo.io
  try {
    const r = await fetch(
      `https://ipinfo.io/${ip}/json${IPINFO_TOKEN ? `?token=${IPINFO_TOKEN}` : ''}`
    );
    if (r.ok) {
      const d = await r.json();
      isp     = d.org ? d.org.replace(/^AS\\d+\\s+/i, '') : isp;
      country = d.country || country;
      if (isp !== 'inconnue' || country !== 'inconnue') return { isp, country };
    }
  } catch {}

  // 2) ipwho.is
  try {
    const r = await fetch(`https://ipwho.is/${ip}`);
    const d = await r.json();
    if (d.success) {
      isp     = d.org || isp;
      country = d.country || country;
      return { isp, country };
    }
  } catch {}

  // 3) ip-api.com
  try {
    const r = await fetch(
      `https://ip-api.com/json/${ip}?fields=status,country,countryCode,isp`
    );
    const d = await r.json();
    if (d.status === 'success') {
      isp     = d.isp ? d.isp.replace(/^AS\\d+\\s+/i, '') : isp;
      country = d.country || d.countryCode || country;
    }
  } catch {}

  return { isp, country };
}

// Décodage : Safari encode parfois le texte (ex. "%0A" pour les retours ligne)
function decodeBody(raw) {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

// -----------------------------------------------------------------------------
// HANDLER
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // ----- Lire le corps BRUT (text/plain, urlencoded ou JSON) -----------------
  const rawBody = await new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });

  let message = '';
  const ctype = req.headers['content-type'] || '';

  if (rawBody) {
    if (ctype.includes('application/json')) {
      try {
        message = JSON.parse(rawBody).message || '';
      } catch {}
    } else if (ctype.includes('application/x-www-form-urlencoded')) {
      const params = new URLSearchParams(rawBody);
      message =
        params.get('message') ||
        params.get('text') ||
        [...params.values()][0] ||
        '';
    } else {
      // text/plain
      message = rawBody;
    }
  }

  // fallback query ?message=
  if (!message && typeof req.query.message === 'string') {
    message = req.query.message;
  }

  message = decodeBody(message.trim());
  if (!message) return res.status(400).json({ error: 'Missing message' });

  // ----- IP & User-Agent ------------------------------------------------------
  const forwarded = req.headers['x-forwarded-for'];
  const ip =
    (forwarded ? forwarded.split(',')[0] : req.socket.remoteAddress) ||
    'inconnue';
  const ua = req.headers['user-agent'] || 'inconnu';

  // ----- ISP & Pays -----------------------------------------------------------
  const { isp, country } = await geoLookup(ip);
  const countryDisplay =
    country && country.length === 2
      ? new Intl.DisplayNames(['fr'], { type: 'region' }).of(country)
      : country || 'inconnue';

  // ----- Date & heure ---------------------------------------------------------
  const now = new Date();
  const date = now.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
  const time = now.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  // ----- Format du message Telegram ------------------------------------------
  const [header, ...lines] = message.split(/\r?\n|%0A/);
  let text = `📝 ${header.trim()}`;
  lines.forEach(l => {
    if (l.trim()) text += `\n${l.trim()}`;
  });
  text += `\n\n`;
  text += `🗓️ Date & heure : ${date}, ${time}`;
  text += `\n🌐 IP Client     : ${ip}`;
  text += `\n🔎 ISP Client    : ${isp}`;
  text += `\n🌍 Pays Client   : ${countryDisplay}`;
  text += `\n📍 User-Agent    : ${ua}`;
  text += `\n©️ ${now.getFullYear()} ©️`;

  // ----- Envoi Telegram -------------------------------------------------------
  const tg = await fetch(
    `https://api.telegram.org/bot${TOKEN}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
    }
  );

  const raw = await tg.text();
  return res
    .status(tg.ok ? 200 : tg.status)
    .json({ ok: tg.ok, full: raw });
}