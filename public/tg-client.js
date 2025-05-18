// tg-client.js
const logDiv = document.getElementById('log');

/**
 * Ajoute une entrée dans le journal sous forme <pre>
 * @param {string} content - texte à afficher
 */
function addToJournal(content) {
  const pre = document.createElement('pre');
  pre.textContent = content;
  logDiv.prepend(pre);              // le plus récent en haut
}

/**
 * Envoi vers /api/notify et logge la requête + réponse Telegram
 * @param {string} message - texte brut à envoyer
 */
async function sendNotificationToServer(message) {
  // Log requête brute
  addToJournal(`→ REQ\n${message}`);

  try {
    const res = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' }, // brut pour Safari
      body: message
    });

    const text = await res.text();
    // Log réponse
    addToJournal(`← RESP ${res.status}\n${text}`);
  } catch (err) {
    addToJournal(`‼︎ ERREUR FETCH\n${err}`);
  }
}

// --- expose global pour le reste du code ---
window.sendNotificationToServer = sendNotificationToServer;