import dotenv from 'dotenv';

// Carica le variabili d'ambiente dal file .env (se presente)
dotenv.config();

/**
 * Configurazione centralizzata letta dalle variabili d'ambiente.
 * Valori di default sensati per lo sviluppo locale.
 */
export const config = {
  port: process.env.PORT || 8080,
  publicUrl: (process.env.PUBLIC_URL || '').replace(/\/$/, ''),

  deepgram: {
    apiKey: process.env.DEEPGRAM_API_KEY || '',
    sttModel: process.env.DEEPGRAM_STT_MODEL || 'nova-2',
    ttsVoice: process.env.DEEPGRAM_TTS_VOICE || 'aura-2-nestor-it',
    agentUrl: 'wss://agent.deepgram.com/v1/agent/converse',
  },

  llm: {
    endpointUrl: process.env.LLM_ENDPOINT_URL || 'https://api.openai.com/v1/chat/completions',
    apiKey: process.env.LLM_API_KEY || '',
    model: process.env.LLM_MODEL || 'gpt-4o-mini',
  },

  twilio: {
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    verifySignature: String(process.env.VERIFY_TWILIO_SIGNATURE || 'false').toLowerCase() === 'true',
  },
};

/**
 * Verifica che le variabili obbligatorie siano presenti.
 * Termina il processo se manca qualcosa di critico.
 */
export function validateConfig() {
  const missing = [];
  if (!config.deepgram.apiKey) missing.push('DEEPGRAM_API_KEY');
  if (!config.llm.apiKey) missing.push('LLM_API_KEY');

  if (missing.length > 0) {
    console.error(`\n❌ Variabili d'ambiente mancanti: ${missing.join(', ')}`);
    console.error('   Copia .env.example in .env e compila i valori.\n');
    process.exit(1);
  }

  if (!config.publicUrl) {
    console.warn('\n⚠️  PUBLIC_URL non impostato. Il TwiML userà l\'host della richiesta come fallback.');
    console.warn('   In produzione imposta PUBLIC_URL al dominio Railway.\n');
  }
}
