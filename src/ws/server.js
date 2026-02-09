import { WebSocket, WebSocketServer } from 'ws';
import { wsArcJet } from '../arcjet.js';

const matchSubscribers = new Map(); // matchId -> Set of WebSocket clients

function subscribe(matchId, socket) {
  if (!matchSubscribers.has(matchId)) {
    matchSubscribers.set(matchId, new Set());
  }
  matchSubscribers.get(matchId).add(socket);
}

function unsubscribe(matchId, socket) {
  const subscribers = matchSubscribers.get(matchId);
  if (!subscribers) return;

  subscribers.delete(socket);

  if (subscribers.size === 0) {
    matchSubscribers.delete(matchId);
  }
}

function cleanUpSubscriptions(socket) {
  for (const matchId of socket.subscriptions) {
    unsubscribe(matchId, socket);
  }
}

function sendJson(socket, payload) {
  if (socket.readyState !== WebSocket.OPEN) return;

  socket.send(JSON.stringify(payload));
}

function broadcastToAll(wss, payload) {
  for (const client of wss.clients) {
    if (client.readyState !== WebSocket.OPEN) continue; // skip non-open clients
    client.send(JSON.stringify(payload));
  }
}

function broadcastToMatch(matchId, payload) {
  const subscribers = matchSubscribers.get(matchId);
  if (!subscribers || subscribers.size === 0) return;

  const message = JSON.stringify(payload);

  for (const client of subscribers) {
    if (client.readyState !== WebSocket.OPEN) continue;
    client.send(message);
  }
}

function handleMessage(socket, data) {
  let message;
  try {
    message = JSON.parse(data);
  } catch (err) {
    console.error('Invalid JSON message:', data);
    sendJson(socket, { type: 'error', error: 'Invalid JSON format.' });
    return;
  }

  if (message?.type === 'subscribe' && Number.isInteger(message.matchId) && message.matchId >= 0) {
    subscribe(message.matchId, socket);
    socket.subscriptions.add(message.matchId);
    sendJson(socket, { type: 'subscribed', matchId: message.matchId });
    return;
  }

  if (message?.type === 'unsubscribe' && Number.isInteger(message.matchId) && message.matchId >= 0) {
    unsubscribe(message.matchId, socket);
    socket.subscriptions.delete(message.matchId);
    sendJson(socket, { type: 'unsubscribed', matchId: message.matchId });
    return;
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

    socket.subscriptions = new Set();

    sendJson(socket, { type: 'welcome' });

    socket.on('message', (data) => handleMessage(socket, data));

    socket.on('error', (err) => {
      console.error('WebSocket error:', err);
      socket.terminate();
    });

    socket.on('close', () => {
      cleanUpSubscriptions(socket);
    });
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
    broadcastToAll(wss, { type: 'match_created', data: match });
  }

  function broadcastCommentary(matchId, comment) {
    broadcastToMatch(matchId, { type: 'commentary', data: comment });
  }

  return { broadcastMatchCreated, broadcastCommentary };
}
