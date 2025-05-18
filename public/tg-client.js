// --- LOG utils -------------------------------------------------
function addToJournal(txt){
  const pre=document.createElement('pre');
  pre.textContent=txt;
  document.getElementById('log').prepend(pre);
}

// --- Envoi vers /api/notify + log ------------------------------
async function sendNotificationToServer(message){
  addToJournal('→ REQ\n'+message);               // log requête brute
  try{
    const res = await fetch('/api/notify',{
      method:'POST',
      headers:{'Content-Type':'text/plain'},     // texte brut (ok Safari)
      body:message
    });
    const txt = await res.text();
    addToJournal('← RESP '+res.status+'\n'+txt); // log réponse serveur
  }catch(err){
    addToJournal('‼︎ ERREUR FETCH\n'+err);
  }
}