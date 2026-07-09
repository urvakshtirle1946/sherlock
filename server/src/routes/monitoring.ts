import { Router, Request, Response } from 'express';
import MonitoringEvent, { MonitoringEventType } from '../models/MonitoringEvent';
import { Server as SocketServer } from 'socket.io';

const router = Router();

// Validate session ID parameter format to prevent MongoDB CastError
router.param('id', (req, res, next, id) => {
  if (!/^[0-9a-fA-F]{24}$/.test(id)) {
    return res.status(404).json({ error: 'Session not found (invalid ID format)' });
  }
  next();
});


const VALID_TYPES: MonitoringEventType[] = [
  'device_fingerprint',
  'tab_blur',
  'tab_focus',
  'camera_denied',
  'camera_on',
  'camera_off',
  'face_missing',
  'face_detected',
  'posture_warning',
  'posture_ok',
  'timer_started',
  'timer_ended',
  'session_ready',
];

// POST /api/sessions/:id/monitoring — ingest a monitoring event from candidate client
router.post('/:id/monitoring', async (req: Request, res: Response) => {
  try {
    const { type, deviceId, detail, metadata, timestamp } = req.body as {
      type: MonitoringEventType;
      deviceId?: string;
      detail?: string;
      metadata?: Record<string, unknown>;
      timestamp?: string;
    };

    if (!type || !VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: `Invalid monitoring event type: ${type}` });
    }

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const clientIp = Array.isArray(ip) ? ip[0] : ip;

    const event = await MonitoringEvent.create({
      sessionId: req.params.id,
      deviceId,
      type,
      detail: detail ?? '',
      metadata: {
        ...(metadata ?? {}),
        ipAddress: clientIp || '127.0.0.1',
      },
      timestamp: timestamp ? new Date(timestamp) : new Date(),
    });

    const io: SocketServer | undefined = req.app.get('io');
    io?.to(`session:${req.params.id}`).emit('monitoring_event', {
      type: event.type,
      deviceId: event.deviceId,
      detail: event.detail,
      metadata: event.metadata,
      timestamp: event.timestamp,
    });

    res.status(201).json(event);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// GET /api/sessions/:id/monitoring — fetch monitoring event history
router.get('/:id/monitoring', async (req: Request, res: Response) => {
  const { type, limit } = req.query;
  const query: Record<string, unknown> = { sessionId: req.params.id };
  if (type) query.type = type;

  const events = await MonitoringEvent.find(query)
    .sort({ timestamp: -1 })
    .limit(parseInt((limit as string) ?? '200', 10));

  res.json(events);
});

export default router;
