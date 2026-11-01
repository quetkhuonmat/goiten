import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';

interface RoomEvent {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
}

interface RoomState {
  roomId: string;
  createdAt: number;
  lastActive: number;
  phoneConnected: boolean;
  stage: 'ready' | 'detecting' | 'picking' | 'locked';
  detectedFaces: any[];
  lockedFace: any | null;
  lockedFaceUrl: string | null;
  latestFrame: string | null;
  score: number;
}

const rooms = new Map<string, RoomState>();
const roomClients = new Map<string, Set<Response>>();

const getOrCreateRoom = (roomId: string): RoomState => {
  const normalized = roomId.toUpperCase().trim();
  let room = rooms.get(normalized);
  if (!room) {
    room = {
      roomId: normalized,
      createdAt: Date.now(),
      lastActive: Date.now(),
      phoneConnected: false,
      stage: 'ready',
      detectedFaces: [],
      lockedFace: null,
      lockedFaceUrl: null,
      latestFrame: null,
      score: 0,
    };
    rooms.set(normalized, room);
  }
  room.lastActive = Date.now();
  return room;
};

const broadcastToRoom = (roomId: string, event: RoomEvent) => {
  const normalized = roomId.toUpperCase().trim();
  const clients = roomClients.get(normalized);
  if (clients && clients.size > 0) {
    const data = `data: ${JSON.stringify(event)}\n\n`;
    clients.forEach((client) => {
      try {
        client.write(data);
      } catch {
        clients.delete(client);
      }
    });
  }
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '15mb' }));

  // Health check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', time: Date.now() });
  });

  // Get Room State
  app.get('/api/room/:roomId/state', (req: Request, res: Response) => {
    const room = getOrCreateRoom(req.params.roomId);
    res.json(room);
  });

  // SSE Stream for Room Events
  app.get('/api/room/:roomId/events', (req: Request, res: Response) => {
    const roomId = req.params.roomId.toUpperCase().trim();
    getOrCreateRoom(roomId);

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    res.write(`data: ${JSON.stringify({ type: 'connected', roomId, timestamp: Date.now() })}\n\n`);

    if (!roomClients.has(roomId)) {
      roomClients.set(roomId, new Set());
    }
    const clients = roomClients.get(roomId)!;
    clients.add(res);

    const keepAlive = setInterval(() => {
      res.write(': keep-alive\n\n');
    }, 15000);

    req.on('close', () => {
      clearInterval(keepAlive);
      clients.delete(res);
      if (clients.size === 0) {
        roomClients.delete(roomId);
      }
    });
  });

  // Post Event to Room (e.g., pick-start, pick-stop, lock, faces-updated, phone-connect)
  app.post('/api/room/:roomId/event', (req: Request, res: Response) => {
    const roomId = req.params.roomId.toUpperCase().trim();
    const room = getOrCreateRoom(roomId);
    const { type, payload } = req.body;

    if (!type) {
      res.status(400).json({ error: 'Missing event type' });
      return;
    }

    if (type === 'phone-connected') {
      room.phoneConnected = true;
    } else if (type === 'stage-change') {
      room.stage = payload?.stage || room.stage;
    } else if (type === 'faces-updated') {
      room.detectedFaces = payload?.faces || [];
    } else if (type === 'face-locked') {
      room.stage = 'locked';
      room.lockedFace = payload?.face || null;
      room.lockedFaceUrl = payload?.faceUrl || null;
    } else if (type === 'frame-update') {
      room.latestFrame = payload?.frame || null;
    } else if (type === 'score-update') {
      room.score = payload?.score ?? room.score;
    }

    const event: RoomEvent = {
      id: Math.random().toString(36).substring(2, 9),
      type,
      payload,
      timestamp: Date.now(),
    };

    broadcastToRoom(roomId, event);
    res.json({ success: true, room });
  });

  // Clean stale rooms older than 6 hours
  setInterval(() => {
    const now = Date.now();
    for (const [id, r] of rooms.entries()) {
      if (now - r.lastActive > 6 * 3600 * 1000) {
        rooms.delete(id);
        roomClients.delete(id);
      }
    }
  }, 30 * 60 * 1000);

  // Vite Integration
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static('dist'));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Full-Stack Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
