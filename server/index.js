import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { MongoClient } from 'mongodb';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI;
const CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------
// Storage layer – MongoDB when available, in-memory fallback for dev
// ---------------------------------------------------------------------------
let db = null;
let pairingsCol = null;
let commandsCol = null;
let changeStream = null;
let useInMemory = !MONGODB_URI;

// In-memory fallback store
const memPairings = new Map();
const memCommands = new Map(); // pairingId -> [commands]

// SSE clients: pairingId -> Set<res>
const sseClients = new Map();

function generateCode() {
  return Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join('');
}

function generateId() {
  return crypto.randomUUID();
}

// Broadcast command to all SSE clients for a pairingId
function broadcast(pairingId, data) {
  const clients = sseClients.get(pairingId);
  if (!clients) return;
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    res.write(payload);
  }
}

// ---------------------------------------------------------------------------
// MongoDB setup
// ---------------------------------------------------------------------------
async function connectMongo() {
  if (!MONGODB_URI) return;
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db('flapstr');
    pairingsCol = db.collection('pairings');
    commandsCol = db.collection('commands');

    // TTL index on pairings – auto-expire after 5 minutes
    await pairingsCol.createIndex({ createdAt: 1 }, { expireAfterSeconds: 300 });
    // TTL index on commands – expire after 1 hour
    await commandsCol.createIndex({ createdAt: 1 }, { expireAfterSeconds: 3600 });

    // Watch commands collection for real-time push
    changeStream = commandsCol.watch(
      [{ $match: { operationType: 'insert' } }],
      { fullDocument: 'updateLookup' }
    );
    changeStream.on('change', (change) => {
      const doc = change.fullDocument;
      if (doc && doc.pairingId) {
        broadcast(doc.pairingId, {
          type: doc.type,
          payload: doc.payload,
          from: doc.from,
          timestamp: doc.createdAt,
        });
      }
    });

    useInMemory = false;
    console.log('Connected to MongoDB Atlas');
  } catch (err) {
    console.warn('MongoDB connection failed, using in-memory store:', err.message);
    useInMemory = true;
  }
}

// ---------------------------------------------------------------------------
// Cleanup expired in-memory pairings
// ---------------------------------------------------------------------------
setInterval(() => {
  const now = Date.now();
  for (const [id, p] of memPairings) {
    if (now - p.createdAt > CODE_TTL_MS && p.connectedDevices.length === 0) {
      memPairings.delete(id);
    }
  }
}, 30000);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// TV creates a pairing session
app.post('/api/pairing/create', async (req, res) => {
  const code = generateCode();
  const tvSessionId = generateId();
  const pairingId = generateId();
  const now = new Date();

  const pairing = {
    _id: pairingId,
    code,
    tvSessionId,
    connectedDevices: [],
    createdAt: now,
    active: true,
  };

  if (useInMemory) {
    pairing.createdAt = Date.now();
    memPairings.set(pairingId, pairing);
  } else {
    await pairingsCol.insertOne(pairing);
  }

  res.json({ pairingId, code, tvSessionId });
});

// Refresh pairing code (TV calls this every 5 min)
app.post('/api/pairing/refresh', async (req, res) => {
  const { pairingId, tvSessionId } = req.body;
  if (!pairingId || !tvSessionId) return res.status(400).json({ error: 'Missing fields' });

  const code = generateCode();
  const now = new Date();

  if (useInMemory) {
    const p = memPairings.get(pairingId);
    if (!p || p.tvSessionId !== tvSessionId) return res.status(404).json({ error: 'Not found' });
    // If already paired, don't refresh
    if (p.connectedDevices.length > 0) return res.json({ code: p.code, paired: true });
    p.code = code;
    p.createdAt = Date.now();
    res.json({ code, paired: false });
  } else {
    const result = await pairingsCol.findOneAndUpdate(
      { _id: pairingId, tvSessionId, connectedDevices: { $size: 0 } },
      { $set: { code, createdAt: now } },
      { returnDocument: 'after' }
    );
    if (!result) {
      // Check if already paired
      const existing = await pairingsCol.findOne({ _id: pairingId, tvSessionId });
      if (existing && existing.connectedDevices.length > 0) {
        return res.json({ code: existing.code, paired: true });
      }
      return res.status(404).json({ error: 'Not found' });
    }
    res.json({ code, paired: false });
  }
});

// Mobile joins with code
app.post('/api/pairing/join', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Code required' });

  const deviceId = generateId();

  if (useInMemory) {
    let found = null;
    for (const [, p] of memPairings) {
      if (p.code === code && p.active) { found = p; break; }
    }
    if (!found) return res.status(404).json({ error: 'Invalid code' });
    found.connectedDevices.push(deviceId);
    // Notify TV that a device connected
    broadcast(found._id, { type: 'device_connected', payload: { deviceId, count: found.connectedDevices.length } });
    res.json({ pairingId: found._id, deviceId });
  } else {
    const pairing = await pairingsCol.findOne({ code, active: true });
    if (!pairing) return res.status(404).json({ error: 'Invalid code' });
    await pairingsCol.updateOne(
      { _id: pairing._id },
      { $push: { connectedDevices: deviceId } }
    );
    broadcast(pairing._id, { type: 'device_connected', payload: { deviceId, count: pairing.connectedDevices.length + 1 } });
    res.json({ pairingId: pairing._id, deviceId });
  }
});

// Mobile sends a command
app.post('/api/pairing/command', async (req, res) => {
  const { pairingId, deviceId, type, payload } = req.body;
  if (!pairingId || !type) return res.status(400).json({ error: 'Missing fields' });

  const command = {
    pairingId,
    from: deviceId,
    type,
    payload,
    createdAt: new Date(),
  };

  if (useInMemory) {
    // Directly broadcast for in-memory mode
    broadcast(pairingId, { type, payload, from: deviceId, timestamp: Date.now() });
  } else {
    await commandsCol.insertOne(command);
    // Change stream will handle broadcast
  }

  res.json({ ok: true });
});

// Check pairing status
app.get('/api/pairing/status/:pairingId', async (req, res) => {
  const { pairingId } = req.params;

  if (useInMemory) {
    const p = memPairings.get(pairingId);
    if (!p) return res.status(404).json({ error: 'Not found' });
    res.json({
      active: p.active,
      connectedDevices: p.connectedDevices.length,
      code: p.connectedDevices.length === 0 ? p.code : undefined,
    });
  } else {
    const p = await pairingsCol.findOne({ _id: pairingId });
    if (!p) return res.status(404).json({ error: 'Not found' });
    res.json({
      active: p.active,
      connectedDevices: p.connectedDevices.length,
      code: p.connectedDevices.length === 0 ? p.code : undefined,
    });
  }
});

// Disconnect a device
app.post('/api/pairing/disconnect', async (req, res) => {
  const { pairingId, deviceId } = req.body;

  if (useInMemory) {
    const p = memPairings.get(pairingId);
    if (p) {
      p.connectedDevices = p.connectedDevices.filter(d => d !== deviceId);
      broadcast(pairingId, { type: 'device_disconnected', payload: { deviceId, count: p.connectedDevices.length } });
    }
  } else {
    await pairingsCol.updateOne(
      { _id: pairingId },
      { $pull: { connectedDevices: deviceId } }
    );
    const p = await pairingsCol.findOne({ _id: pairingId });
    broadcast(pairingId, { type: 'device_disconnected', payload: { deviceId, count: p?.connectedDevices?.length || 0 } });
  }

  res.json({ ok: true });
});

// SSE endpoint – both TV and mobile subscribe here
app.get('/api/pairing/events/:pairingId', (req, res) => {
  const { pairingId } = req.params;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  res.write('\n');

  if (!sseClients.has(pairingId)) {
    sseClients.set(pairingId, new Set());
  }
  sseClients.get(pairingId).add(res);

  // Send heartbeat every 30s
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    const clients = sseClients.get(pairingId);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) sseClients.delete(pairingId);
    }
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, storage: useInMemory ? 'memory' : 'mongodb' });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
await connectMongo();

app.listen(PORT, () => {
  console.log(`Flapstr pairing server running on port ${PORT} (${useInMemory ? 'in-memory' : 'MongoDB'})`);
});
