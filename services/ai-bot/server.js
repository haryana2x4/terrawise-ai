/**
 * SUNDAY v2: SovereignDev Backend Server & WebSocket Bridge
 * Port: 8765
 * Features:
 * - Route handling for / (Studio) and /project (Showcase)
 * - Observable multi-step code agent execution
 * - Automated benchmark evaluation endpoint (/api/eval)
 * - Input validation, rate-limiting guards, and structured logging
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const { SundayEventBus } = require('./core/event_bus');
const { MemoryStore } = require('./core/memory');
const { SundayAgent } = require('./core/agent');
const { SundayTools } = require('./core/tools');
const { runEvaluationSuite } = require('./tests/eval_suite');

const PORT = 8765;
const eventBus = new SundayEventBus();
const memory = new MemoryStore();
const agent = new SundayAgent(eventBus, memory);
const tools = new SundayTools(eventBus);

// Structured logger
function log(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  console.log(JSON.stringify({ timestamp, level, message, ...meta }));
}

// MIME types
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

// Rate limiter state
const requestCounts = new Map();
function checkRateLimit(ip) {
  const now = Date.now();
  const windowMs = 60000;
  const maxReqs = 180;
  const record = requestCounts.get(ip) || { count: 0, resetTime: now + windowMs };

  if (now > record.resetTime) {
    record.count = 1;
    record.resetTime = now + windowMs;
  } else {
    record.count++;
  }
  requestCounts.set(ip, record);
  return record.count <= maxReqs;
}

const server = http.createServer(async (req, res) => {
  const clientIp = req.socket.remoteAddress || '127.0.0.1';
  if (!checkRateLimit(clientIp)) {
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Rate limit exceeded. Please wait 60 seconds.' }));
    return;
  }

  // Safe local CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // 1. Health endpoint
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ready',
      version: '2.0.0',
      offline: true,
      service: 'SovereignDev Local Agent',
      vram: '6GB RTX 3050 (2.1GB allocated)',
      state: eventBus.getState()
    }));
    return;
  }

  // 2. Project Showcase Route
  if (pathname === '/project') {
    const projectPath = path.join(__dirname, 'project.html');
    fs.readFile(projectPath, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error loading project showcase');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
    return;
  }

  // 3. Evaluation Suite Endpoint
  if (pathname === '/api/eval') {
    try {
      const evalResults = await runEvaluationSuite();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(evalResults));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 4. Code Agent AST & Patch Endpoint
  if (pathname === '/api/code' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      if (body.length > 50000) return; // Prevent memory overflow
      body += chunk;
    });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body || '{}');
        const task = (typeof data.task === 'string' ? data.task.slice(0, 500) : 'Inspect AST');
        const result = await tools.runCodeAgent(task);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid code task payload' }));
      }
    });
    return;
  }

  // 5. RAG Endpoint
  if (pathname === '/api/rag' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body || '{}');
        const query = (typeof data.query === 'string' ? data.query.slice(0, 500) : 'security');
        const result = await tools.runFolderRAG(query);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid RAG payload' }));
      }
    });
    return;
  }

  // 6. Chat Endpoint
  if (pathname === '/api/chat' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body || '{}');
        const query = (typeof data.query === 'string' ? data.query.slice(0, 500) : 'Hey Sunday');
        if (data.personality) agent.setPersonality(data.personality);
        const reply = await agent.processQuery(query);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(reply));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid chat payload' }));
      }
    });
    return;
  }

  // Static File Serving
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

// WebSocket Server for bidirectional state synchronization
const wss = new WebSocketServer({ server });

wss.on('connection', ws => {
  ws.send(JSON.stringify({
    type: 'init',
    state: eventBus.getState(),
    personality: agent.getPersonality(),
    memory: memory.getAll()
  }));

  const unsub = eventBus.on('*', payload => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
  });

  ws.on('message', async raw => {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === 'chat') await agent.processQuery(msg.query);
      else if (msg.type === 'tool_code') await tools.runCodeAgent(msg.task);
      else if (msg.type === 'tool_rag') await tools.runFolderRAG(msg.query);
    } catch (e) {}
  });

  ws.on('close', () => unsub());
});

server.listen(PORT, '0.0.0.0', () => {
  log('info', `SUNDAY v2: SovereignDev Server Online at http://127.0.0.1:${PORT} and LAN http://192.168.1.6:${PORT}`, { port: PORT });
});
