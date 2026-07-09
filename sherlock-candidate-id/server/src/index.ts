// src/index.ts — Express + Socket.io server entry point
import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
import mongoose from 'mongoose';
import { Server as SocketServer } from 'socket.io';

import sessionsRouter from './routes/sessions';
import participantsRouter from './routes/participants';
import signalsRouter from './routes/signals';
import uploadRouter from './routes/upload';
import recallWebhookRouter from './routes/recallWebhook';
import monitoringRouter from './routes/monitoring';
import { registerSimulatorHandlers } from './simulator/simulatorController';
import { registerConfidenceLoop } from './utils/confidenceLoop';
import { loadFaceApiModels } from './signals/faceVerification';
import { closeAllPlaywrightBots } from './ingestion/playwrightBot';
import { MongoMemoryServer } from 'mongodb-memory-server';

const PORT = parseInt(process.env.PORT ?? '4000', 10);
const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/sherlock';
const CLIENT_URL = process.env.CLIENT_URL ?? 'http://localhost:3000';

async function main() {
  // ── MongoDB ──────────────────────────────────────────────────────────────
  try {
    // Connect with a 5-second timeout to fail fast if blocked by IP whitelists
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    console.log('[server] MongoDB connected successfully to configured URI');
  } catch (err: any) {
    console.warn(`[server] MongoDB connection failed: ${err.message}`);
    console.log('[server] Attempting to start in-memory MongoDB fallback (zero-config mode)...');
    try {
      const mongoServer = await MongoMemoryServer.create({
        instance: {
          port: 27018,
          dbPath: path.resolve('db-data'),
          storageEngine: 'wiredTiger',
        }
      });
      const mongoUri = mongoServer.getUri();
      await mongoose.connect(mongoUri);
      console.log(`[server] Persistent In-memory MongoDB connected successfully at ${mongoUri}`);
      
      // Store the server reference globally to clean it up on shutdown
      (global as any).mongoServer = mongoServer;
    } catch (fallbackErr: any) {
      console.error('[server] Fatal: both configured database and in-memory fallback failed:', fallbackErr.message);
      process.exit(1);
    }
  }

  // ── Face-api models (non-blocking; signals return score=0 until loaded) ──
  loadFaceApiModels().catch((err) =>
    console.warn('[server] face-api models failed to load:', err.message)
  );

  // ── Express ──────────────────────────────────────────────────────────────
  const app = express();
  app.use(cors({ origin: CLIENT_URL, credentials: true }));
  app.use(express.json({ limit: '10mb' })); // frames arrive as base64
  app.use('/uploads', express.static(path.resolve(process.env.UPLOAD_DIR ?? 'uploads')));

  // ── Localtunnel bypass ────────────────────────────────────────────────────
  // Localtunnel shows a human-verification challenge page to new visitors.
  // Recall.ai POST requests would be blocked unless we bypass it.
  // This middleware injects the bypass cookie/header for all inbound requests.
  app.use((_req, res, next) => {
    res.setHeader('bypass-tunnel-reminder', 'true');
    next();
  });

  app.use('/api/sessions', sessionsRouter);
  app.use('/api/sessions', participantsRouter);
  app.use('/api/sessions', signalsRouter);
  app.use('/api/sessions', monitoringRouter);
  app.use('/api/upload', uploadRouter);
  // Mount on both with and without trailing slash (Recall.ai sends to the exact URL including trailing /)
  app.use('/api/webhooks/recall', recallWebhookRouter);
  app.use('/api/webhooks/recall/', recallWebhookRouter);

  app.get('/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));

  // ── Socket.io ────────────────────────────────────────────────────────────
  const httpServer = http.createServer(app);
  const io = new SocketServer(httpServer, {
    cors: { origin: CLIENT_URL, methods: ['GET', 'POST'] },
  });
  app.set('io', io);

  io.on('connection', (socket) => {
    console.log('[socket] client connected:', socket.id);
    socket.on('join_session', (sessionId: string) => {
      socket.join(`session:${sessionId}`);
      console.log(`[socket] ${socket.id} joined session:${sessionId}`);
    });
    socket.on('disconnect', () => console.log('[socket] disconnected:', socket.id));
  });

  // Attach simulator handlers (no-op in production ingestion path)
  registerSimulatorHandlers(io);

  // Start the per-session confidence loop (ticks every 3 s)
  registerConfidenceLoop(io);

  const server = httpServer.listen(PORT, () => console.log(`[server] listening on :${PORT}`));

  // Graceful shutdown helper
  const shutdown = async (signal: string) => {
    console.log(`[server] ${signal} received. Initiating graceful shutdown...`);
    
    // Close HTTP and Socket.io servers immediately to release port 4000 for new processes
    try {
      io.close();
      server.close();
      console.log('[server] Port 4000 listener closed.');
    } catch (e: any) {
      console.warn('[server] Error closing listeners:', e.message);
    }

    // Force-exit if something hangs (e.g. a stuck browser.close() or mongo socket)
    setTimeout(() => {
      console.warn('[server] Graceful shutdown timed out. Forcing process exit.');
      process.exit(1);
    }, 5000).unref();

    await closeAllPlaywrightBots();
    await mongoose.connection.close().catch(() => {});
    
    // Stop in-memory database if running
    const mongoServer = (global as any).mongoServer;
    if (mongoServer) {
      await mongoServer.stop().catch(() => {});
    }

    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  
  // Clean up on ts-node-dev reload
  process.once('SIGUSR2', async () => {
    console.log('[server] SIGUSR2 (ts-node-dev reload) received. Cleaning up active bots...');
    
    // Close HTTP and Socket.io servers immediately to release port 4000 for the reloading process
    try {
      io.close();
      server.close();
    } catch (e: any) {
      console.warn('[server] Error closing listeners on reload:', e.message);
    }

    // Force-trigger the reload if cleanup hangs
    setTimeout(() => {
      console.warn('[server] ts-node-dev reload cleanup timed out. Forcing reload signal.');
      process.kill(process.pid, 'SIGUSR2');
    }, 5000).unref();

    await closeAllPlaywrightBots();
    await mongoose.connection.close().catch(() => {});
    
    const mongoServer = (global as any).mongoServer;
    if (mongoServer) {
      await mongoServer.stop().catch(() => {});
    }

    process.kill(process.pid, 'SIGUSR2');
  });
}

main().catch((err) => {
  console.error('[server] fatal startup error:', err);
  process.exit(1);
});

export { };
