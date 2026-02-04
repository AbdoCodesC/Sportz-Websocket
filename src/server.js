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
    server,
    path: '/ws',
    maxPayload: 1024 * 1024,
  });
  wss.on('connection', async (socket, req) => {
    if (wsArcJet) {
      try {
        const decision = await wsArcJet.protect(req);
        if (decision.isDenied()) {
          const code = decision.reason.isRateLimit() ? 1013 : 1008; // 1013: Try Again Later, 1008: Policy Violation
          const reason = decision.reason.isRateLimit()
            ? 'Rate limit exceeded'
            : 'Access denied';
          socket.close(code, reason);
          return;
        }
      } catch (err) {
        console.error('WebSocket ArcJet error:', err);
        socket.close(1011, 'Server security error');
        return;
      }
    }
    socket.isAlive = true;
    socket.on('pong', () => {
      socket.isAlive = true; // heartbeat to detect dead connections
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
