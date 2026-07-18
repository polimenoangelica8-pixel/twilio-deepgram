const express = require('express');
const expressWs = require('express-ws');
const WebSocket = require('ws');

const app = express();
expressWs(app);
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const PORT = process.env.PORT || 3000;

const DEEPGRAM_WS_URL = 'wss://api.eu.deepgram.com/v1/listen?' + new URLSearchParams({
  model: 'nova-2',
  language: 'it',
  punctuate: 'true',
  encoding: 'mulaw',
  sample_rate: '8000',
  channels: '1',
  interim_results: 'false',
}).toString();

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'twilio-deepgram-eu' });
});

// TwiML: risponde alla chiamata e apre Media Stream
app.post('/incoming-call', (req, res) => {
  const host = req.headers.host;
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://${host}/media-stream" />
  </Connect>
  <Say language="it-IT">Benvenuto in AssoCaf. Parla pure, ti ascolto.</Say>
</Response>`;
  res.type('text/xml');
  res.send(twiml);
});

// WebSocket: riceve audio da Twilio, lo invia a Deepgram EU
app.ws('/media-stream', (twilioWs, req) => {
  console.log('[Twilio] Connessione WebSocket aperta');
  let streamSid = null;
  let callSid = null;

  // Connessione a Deepgram EU
  const dgWs = new WebSocket(DEEPGRAM_WS_URL, {
    headers: { Authorization: `Token ${DEEPGRAM_API_KEY}` }
  });

  dgWs.on('open', () => {
    console.log('[Deepgram EU] Connesso');
  });

  dgWs.on('error', (err) => {
    console.error('[Deepgram] Errore:', err.message);
  });

  // Ricevi trascrizione da Deepgram
  dgWs.on('message', (data) => {
    try {
      const result = JSON.parse(data);
      const transcript = result?.channel?.alternatives?.[0]?.transcript;
      if (transcript && transcript.trim() && result.is_final) {
        console.log(`[Trascrizione] ${transcript}`);
        handleTranscript(transcript, streamSid, callSid);
      }
    } catch (e) {
      console.error('[Deepgram] Parse error:', e.message);
    }
  });

  dgWs.on('close', () => {
    console.log('[Deepgram] Disconnesso');
  });

  // Ricevi messaggi da Twilio
  twilioWs.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);
      switch (data.event) {
        case 'start':
          streamSid = data.start.streamSid;
          callSid = data.start.callSid;
          console.log(`[Twilio] Stream avviato: ${streamSid}`);
          break;
        case 'media':
          if (dgWs.readyState === WebSocket.OPEN) {
            const audioBuffer = Buffer.from(data.media.payload, 'base64');
            dgWs.send(audioBuffer);
          }
          break;
        case 'stop':
          console.log('[Twilio] Stream terminato');
          if (dgWs.readyState === WebSocket.OPEN) dgWs.close();
          break;
      }
    } catch (e) {
      console.error('[Twilio] Parse error:', e.message);
    }
  });

  twilioWs.on('close', () => {
    console.log('[Twilio] WebSocket chiuso');
    if (dgWs.readyState === WebSocket.OPEN) dgWs.close();
  });

  twilioWs.on('error', (err) => {
    console.error('[Twilio] Errore WebSocket:', err.message);
  });
});

// Gestione trascrizione
async function handleTranscript(text, streamSid, callSid) {
  const payload = {
    text,
    streamSid,
    callSid,
    timestamp: new Date().toISOString()
  };

  console.log('[Evento] Trascrizione finale:', JSON.stringify(payload));

  // Slack webhook (opzionale)
  if (process.env.SLACK_WEBHOOK_URL) {
    try {
      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `*AssoCaf - Chiamata in entrata*\n> ${text}`,
          attachments: [{
            color: '#36a64f',
            fields: [
              { title: 'Call SID', value: callSid || 'N/A', short: true },
              { title: 'Orario', value: payload.timestamp, short: true }
            ]
          }]
        })
      });
    } catch (e) {
      console.error('[Slack] Errore invio:', e.message);
    }
  }
}

app.listen(PORT, () => {
  console.log(`[Server] Attivo su porta ${PORT}`);
  console.log(`[Deepgram] Endpoint EU: ${DEEPGRAM_WS_URL.split('?')[0]}`);
});
