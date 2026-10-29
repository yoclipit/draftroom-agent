'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { normalizeBrief, runAgent } = require('./agent');

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

function json(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(data));
}

async function readJson(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 16000) {
      const error = new Error('The brief is too long.');
      error.status = 413;
      throw error;
    }
  }
  try { return JSON.parse(body); }
  catch {
    const error = new Error('The request must contain valid JSON.');
    error.status = 400;
    throw error;
  }
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
  return http.createServer(async (request, response) => {
    securityHeaders(response);
    const pathname = new URL(request.url || '/', 'http://localhost').pathname;
    if (request.method === 'GET' && FILES[pathname]) {
      const [filename, contentType] = FILES[pathname];
      response.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': pathname === '/' ? 'no-cache' : 'public, max-age=3600' });
      fs.createReadStream(path.join(PUBLIC, filename)).pipe(response);
      return;
    }
    if (request.method === 'GET' && pathname === '/api/config') {
      json(response, 200, { aiAvailable: Boolean(key), model: key ? model : null });
      return;
    }
    if (request.method !== 'POST' || pathname !== '/api/generate') {
      json(response, 404, { error: 'Not found.' });
      return;
    }
    if (rateLimited(request)) {
      json(response, 429, { error: 'Too many requests. Please wait a minute.' });
      return;
    }
    let input, brief;
    try {
      input = await readJson(request);
      brief = normalizeBrief(input.brief);
      if (!['demo', 'live'].includes(input.mode)) throw new Error('Choose sample or AI mode.');
      if (input.mode === 'live' && !key) throw new Error('AI mode needs OPENAI_API_KEY on the server.');
    } catch (error) {
      json(response, error.status || 400, { error: error.message });
      return;
    }
    response.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    const controller = new AbortController();
    response.on('close', () => controller.abort());
    const emit = event => {
      if (!response.destroyed) response.write(`data: ${JSON.stringify(event)}\n\n`);
    };
    emit({ type: 'started', mode: input.mode });
    try {
      const result = await runAgent(brief, emit, { mode: input.mode, key, model, url, signal: controller.signal });
      emit({ type: 'result', data: result });
    } catch (error) {
      emit({ type: 'error', message: error.message || 'Generation failed.' });
    } finally {
      response.end();
    }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  createServer().listen(port, '0.0.0.0', () => {
    console.log(`Draftroom is running on http://localhost:${port}`);
  });
}

module.exports = { createServer };
