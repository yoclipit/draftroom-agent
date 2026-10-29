'use strict';

const http = require('node:http');
const path = require('node:path');
const express = require('express');
const { normalizeBrief, runAgent } = require('./agent');
const { handleChat } = require('./chat');

const PUBLIC = path.join(__dirname, 'public');
const FILES = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
  '/favicon.svg': ['favicon.svg', 'image/svg+xml']
};
const recentRequests = new Map();

function securityHeaders(response) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
}

function rateLimited(request) {
  const ip = request.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entries = (recentRequests.get(ip) || []).filter(time => now - time < 60000);
  if (entries.length >= 12) {
    recentRequests.set(ip, entries);
    return true;
  }
  entries.push(now);
  recentRequests.set(ip, entries);
  if (recentRequests.size > 1000) {
    for (const [key, values] of recentRequests) {
      if (values.every(time => now - time >= 60000)) recentRequests.delete(key);
    }
  }
  return false;
}

function createServer(config = {}) {
  const key = config.key ?? process.env.OPENAI_API_KEY;
  const model = config.model ?? process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
  const url = config.url ?? process.env.OPENAI_BASE_URL;
  const app = express();
  app.disable('x-powered-by');
  app.use((request, response, next) => {
    securityHeaders(response);
    next();
  });

  for (const [route, [filename, contentType]] of Object.entries(FILES)) {
    app.get(route, (request, response) => {
      response.type(contentType);
      response.set('Cache-Control', 'no-cache');
      response.sendFile(path.join(PUBLIC, filename));
    });
  }

  app.get('/api/config', (request, response) => {
    response.set('Cache-Control', 'no-store');
    response.json({ aiAvailable: Boolean(key), model: key ? model : null });
  });

  app.post('/api/chat', express.json({ limit: '32kb' }), async (request, response) => {
    response.set('Cache-Control', 'no-store');
    if (rateLimited(request)) return response.status(429).json({ error: 'Too many requests. Please wait a minute.' });
    const controller = new AbortController();
    response.on('close', () => controller.abort());
    try {
      const result = await handleChat(request.body, { key, model, url, signal: controller.signal });
      if (!response.destroyed) response.json(result);
    } catch (error) {
      if (!response.destroyed) response.status(400).json({ error: error.message || 'The assistant could not complete that task.' });
    }
  });

  app.post('/api/generate', express.json({ limit: '16kb' }), async (request, response) => {
    response.set('Cache-Control', 'no-store');
    if (rateLimited(request)) {
      response.status(429).json({ error: 'Too many requests. Please wait a minute.' });
      return;
    }
    let brief;
    try {
      brief = normalizeBrief(request.body?.brief);
      if (!['demo', 'live'].includes(request.body?.mode)) throw new Error('Choose sample or AI mode.');
      if (request.body.mode === 'live' && !key) throw new Error('AI mode needs OPENAI_API_KEY on the server.');
    } catch (error) {
      response.status(400).json({ error: error.message });
      return;
    }
    response.set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    response.flushHeaders();
    const controller = new AbortController();
    response.on('close', () => controller.abort());
    const emit = event => {
      if (!response.destroyed && !response.writableEnded) response.write(`data: ${JSON.stringify(event)}\n\n`);
    };
    emit({ type: 'started', mode: request.body.mode });
    try {
      const result = await runAgent(brief, emit, { mode: request.body.mode, key, model, url, signal: controller.signal });
      emit({ type: 'result', data: result });
    } catch (error) {
      emit({ type: 'error', message: error.message || 'Generation failed.' });
    } finally {
      response.end();
    }
  });

  app.use((error, request, response, next) => {
    if (response.headersSent) return next(error);
    response.set('Cache-Control', 'no-store');
    if (error.type === 'entity.too.large') return response.status(413).json({ error: 'The brief is too long.' });
    if (error.type === 'entity.parse.failed') return response.status(400).json({ error: 'The request must contain valid JSON.' });
    response.status(500).json({ error: 'The server could not complete the request.' });
  });
  app.use((request, response) => response.status(404).json({ error: 'Not found.' }));
  return http.createServer(app);
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  createServer().listen(port, '0.0.0.0', () => {
    console.log(`Draftroom is running on http://localhost:${port}`);
  });
}

module.exports = { createServer };
