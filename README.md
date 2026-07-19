# 🎙️ ASSOCAF Voice Agent

Agente vocale AI **real-time** per ASSOCAF (CAF e Patronato, Reggio Calabria).

Fa da ponte tra **Twilio Media Streams** e la **Deepgram Voice Agent API**, offrendo una conversazione telefonica naturale e fluida (niente pause "Say/Gather": l'utente può interrompere l'assistente mentre parla — *barge-in*).

```
Chiamata telefonica
      ↓
   Twilio  ─(Media Stream, audio mulaw 8kHz)─▶  QUESTO SERVER (WebSocket)  ─▶  Deepgram Voice Agent
      ▲                                                                        (STT + LLM + TTS)
      └──────────────────────(audio della risposta)─────────────────────┘
```

---

## 📁 Struttura

```
assocaf-voice-agent/
├── package.json          # Dipendenze: express, ws, dotenv
├── .env.example          # Template variabili d'ambiente
├── index.js              # Entry point - server HTTP + WebSocket
├── README.md             # Questa guida
└── src/
    ├── config/
    │   ├── dotenv.js              # Carica e valida le variabili ambiente
    │   └── agentSettings.js       # Configurazione Deepgram + prompt ASSOCAF
    ├── routes/
    │   ├── rootRoute.js           # Health check endpoint
    │   └── twilioRoute.js         # TwiML webhook + verifica firma Twilio
    └── websockets/
        └── mediaStreamHandler.js  # Bridge WebSocket Twilio <-> Deepgram
```

---

## 🚀 Setup locale

1. **Installa le dipendenze**
   ```bash
   npm install
   ```

2. **Configura le variabili d'ambiente**
   ```bash
   cp .env.example .env
   ```
   Poi apri `.env` e compila:
   - `DEEPGRAM_API_KEY` — la tua API key Deepgram (obbligatoria)
   - `LLM_API_KEY` + `LLM_ENDPOINT_URL` — il cervello AI (puoi usare il tuo endpoint Abacus o OpenAI)
   - `PUBLIC_URL` — in locale lascialo vuoto (si usa ngrok, vedi sotto)

3. **Avvia il server**
   ```bash
   npm start
   ```
   Il server parte su `http://localhost:8080`.

4. **Esponi il server con ngrok** (per i test locali con Twilio)
   ```bash
   ngrok http 8080
   ```
   Copia l'URL HTTPS generato (es. `https://abcd.ngrok.io`).

---

## ☁️ Deploy su Railway

1. Crea un nuovo progetto su [Railway](https://railway.app) e collega questo repository (oppure fai *Deploy from local*).
2. Railway rileva automaticamente Node.js ed esegue `npm install` + `npm start`.
3. Nella sezione **Variables** aggiungi tutte le variabili del file `.env.example`:
   - `DEEPGRAM_API_KEY`
   - `DEEPGRAM_STT_MODEL` (es. `nova-2`)
   - `DEEPGRAM_TTS_VOICE` (es. `aura-2-nestor-it`)
   - `LLM_ENDPOINT_URL`, `LLM_API_KEY`, `LLM_MODEL`
   - `TWILIO_AUTH_TOKEN` + `VERIFY_TWILIO_SIGNATURE=true`
4. In **Settings > Networking** genera un dominio pubblico (es. `assocaf-voice-agent.up.railway.app`).
5. Imposta la variabile `PUBLIC_URL` con quel dominio (con `https://`).
6. Railway espone già le connessioni WebSocket sullo stesso dominio: nessuna configurazione extra.

---

## ☎️ Configurazione Twilio

1. Vai nella [Twilio Console](https://console.twilio.com) > **Phone Numbers** > il tuo numero.
2. Nella sezione **Voice & Fax > A Call Comes In**:
   - Tipo: **Webhook**
   - URL: `https://<PUBLIC_URL>/twilio/incoming`
   - Metodo: **HTTP POST**
3. Salva. Ora ogni chiamata al numero verrà gestita dall'agente vocale.

> **Callback (chiamata in uscita)**: se usi il sistema "Ti Richiamiamo Noi" del sito, imposta nel parametro `Url` della chiamata Twilio lo stesso endpoint `https://<PUBLIC_URL>/twilio/incoming`.

---

## 🎛️ Voci Deepgram Aura-2 in italiano

Alcune voci disponibili (imposta in `DEEPGRAM_TTS_VOICE`):
- `aura-2-nestor-it` — maschile, professionale
- `aura-2-aurora-it` — femminile, cordiale

Consulta la [documentazione voci Deepgram](https://developers.deepgram.com/docs/tts-models) per l'elenco aggiornato.

---

## 🔍 Debug

- **Health check**: apri `https://<PUBLIC_URL>/` — deve rispondere con lo stato del servizio.
- **Log**: su Railway apri la tab **Deploy Logs** per vedere in tempo reale gli eventi (`[Twilio]`, `[Deepgram]`, `[Conversazione]`).
- **La chiamata cade subito?** Verifica che `PUBLIC_URL` sia corretto e che il dominio Railway sia pubblico.
- **L'agente non parla?** Controlla che `DEEPGRAM_API_KEY` sia valida e che la voce TTS esista.
- **Il cervello AI non risponde?** Verifica `LLM_ENDPOINT_URL` e `LLM_API_KEY`.

---

## 🔒 Sicurezza

- In produzione imposta `VERIFY_TWILIO_SIGNATURE=true` e fornisci `TWILIO_AUTH_TOKEN`: le richieste webhook verranno validate tramite firma HMAC.
- Non committare mai il file `.env` (già escluso in `.gitignore`).

---

*Realizzato per ASSOCAF — Via Sbarre Centrali 250B, Reggio Calabria — 0965 189 0553*
