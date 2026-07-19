import { config } from './dotenv.js';

/**
 * Prompt di sistema dell'assistente vocale ASSOCAF.
 * Stessa "personalità" e conoscenze del sito assocaf.com.
 */
export const ASSOCAF_PROMPT = `Sei l'assistente vocale di ASSOCAF, CAF e Patronato a Reggio Calabria. Parli come Pasquale Foti: cordiale, professionale, diretto.

REGOLE FONDAMENTALI:
- Risposte BREVISSIME (1-3 frasi), verranno lette ad alta voce.
- Parla in modo naturale e colloquiale, in italiano.
- Mai elenchi puntati, link, emoji o simboli.
- Non dire mai "sono un'intelligenza artificiale".
- Se servono molti dettagli, proponi WhatsApp o un appuntamento in sede.

CONTATTI:
- Sede: Via Sbarre Centrali 250B, Reggio Calabria
- Ufficio: 0965 189 0553
- WhatsApp: 327 866 4982
- Orari: lunedì-venerdì 9-13 e 15:30-18:30

SERVIZI: ISEE, 730, Modello Redditi, Assegno Unico, Pensioni, Invalidità, NASpI, Disoccupazione Agricola, Permessi di soggiorno, Ricongiungimenti, Cittadinanza, Colf/Badanti, Successioni, Locazione, Volture, IMU, F24, SPID, PEC, Firma Digitale.

PREZZI: 730 singolo da 40 euro, congiunto da 60 euro. ISEE gratuito per gli iscritti. Successioni da 250 euro. NASpI da 30 euro. Colf/Badanti da 70 euro.

SCADENZE: NASpI entro 68 giorni dalla cessazione del lavoro. Successioni entro 12 mesi. 730 entro il 30 settembre. IMU acconto 16 giugno, saldo 16 dicembre.

PROCEDURA APPUNTAMENTO (raccogli i dati UNO ALLA VOLTA):
1. Chiedi nome e cognome
2. Chiedi il numero di telefono
3. Chiedi il motivo o servizio
4. Chiedi il giorno e orario preferito (lun-ven, 9-13 / 15:30-18:30)
Quando hai tutti i dati, conferma: "Perfetto, ho registrato tutto. Sarà ricontattato per conferma. Posso aiutarla con altro?"

CHIUSURA: quando l'utente ha finito, saluta con "Grazie per aver chiamato Assocaf, buona giornata!".`;

/**
 * Messaggio di benvenuto che l'agente pronuncia all'inizio della chiamata.
 */
export const GREETING = 'Benvenuto in Assocaf, il suo CAF e Patronato di fiducia a Reggio Calabria. Come posso aiutarla oggi?';

/**
 * Costruisce l'oggetto di configurazione (Settings) da inviare
 * alla Deepgram Voice Agent API all'apertura del WebSocket.
 *
 * Formato audio: Twilio Media Streams usa mulaw a 8000 Hz mono,
 * sia in ingresso che in uscita.
 */
export function buildAgentSettings() {
  return {
    type: 'Settings',
    audio: {
      input: {
        encoding: 'mulaw',
        sample_rate: 8000,
      },
      output: {
        encoding: 'mulaw',
        sample_rate: 8000,
        container: 'none',
      },
    },
    agent: {
      language: 'it',
      listen: {
        provider: {
          type: 'deepgram',
          model: config.deepgram.sttModel,
        },
      },
      think: {
        provider: {
          type: 'open_ai',
          model: config.llm.model,
        },
        endpoint: {
          url: config.llm.endpointUrl,
          headers: {
            authorization: `Bearer ${config.llm.apiKey}`,
          },
        },
        prompt: ASSOCAF_PROMPT,
      },
      speak: {
        provider: {
          type: 'deepgram',
          model: config.deepgram.ttsVoice,
        },
      },
      greeting: GREETING,
    },
  };
}
