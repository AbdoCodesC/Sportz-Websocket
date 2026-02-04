import express from 'express';
import http from 'http';
import { matchRouter } from './routes/matches.js';
import { attachWebSocketServer } from './server.js';
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

app.use('/matches', matchRouter);

const { broadcastMatchCreated } = attachWebSocketServer(server);
app.locals.broadcastMatchCreated = broadcastMatchCreated;

// Start server (HTTP + WebSocket)
server.listen(PORT, HOST, () => {
  const baseUrl =
    HOST === '0.0.0.0' ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;
  console.log(`Server is running at ${baseUrl}`);
  console.log(
    `WebSocket server is running at ${baseUrl.replace('http', 'ws')}/ws`
  );
});
