import { WebSocket, WebSocketServer } from 'ws';
import { wsArcJet } from './arcjet.js';

function sendJson(socket, payload) {
  if (socket.readyState !== WebSocket.OPEN) return;

  socket.send(JSON.stringify(payload));
}

function broadcast(wss, payload) {
  for (const client of wss.clients) {
    if (client.readyState !== WebSocket.OPEN) continue; // skip non-open clients
    client.send(JSON.stringify(payload));
  }
}

export function attachWebSocketServer(server) {
  const wss = new WebSocketServer({
    noServer: true,
    path: '/ws',
    maxPayload: 1024 * 1024,
  });

  server.on('upgrade', async (req, socket, head) => {
    if (wsArcJet) {
      try {
        const decision = await wsArcJet.protect(req);
        if (decision.isDenied()) {
          const code = decision.reason.isRateLimit() ? 429 : 403;
          const message = decision.reason.isRateLimit()
            ? 'Rate limit exceeded'
            : 'Access denied';
          socket.write(
            `HTTP/1.1 ${code} ${message}\r\n` + 'Connection: close\r\n' + '\r\n'
          );
          socket.destroy();
          return;
        }
      } catch (err) {
        console.error('WebSocket ArcJet error:', err);
        socket.write(
          'HTTP/1.1 500 Internal Server Error\r\n' +
            'Connection: close\r\n' +
            '\r\n'
        );
        socket.destroy();
        return;
      }
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (socket, req) => {
    socket.isAlive = true;
    socket.on('pong', () => {
      socket.isAlive = true;
    });
    sendJson(socket, { type: 'welcome' });

    socket.on('error', (err) => console.error('WebSocket error:', err));
  });

  const interval = setInterval(() => {
    wss.clients.forEach((socket) => {
      if (socket.isAlive === false)
        socket.terminate(); // terminate dead connections
      else {
        socket.isAlive = false;
        socket.ping();
      }
    });
  }, 30000);

  wss.on('close', () => clearInterval(interval));

  function broadcastMatchCreated(match) {
    broadcast(wss, { type: 'match_created', data: match });
  }

  return { broadcastMatchCreated };
}
