import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';

import { config, validateConfig } from './src/config/dotenv.js';
import rootRoute from './src/routes/rootRoute.js';
import twilioRoute from './src/routes/twilioRoute.js';
import { handleMediaStream } from './src/websockets/mediaStreamHandler.js';

// Verifica variabili d'ambiente obbligatorie
validateConfig();

const app = express();

// Twilio invia i webhook come application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Rotte HTTP
app.use('/', rootRoute);
app.use('/twilio', twilioRoute);

// Server HTTP condiviso per Express + WebSocket
const server = http.createServer(app);

// WebSocket server sul path /media-stream (Twilio Media Streams)
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const { url } = request;
  if (url && url.startsWith('/media-stream')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

wss.on('connection', (ws) => {
  handleMediaStream(ws);
});

server.listen(config.port, () => {
  console.log('\n🎙️  ASSOCAF Voice Agent avviato');
  console.log(`   Porta: ${config.port}`);
  console.log(`   Health check: http://localhost:${config.port}/`);
  console.log(`   Twilio webhook: /twilio/incoming`);
  console.log(`   Media stream WS: /media-stream`);
  if (config.publicUrl) {
    console.log(`   URL pubblico: ${config.publicUrl}`);
  }
  console.log('');
});
