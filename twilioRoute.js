import express from 'express';
import crypto from 'crypto';
import { config } from '../config/dotenv.js';

const router = express.Router();

/**
 * Verifica la firma X-Twilio-Signature per assicurarsi che la richiesta
 * provenga davvero da Twilio.
 * Documentazione: https://www.twilio.com/docs/usage/webhooks/webhooks-security
 */
function isValidTwilioSignature(req, fullUrl) {
  if (!config.twilio.verifySignature) return true; // disabilitata
  const authToken = config.twilio.authToken;
  if (!authToken) return true; // nessun token: skip

  const twilioSignature = req.header('X-Twilio-Signature');
  if (!twilioSignature) return false;

  // Ordina i parametri POST per chiave e concatenali all'URL
  const params = req.body || {};
  const sortedKeys = Object.keys(params).sort();
  let data = fullUrl;
  for (const key of sortedKeys) {
    data += key + params[key];
  }

  const expected = crypto
    .createHmac('sha1', authToken)
    .update(Buffer.from(data, 'utf-8'))
    .digest('base64');

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(twilioSignature));
  } catch {
    return false;
  }
}

/**
 * Determina l'host pubblico (per costruire l'URL wss:// del media stream).
 */
function getPublicHost(req) {
  if (config.publicUrl) {
    return config.publicUrl.replace(/^https?:\/\//, '');
  }
  // Fallback: header della richiesta (Railway inoltra x-forwarded-host)
  return req.header('x-forwarded-host') || req.header('host');
}

/**
 * Genera il TwiML che avvia il Media Stream bidirezionale verso il nostro WebSocket.
 * <Connect><Stream> apre uno stream audio full-duplex.
 */
function buildStreamTwiml(host) {
  const wsUrl = `wss://${host}/media-stream`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl}" />
  </Connect>
</Response>`;
}

/**
 * POST /twilio/incoming  e  GET /twilio/incoming
 * Endpoint webhook che Twilio chiama quando una chiamata entra (o viene avviata).
 * Restituisce TwiML che collega la chiamata al nostro agente vocale.
 */
function handleIncoming(req, res) {
  const host = getPublicHost(req);
  const fullUrl = `https://${host}${req.originalUrl}`;

  if (req.method === 'POST' && !isValidTwilioSignature(req, fullUrl)) {
    console.warn('[Twilio] Firma non valida, richiesta rifiutata');
    return res.status(403).send('Forbidden');
  }

  const callSid = (req.body && req.body.CallSid) || 'unknown';
  const from = (req.body && req.body.From) || 'unknown';
  console.log(`[Twilio] Chiamata in arrivo — CallSid: ${callSid}, From: ${from}, host: ${host}`);

  const twiml = buildStreamTwiml(host);
  res.set('Content-Type', 'text/xml; charset=utf-8');
  res.status(200).send(twiml);
}

router.post('/incoming', handleIncoming);
router.get('/incoming', handleIncoming);

export default router;
