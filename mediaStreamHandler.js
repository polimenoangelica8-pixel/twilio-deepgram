import WebSocket from 'ws';
import { config } from '../config/dotenv.js';
import { buildAgentSettings } from '../config/agentSettings.js';

/**
 * Gestisce una singola connessione Media Stream di Twilio.
 * Fa da ponte bidirezionale:
 *   Twilio (audio mulaw 8kHz)  <->  Deepgram Voice Agent (STT + LLM + TTS)
 *
 * @param {WebSocket} twilioWs - WebSocket verso Twilio Media Streams
 */
export function handleMediaStream(twilioWs) {
  let streamSid = null;
  let callSid = null;
  let deepgramReady = false;
  const audioQueue = []; // buffer audio in attesa che Deepgram sia pronto

  console.log('[MediaStream] Nuova connessione Twilio');

  // --- Connessione a Deepgram Voice Agent ---
  const deepgramWs = new WebSocket(config.deepgram.agentUrl, {
    headers: {
      Authorization: `Token ${config.deepgram.apiKey}`,
    },
  });

  // Invia keep-alive periodici a Deepgram per non far cadere la connessione
  let keepAlive = null;

  deepgramWs.on('open', () => {
    console.log('[Deepgram] Connesso, invio configurazione agente');
    deepgramWs.send(JSON.stringify(buildAgentSettings()));

    keepAlive = setInterval(() => {
      if (deepgramWs.readyState === WebSocket.OPEN) {
        deepgramWs.send(JSON.stringify({ type: 'KeepAlive' }));
      }
    }, 8000);
  });

  deepgramWs.on('message', (data, isBinary) => {
    if (isBinary) {
      // Audio TTS generato dall'agente -> inoltra a Twilio come media
      if (streamSid) {
        const payload = Buffer.from(data).toString('base64');
        twilioWs.send(
          JSON.stringify({
            event: 'media',
            streamSid,
            media: { payload },
          })
        );
      }
      return;
    }

    // Messaggi di controllo JSON da Deepgram
    try {
      const msg = JSON.parse(data.toString());
      switch (msg.type) {
        case 'Welcome':
          console.log('[Deepgram] Welcome ricevuto');
          break;
        case 'SettingsApplied':
          deepgramReady = true;
          console.log('[Deepgram] Configurazione applicata, agente pronto');
          // Svuota il buffer audio accumulato
          while (audioQueue.length > 0) {
            const chunk = audioQueue.shift();
            if (deepgramWs.readyState === WebSocket.OPEN) deepgramWs.send(chunk);
          }
          break;
        case 'UserStartedSpeaking':
          // L'utente ha iniziato a parlare: interrompi l'audio in riproduzione (barge-in)
          if (streamSid) {
            twilioWs.send(JSON.stringify({ event: 'clear', streamSid }));
          }
          break;
        case 'ConversationText':
          console.log(`[Conversazione] ${msg.role}: ${msg.content}`);
          break;
        case 'AgentAudioDone':
          break;
        case 'Error':
          console.error('[Deepgram] Errore:', JSON.stringify(msg));
          break;
        default:
          // altri eventi informativi
          break;
      }
    } catch (e) {
      console.error('[Deepgram] Messaggio non-JSON non gestito:', e.message);
    }
  });

  deepgramWs.on('close', (code, reason) => {
    console.log(`[Deepgram] Connessione chiusa (${code}) ${reason || ''}`);
    if (keepAlive) clearInterval(keepAlive);
    if (twilioWs.readyState === WebSocket.OPEN) twilioWs.close();
  });

  deepgramWs.on('error', (err) => {
    console.error('[Deepgram] Errore WebSocket:', err.message);
  });

  // --- Messaggi da Twilio ---
  twilioWs.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    switch (msg.event) {
      case 'connected':
        console.log('[Twilio] Media stream connesso');
        break;

      case 'start':
        streamSid = msg.start.streamSid;
        callSid = msg.start.callSid;
        console.log(`[Twilio] Stream avviato — streamSid: ${streamSid}, callSid: ${callSid}`);
        break;

      case 'media': {
        // Audio dall'utente (mulaw base64) -> a Deepgram (binario)
        const audio = Buffer.from(msg.media.payload, 'base64');
        if (deepgramReady && deepgramWs.readyState === WebSocket.OPEN) {
          deepgramWs.send(audio);
        } else {
          audioQueue.push(audio); // accoda finché l'agente non è pronto
        }
        break;
      }

      case 'stop':
        console.log(`[Twilio] Stream terminato — callSid: ${callSid}`);
        if (deepgramWs.readyState === WebSocket.OPEN) deepgramWs.close();
        break;

      default:
        break;
    }
  });

  twilioWs.on('close', () => {
    console.log('[Twilio] Connessione chiusa');
    if (keepAlive) clearInterval(keepAlive);
    if (deepgramWs.readyState === WebSocket.OPEN) deepgramWs.close();
  });

  twilioWs.on('error', (err) => {
    console.error('[Twilio] Errore WebSocket:', err.message);
  });
}
