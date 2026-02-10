import AgentApi from "apminsight"
AgentApi.config();

import express from 'express';
import http from 'http';
import { matchRouter } from './routes/matches.js';
import { commentaryRouter } from './routes/commentary.js';
import { attachWebSocketServer } from './ws/server.js';
import { securityMiddleware } from './arcjet.js';

const PORT = Number(process.env.PORT || 8000);
const HOST = process.env.HOST || '0.0.0.0';

const app = express();
const server = http.createServer(app);

// JSON middleware
app.use(express.json());
// Security middleware
app.use(securityMiddleware());

// Root GET route
app.get('/', (req, res) => {
  res.json({ message: 'Hello from Express server!' });
});

app.get('/healthz', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/matches', matchRouter);
app.use('/matches/commentary', commentaryRouter);

const { broadcastMatchCreated, broadcastCommentary } =
  attachWebSocketServer(server);
app.locals.broadcastMatchCreated = broadcastMatchCreated;
app.locals.broadcastCommentary = broadcastCommentary;

// Start server (HTTP + WebSocket)
server.listen(PORT, HOST, () => {
  const baseUrl =
    HOST === '0.0.0.0' ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;
  console.log(`Server is running at ${baseUrl}`);
  console.log(
    `WebSocket server is running at ${baseUrl.replace('http', 'ws')}/ws`
  );
});
