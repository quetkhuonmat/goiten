import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';

interface TeacherLicenseRecord {
  phone: string;
  name?: string;
  registeredAt: number;
  usedSpins: number;
  isKeyActive: boolean;
  status: 'approved' | 'pending' | 'rejected';
  keyType?: 'unlimited' | '500' | '200' | '100';
  grantedSpins?: number;
  activeKey?: string;
  activatedAt?: number;
  lastActiveAt?: number;
  approvedAt?: number;
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
        if (item.phone) {
          // Default existing records to approved if not set
          if (!item.status) {
            item.status = 'approved';
          }
          map.set(item.phone, item);
        }
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
    let { phone, name } = req.body;
    if (!phone) {
      res.status(400).json({ error: 'Missing phone number' });
      return;
    }
    phone = phone.replace(/\D/g, '');
    if (phone.startsWith('84') && phone.length === 11) phone = '0' + phone.substring(2);

    // Prevent anyone from registering admin's phone number as a teacher account
    if (phone === '0973834541') {
      res.status(403).json({
        error: 'Số điện thoại này thuộc Ban Quản Trị hệ thống. Giáo viên không thể sử dụng số này để đăng ký. Quản trị viên vui lòng quét mã QR riêng biệt.',
        isAdminPhone: true,
      });
      return;
    }

    const licenses = loadLicenses();
    let record = licenses.get(phone);
    if (!record) {
      // New phone registration -> Starts as PENDING approval!
      record = {
        phone,
        name: name || undefined,
        registeredAt: Date.now(),
        usedSpins: 0,
        isKeyActive: false,
        status: 'pending',
        lastActiveAt: Date.now(),
      };
      licenses.set(phone, record);
      saveLicenses(licenses);

      res.json({
        success: false,
        isPending: true,
        message: 'Đăng ký thành công! Số điện thoại đang chờ Ban Quản Trị phê duyệt trước khi sử dụng.',
        record,
      });
      return;
    }

    // Existing record: update activity time
    record.lastActiveAt = Date.now();
    saveLicenses(licenses);

    if (record.status === 'pending') {
      res.json({
        success: false,
        isPending: true,
        message: 'Số điện thoại này đang chờ Ban Quản Trị phê duyệt trước khi sử dụng.',
        record,
      });
      return;
    }

    if (record.status === 'rejected') {
      res.status(403).json({
        error: 'Số điện thoại này đã bị từ chối hoặc tạm ngưng. Vui lòng liên hệ Admin qua Zalo 0973834541.',
        record,
      });
      return;
    }

    // Status is 'approved'
    res.json({
      success: true,
      isPending: false,
      record,
    });
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
    if (!record || record.status !== 'approved') {
      res.status(403).json({ error: 'Tài khoản chưa được Ban Quản Trị phê duyệt' });
      return;
    }

    const targetSpins = typeof clientUsedSpins === 'number'
      ? Math.max(record.usedSpins + 1, clientUsedSpins)
      : record.usedSpins + 1;
    record.usedSpins = targetSpins;
    record.lastActiveAt = Date.now();

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
        status: 'approved',
        keyType: keyType || 'unlimited',
        grantedSpins: grantedSpins || undefined,
        activeKey: key,
        activatedAt: Date.now(),
        lastActiveAt: Date.now(),
      };
    } else {
      record.isKeyActive = true;
      record.status = 'approved';
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
    res.json({
      record,
      isApproved: record ? record.status === 'approved' : false,
      isPending: record ? record.status === 'pending' : false,
    });
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

  // Admin: Approve a pending teacher
  app.post('/api/license/admin/approve', (req: Request, res: Response) => {
    const { pin, phone } = req.body;
    if (!pin || !ADMIN_PINS.has(String(pin).trim())) {
      res.status(401).json({ error: 'Mã PIN Admin không đúng' });
      return;
    }
    let norm = String(phone || '').replace(/\D/g, '');
    if (norm.startsWith('84') && norm.length === 11) norm = '0' + norm.substring(2);

    const licenses = loadLicenses();
    let record = licenses.get(norm);
    if (!record) {
      record = {
        phone: norm,
        registeredAt: Date.now(),
        usedSpins: 0,
        isKeyActive: false,
        status: 'approved',
        approvedAt: Date.now(),
        lastActiveAt: Date.now(),
      };
    } else {
      record.status = 'approved';
      record.approvedAt = Date.now();
      record.lastActiveAt = Date.now();
    }
    licenses.set(norm, record);
    saveLicenses(licenses);
    res.json({ success: true, teacher: record });
  });

  // Admin: Reject a teacher
  app.post('/api/license/admin/reject', (req: Request, res: Response) => {
    const { pin, phone } = req.body;
    if (!pin || !ADMIN_PINS.has(String(pin).trim())) {
      res.status(401).json({ error: 'Mã PIN Admin không đúng' });
      return;
    }
    let norm = String(phone || '').replace(/\D/g, '');
    if (norm.startsWith('84') && norm.length === 11) norm = '0' + norm.substring(2);

    const licenses = loadLicenses();
    let record = licenses.get(norm);
    if (record) {
      record.status = 'rejected';
      record.lastActiveAt = Date.now();
      licenses.set(norm, record);
      saveLicenses(licenses);
    }
    res.json({ success: true, teacher: record });
  });

  // Admin: Delete a teacher
  app.post('/api/license/admin/delete', (req: Request, res: Response) => {
    const { pin, phone } = req.body;
    if (!pin || !ADMIN_PINS.has(String(pin).trim())) {
      res.status(401).json({ error: 'Mã PIN Admin không đúng' });
      return;
    }
    let norm = String(phone || '').replace(/\D/g, '');
    if (norm.startsWith('84') && norm.length === 11) norm = '0' + norm.substring(2);

    const licenses = loadLicenses();
    licenses.delete(norm);
    saveLicenses(licenses);
    res.json({ success: true, deleted: norm });
  });

  // Admin: Import Whitelist of Phone Numbers (From Excel / CSV / Batch list)
  app.post('/api/license/admin/import-whitelist', (req: Request, res: Response) => {
    const { pin, phones, keyType } = req.body;
    if (!pin || !ADMIN_PINS.has(String(pin).trim())) {
      res.status(401).json({ error: 'Mã PIN Admin không đúng' });
      return;
    }
    if (!Array.isArray(phones) || phones.length === 0) {
      res.status(400).json({ error: 'Danh sách số điện thoại rỗng' });
      return;
    }

    const licenses = loadLicenses();
    let count = 0;

    for (const raw of phones) {
      let norm = String(raw || '').replace(/\D/g, '');
      if (norm.startsWith('84') && norm.length === 11) norm = '0' + norm.substring(2);
      if (!/^0[3|5|7|8|9]\d{8}$/.test(norm)) continue;
      if (norm === '0973834541') continue;

      let record = licenses.get(norm);
      if (!record) {
        record = {
          phone: norm,
          registeredAt: Date.now(),
          usedSpins: 0,
          isKeyActive: false,
          status: 'approved',
          approvedAt: Date.now(),
          lastActiveAt: Date.now(),
        };
      } else {
        record.status = 'approved';
        record.approvedAt = Date.now();
        record.lastActiveAt = Date.now();
      }

      if (keyType && (keyType === 'unlimited' || keyType === '500' || keyType === '200' || keyType === '100')) {
        const key = generateLicenseKeyServer(norm, keyType);
        record.isKeyActive = true;
        record.keyType = keyType as any;
        record.grantedSpins = keyType === 'unlimited' ? undefined : Number(keyType);
        record.activeKey = key;
        record.activatedAt = Date.now();
      }

      licenses.set(norm, record);
      count++;
    }

    saveLicenses(licenses);
    const list = Array.from(licenses.values()).sort((a, b) => (b.lastActiveAt || 0) - (a.lastActiveAt || 0));
    res.json({ success: true, count, teachers: list });
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
        status: 'approved',
        keyType: type as any,
        grantedSpins: type === 'unlimited' ? undefined : Number(type),
        activeKey: key,
        activatedAt: Date.now(),
        lastActiveAt: Date.now(),
      };
    } else {
      record.isKeyActive = true;
      record.status = 'approved';
      record.keyType = type as any;
      record.grantedSpins = type === 'unlimited' ? undefined : Number(type);
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

  // ================= QR ZALO AUTHENTICATION SESSIONS =================
  interface QrAuthSession {
    sessionId: string;
    phone: string;
    role: 'teacher' | 'admin';
    createdAt: number;
    status: 'waiting' | 'confirmed' | 'expired';
    confirmedAt?: number;
  }

  const qrAuthSessions = new Map<string, QrAuthSession>();
  const qrSessionListeners = new Map<string, Set<Response>>();

  // Create QR Login Session (Teacher or Admin)
  app.post('/api/auth/qr-create', (req: Request, res: Response) => {
    let { phone, role = 'teacher' } = req.body;
    let norm = String(phone || '').replace(/\D/g, '');
    if (norm.startsWith('84') && norm.length === 11) norm = '0' + norm.substring(2);

    if (role === 'admin') {
      norm = '0973834541';
    } else {
      const licenses = loadLicenses();
      const record = licenses.get(norm);
      if (!record || record.status !== 'approved') {
        res.status(403).json({ error: 'Số điện thoại này chưa được Ban Quản Trị phê duyệt' });
        return;
      }
    }

    const sessionId = 'AUTH_' + Math.random().toString(36).substring(2, 9).toUpperCase() + '_' + Date.now();
    const session: QrAuthSession = {
      sessionId,
      phone: norm,
      role: role as 'teacher' | 'admin',
      createdAt: Date.now(),
      status: 'waiting',
    };
    qrAuthSessions.set(sessionId, session);

    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
    const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
    const origin = String(req.body.origin || `${proto}://${host}`).replace(/\/$/, '');
    const scanUrl = `${origin}/api/auth/scan-${session.role}?s=${sessionId}`;

    res.json({
      success: true,
      sessionId,
      phone: norm,
      role: session.role,
      scanUrl,
      createdAt: session.createdAt,
      expiresInSeconds: 600,
    });
  });

  // Poll QR Login Session
  app.get('/api/auth/qr-poll', (req: Request, res: Response) => {
    const sessionId = String(req.query.sessionId || '');
    const session = qrAuthSessions.get(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Phiên đăng nhập không tồn tại hoặc đã hết hạn' });
      return;
    }

    if (session.status === 'confirmed') {
      const licenses = loadLicenses();
      const record = licenses.get(session.phone);
      res.json({
        status: 'confirmed',
        role: session.role,
        phone: session.phone,
        confirmedAt: session.confirmedAt,
        license: record || null,
        isAdmin: session.role === 'admin',
      });
      return;
    }

    res.json({
      status: session.status,
      role: session.role,
      phone: session.phone,
    });
  });

  // Confirm QR Login Session (called from phone / Zalo browser)
  app.post('/api/auth/qr-confirm', (req: Request, res: Response) => {
    const { sessionId } = req.body;
    const session = qrAuthSessions.get(String(sessionId || ''));
    if (!session) {
      res.status(404).json({ error: 'Phiên xác thực không tồn tại hoặc đã hết hạn' });
      return;
    }

    session.status = 'confirmed';
    session.confirmedAt = Date.now();

    // Update teacher active timestamp
    if (session.role === 'teacher') {
      const licenses = loadLicenses();
      const record = licenses.get(session.phone);
      if (record) {
        record.lastActiveAt = Date.now();
        licenses.set(session.phone, record);
        saveLicenses(licenses);
      }
    }

    // Notify connected SSE stream
    const listeners = qrSessionListeners.get(session.sessionId);
    if (listeners && listeners.size > 0) {
      const data = `data: ${JSON.stringify({
        type: 'confirmed',
        sessionId: session.sessionId,
        phone: session.phone,
        role: session.role,
      })}\n\n`;
      listeners.forEach((client) => {
        try { client.write(data); } catch {}
      });
    }

    res.json({
      success: true,
      message: 'Xác nhận đăng nhập thành công',
      phone: session.phone,
      role: session.role,
    });
  });

  // Direct Scan for Admin from Phone / Zalo
  app.get('/api/auth/scan-admin', (req: Request, res: Response) => {
    const sessionId = String(req.query.s || '');
    const session = qrAuthSessions.get(sessionId);
    if (!session || session.role !== 'admin') {
      res.status(404).send(`
        <!DOCTYPE html>
        <html lang="vi">
        <head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Hết hạn</title></head>
        <body style="font-family:sans-serif;text-align:center;padding:40px;background:#090d16;color:#fff;">
          <h2 style="color:#ef4444;">Mã QR đã hết hạn</h2>
          <p style="color:#94a3b8;">Vui lòng mở lại màn hình máy tính để quét mã mới.</p>
        </body>
        </html>
      `);
      return;
    }

    session.status = 'confirmed';
    session.confirmedAt = Date.now();

    // Broadcast SSE to computer screen
    const listeners = qrSessionListeners.get(session.sessionId);
    if (listeners && listeners.size > 0) {
      const data = `data: ${JSON.stringify({
        type: 'confirmed',
        sessionId: session.sessionId,
        phone: session.phone,
        role: session.role,
      })}\n\n`;
      listeners.forEach((client) => {
        try { client.write(data); } catch {}
      });
    }

    res.send(`
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Đăng nhập Admin Thành Công</title>
        <style>
          body {
            margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #090d16; color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 85vh; text-align: center;
          }
          .card {
            background: #0f172a; border: 2px solid #10b981; border-radius: 24px; padding: 36px 20px; max-width: 380px; width: 100%; box-shadow: 0 0 50px rgba(16,185,129,0.3);
          }
          .icon {
            width: 70px; height: 70px; background: rgba(16,185,129,0.18); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 36px; color: #10b981;
          }
          h2 { font-size: 20px; margin: 0 0 10px; color: #10b981; font-weight: 800; }
          p { font-size: 14px; color: #cbd5e1; margin: 6px 0 16px; line-height: 1.5; }
          .phone { font-family: monospace; font-size: 17px; font-weight: bold; color: #fbbf24; }
          .btn {
            display: inline-block; padding: 12px 24px; background: #0284c7; color: #fff; text-decoration: none; border-radius: 12px; font-size: 13px; font-weight: 600; margin-top: 14px;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">✓</div>
          <h2>XÁC THỰC ADMIN THÀNH CÔNG!</h2>
          <p>Đã xác nhận quét mã QR Zalo Quản trị viên số <span class="phone">0973834541</span>.</p>
          <p style="color:#94a3b8; font-size: 13px;">Màn hình máy tính đã được mở khóa Bảng Quản Trị ngay lập tức! Bạn có thể đóng trang này.</p>
          <a class="btn" href="https://zalo.me/0973834541">Mở Zalo 0973834541</a>
        </div>
      </body>
      </html>
    `);
  });

  // Direct Scan for Teacher from Phone / Zalo
  app.get('/api/auth/scan-teacher', (req: Request, res: Response) => {
    const sessionId = String(req.query.s || '');
    const session = qrAuthSessions.get(sessionId);
    if (!session || session.role !== 'teacher') {
      res.status(404).send(`
        <!DOCTYPE html>
        <html lang="vi">
        <head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Hết hạn</title></head>
        <body style="font-family:sans-serif;text-align:center;padding:40px;background:#090d16;color:#fff;">
          <h2 style="color:#ef4444;">Mã QR đã hết hạn</h2>
          <p style="color:#94a3b8;">Vui lòng mở lại màn hình máy tính để quét mã mới.</p>
        </body>
        </html>
      `);
      return;
    }

    session.status = 'confirmed';
    session.confirmedAt = Date.now();

    const licenses = loadLicenses();
    const record = licenses.get(session.phone);
    if (record) {
      record.lastActiveAt = Date.now();
      licenses.set(session.phone, record);
      saveLicenses(licenses);
    }

    // Broadcast SSE to computer screen
    const listeners = qrSessionListeners.get(session.sessionId);
    if (listeners && listeners.size > 0) {
      const data = `data: ${JSON.stringify({
        type: 'confirmed',
        sessionId: session.sessionId,
        phone: session.phone,
        role: session.role,
      })}\n\n`;
      listeners.forEach((client) => {
        try { client.write(data); } catch {}
      });
    }

    res.send(`
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Đăng nhập Giáo Viên Thành Công</title>
        <style>
          body {
            margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #090d16; color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 85vh; text-align: center;
          }
          .card {
            background: #0f172a; border: 2px solid #06b6d4; border-radius: 24px; padding: 36px 20px; max-width: 380px; width: 100%; box-shadow: 0 0 50px rgba(6,182,212,0.3);
          }
          .icon {
            width: 70px; height: 70px; background: rgba(6,182,212,0.18); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 36px; color: #06b6d4;
          }
          h2 { font-size: 20px; margin: 0 0 10px; color: #06b6d4; font-weight: 800; }
          p { font-size: 14px; color: #cbd5e1; margin: 6px 0 16px; line-height: 1.5; }
          .phone { font-family: monospace; font-size: 17px; font-weight: bold; color: #38bdf8; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">✓</div>
          <h2>XÁC THỰC GIÁO VIÊN THÀNH CÔNG!</h2>
          <p>Tài khoản số <span class="phone">${session.phone}</span> đã được xác thực qua Zalo.</p>
          <p style="color:#94a3b8; font-size: 13px;">Màn hình máy tính lớp học đã mở. Thầy/Cô có thể đóng trang này và bắt đầu giờ dạy!</p>
        </div>
      </body>
      </html>
    `);
  });

  // SSE Stream for Instant Real-Time Login
  app.get('/api/auth/qr-stream/:sessionId', (req: Request, res: Response) => {
    const sessionId = req.params.sessionId;
    const session = qrAuthSessions.get(sessionId);
    if (!session) {
      res.status(404).end();
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    if (!qrSessionListeners.has(sessionId)) {
      qrSessionListeners.set(sessionId, new Set());
    }
    const listeners = qrSessionListeners.get(sessionId)!;
    listeners.add(res);

    if (session.status === 'confirmed') {
      res.write(`data: ${JSON.stringify({ type: 'confirmed', sessionId, phone: session.phone, role: session.role })}\n\n`);
    }

    req.on('close', () => {
      listeners.delete(res);
    });
  });

  // Clean stale rooms and QR sessions older than 6 hours
  setInterval(() => {
    const now = Date.now();
    for (const [id, s] of qrAuthSessions.entries()) {
      if (now - s.createdAt > 15 * 60 * 1000) {
        qrAuthSessions.delete(id);
        qrSessionListeners.delete(id);
      }
    }
    for (const [id, r] of rooms.entries()) {
      if (now - r.lastActive > 6 * 3600 * 1000) {
        rooms.delete(id);
        roomClients.delete(id);
      }
    }
  }, 5 * 60 * 1000);

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
