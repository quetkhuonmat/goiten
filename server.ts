import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';

interface TeacherLicenseRecord {
  phone: string;
  registeredAt: number;
  usedSpins: number;
  isKeyActive: boolean;
  keyType?: 'unlimited' | '500' | '200' | '100';
  grantedSpins?: number;
  activeKey?: string;
  activatedAt?: number;
  lastActiveAt?: number;
}

const DATA_DIR = path.resolve('data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const LICENSES_FILE = path.join(DATA_DIR, 'licenses.json');

const loadLicenses = (): Map<string, TeacherLicenseRecord> => {
  try {
    if (fs.existsSync(LICENSES_FILE)) {
      const raw = fs.readFileSync(LICENSES_FILE, 'utf-8');
      const list: TeacherLicenseRecord[] = JSON.parse(raw);
      const map = new Map<string, TeacherLicenseRecord>();
      for (const item of list) {
        if (item.phone) map.set(item.phone, item);
      }
      return map;
    }
  } catch (e) {
    console.warn('Error reading licenses file:', e);
  }
  return new Map();
};

const saveLicenses = (map: Map<string, TeacherLicenseRecord>) => {
  try {
    const list = Array.from(map.values());
    fs.writeFileSync(LICENSES_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Error writing licenses file:', e);
  }
};

const SECRET_SALT = 'AIS_KEY_SALT_2026_HAITV_ZALO_0973834541';
const ADMIN_PINS = new Set(['0973834541', 'admin123']);

function computeChecksum(str: string): string {
  let hash1 = 5381;
  let hash2 = 52711;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash1 = (hash1 * 33) ^ char;
    hash2 = (hash2 * 33) ^ char;
  }
  const combined = (Math.abs(hash1) * 31 + Math.abs(hash2)).toString(16).toUpperCase();
  return combined.padStart(6, '0').slice(-6);
}

function generateLicenseKeyServer(phone: string, type: string): string {
  let norm = phone.replace(/\D/g, '');
  if (norm.startsWith('84') && norm.length === 11) norm = '0' + norm.substring(2);
  const typeCode = type === 'unlimited' ? 'UNL' : type;
  const checksum = computeChecksum(`${norm}:${typeCode}:${SECRET_SALT}`);
  return `AI-${norm}-${typeCode}-${checksum}`;
}

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
  const PORT = Number(process.env.PORT) || 3000;

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

  // ==================== TEACHER LICENSE & KEY MANAGEMENT APIS ====================

  // Register or sync teacher phone
  app.post('/api/license/register', (req: Request, res: Response) => {
    let { phone } = req.body;
    if (!phone) {
      res.status(400).json({ error: 'Missing phone number' });
      return;
    }
    phone = phone.replace(/\D/g, '');
    if (phone.startsWith('84') && phone.length === 11) phone = '0' + phone.substring(2);

    const licenses = loadLicenses();
    let record = licenses.get(phone);
    if (!record) {
      record = {
        phone,
        registeredAt: Date.now(),
        usedSpins: 0,
        isKeyActive: false,
        lastActiveAt: Date.now(),
      };
      licenses.set(phone, record);
      saveLicenses(licenses);
    } else {
      record.lastActiveAt = Date.now();
      saveLicenses(licenses);
    }
    res.json(record);
  });

  // Record a spin call
  app.post('/api/license/spin', (req: Request, res: Response) => {
    let { phone, clientUsedSpins } = req.body;
    if (!phone) {
      res.status(400).json({ error: 'Missing phone number' });
      return;
    }
    phone = phone.replace(/\D/g, '');
    if (phone.startsWith('84') && phone.length === 11) phone = '0' + phone.substring(2);

    const licenses = loadLicenses();
    let record = licenses.get(phone);
    if (!record) {
      record = {
        phone,
        registeredAt: Date.now(),
        usedSpins: 1,
        isKeyActive: false,
        lastActiveAt: Date.now(),
      };
    } else {
      const targetSpins = typeof clientUsedSpins === 'number'
        ? Math.max(record.usedSpins + 1, clientUsedSpins)
        : record.usedSpins + 1;
      record.usedSpins = targetSpins;
      record.lastActiveAt = Date.now();
    }
    licenses.set(phone, record);
    saveLicenses(licenses);
    res.json(record);
  });

  // Activate license key
  app.post('/api/license/activate', (req: Request, res: Response) => {
    let { phone, key, keyType, grantedSpins } = req.body;
    if (!phone || !key) {
      res.status(400).json({ error: 'Missing phone or key' });
      return;
    }
    phone = phone.replace(/\D/g, '');
    if (phone.startsWith('84') && phone.length === 11) phone = '0' + phone.substring(2);

    const licenses = loadLicenses();
    let record = licenses.get(phone);
    if (!record) {
      record = {
        phone,
        registeredAt: Date.now(),
        usedSpins: 0,
        isKeyActive: true,
        keyType: keyType || 'unlimited',
        grantedSpins: grantedSpins || undefined,
        activeKey: key,
        activatedAt: Date.now(),
        lastActiveAt: Date.now(),
      };
    } else {
      record.isKeyActive = true;
      record.keyType = keyType || 'unlimited';
      record.grantedSpins = grantedSpins || undefined;
      record.activeKey = key;
      record.activatedAt = Date.now();
      record.lastActiveAt = Date.now();
    }
    licenses.set(phone, record);
    saveLicenses(licenses);
    res.json({ success: true, record });
  });

  // Query license status by phone
  app.get('/api/license/status', (req: Request, res: Response) => {
    let phone = String(req.query.phone || '');
    phone = phone.replace(/\D/g, '');
    if (phone.startsWith('84') && phone.length === 11) phone = '0' + phone.substring(2);

    if (!phone) {
      res.status(400).json({ error: 'Missing phone query parameter' });
      return;
    }

    const licenses = loadLicenses();
    const record = licenses.get(phone) || null;
    res.json({ record });
  });

  // Admin: Get all teachers list with spin counts
  app.post('/api/license/admin/list', (req: Request, res: Response) => {
    const { pin } = req.body;
    if (!pin || !ADMIN_PINS.has(String(pin).trim())) {
      res.status(401).json({ error: 'Mã PIN Admin không đúng' });
      return;
    }
    const licenses = loadLicenses();
    const list = Array.from(licenses.values()).sort((a, b) => (b.lastActiveAt || 0) - (a.lastActiveAt || 0));
    res.json({ success: true, teachers: list, totalCount: list.length });
  });

  // Admin: Issue / Generate Key for a teacher
  app.post('/api/license/admin/generate-key', (req: Request, res: Response) => {
    const { pin, phone, type = 'unlimited' } = req.body;
    if (!pin || !ADMIN_PINS.has(String(pin).trim())) {
      res.status(401).json({ error: 'Mã PIN Admin không đúng' });
      return;
    }
    let norm = String(phone || '').replace(/\D/g, '');
    if (norm.startsWith('84') && norm.length === 11) norm = '0' + norm.substring(2);

    if (!norm || norm.length !== 10) {
      res.status(400).json({ error: 'Số điện thoại không hợp lệ (cần 10 chữ số)' });
      return;
    }

    const key = generateLicenseKeyServer(norm, type);
    const licenses = loadLicenses();
    let record = licenses.get(norm);
    if (!record) {
      record = {
        phone: norm,
        registeredAt: Date.now(),
        usedSpins: 0,
        isKeyActive: true,
        keyType: type as any,
        grantedSpins: type === 'unlimited' ? undefined : Number(type),
        activeKey: key,
        activatedAt: Date.now(),
        lastActiveAt: Date.now(),
      };
    } else {
      record.isKeyActive = true;
      record.keyType = type as any;
      record.grantedSpins = type === 'unlimited' ? undefined : Number(type),
      record.activeKey = key;
      record.activatedAt = Date.now();
      record.lastActiveAt = Date.now();
    }
    licenses.set(norm, record);
    saveLicenses(licenses);

    res.json({
      success: true,
      key,
      teacher: record,
    });
  });

  // Admin: Reset used spins for a teacher
  app.post('/api/license/admin/reset', (req: Request, res: Response) => {
    const { pin, phone } = req.body;
    if (!pin || !ADMIN_PINS.has(String(pin).trim())) {
      res.status(401).json({ error: 'Mã PIN Admin không đúng' });
      return;
    }
    let norm = String(phone || '').replace(/\D/g, '');
    if (norm.startsWith('84') && norm.length === 11) norm = '0' + norm.substring(2);

    const licenses = loadLicenses();
    const record = licenses.get(norm);
    if (record) {
      record.usedSpins = 0;
      record.lastActiveAt = Date.now();
      licenses.set(norm, record);
      saveLicenses(licenses);
    }
    res.json({ success: true, teacher: record });
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
