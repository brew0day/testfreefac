/***************************************************************
 *  tg-client.js – Logger + envoi vers /api/notify
 **************************************************************/

/* ===== utils journal ====================================== */
function addToJournal(text) {
  const pre = document.createElement('pre');
  pre.textContent = text;
  document.getElementById('log').prepend(pre);     // plus récent en haut
}

/* ===== envoi + log ======================================== */
async function sendNotificationToServer(message) {
  // 1) log requête brute
  addToJournal(`→ REQ\n${message}`);

  try {
    // 2) POST vers votre API (corps texte brut, OK pour Safari)
    const res = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: message
    });

    // 3) réponse brute
    const raw = await res.text();
    addToJournal(`← RESP ${res.status}\n${raw}`);

    // 4) si le body est JSON → essaye d’extraire message Telegram
    try {
      const obj = JSON.parse(raw);

      // Si votre API imbrique déjà la réponse Telegram (`full`)
      if (obj.full) {
        const tel = typeof obj.full === 'string' ? JSON.parse(obj.full) : obj.full;
        if (tel.error_code || tel.description) {
          addToJournal(`↳ TELEGRAM\ncode: ${tel.error_code || '-'}\nmsg : ${tel.description || '-'}`);
        }
      }
    } catch {
      /* raw non-JSON : ignore */
    }

  } catch (err) {
    addToJournal(`‼︎ ERREUR FETCH\n${err}`);
  }
}

/* --------- export global (si nécessaire) ------------------ */
window.sendNotificationToServer = sendNotificationToServer;