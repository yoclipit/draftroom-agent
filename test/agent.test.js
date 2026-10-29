'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { normalizeBrief, runAgent } = require('../agent');
const { createDemoResult } = require('../demo');
const { createServer } = require('../server');

const brief = normalizeBrief({
  topic: 'How college students can use AI responsibly',
  audience: 'College students',
  tone: 'Clear and approachable',
  goal: 'Give readers a practical framework',
  mustInclude: 'Accuracy and privacy',
  wordCount: 550
});

test('validates the writing brief before any model call', () => {
  assert.throws(() => normalizeBrief({ topic: 'AI', audience: 'Students', wordCount: 550 }), /topic/i);
  assert.throws(() => normalizeBrief({ topic: 'A useful topic', audience: 'x', wordCount: 550 }), /audience/i);
  assert.throws(() => normalizeBrief({ topic: 'A useful topic', audience: 'Students', wordCount: 999 }), /length/i);
});

test('sample workflow exposes the same visible stages and labels its result', async () => {
  const events = [];
  const result = await runAgent(brief, event => events.push(event), { mode: 'demo' });
  assert.equal(result.mode, 'demo');
  assert.match(result.article, /^# /);
  assert.equal(result.packaging.titles.length, 3);
  assert.deepEqual(events.filter(x => x.status === 'done').map(x => x.stage), ['plan', 'draft', 'review', 'package']);
});

test('sample preview responds to every brief setting and target length', () => {
  const base = createDemoResult(brief);
  const changes = [
    { topic: 'How to start a neighborhood book club' },
    { audience: 'Working parents' },
    { tone: 'Thoughtful and professional' },
    { goal: 'Help readers plan one small experiment this weekend' },
    { mustInclude: 'Making a weekly schedule and inviting a friend' }
  ];
  for (const change of changes) {
    const changed = createDemoResult(normalizeBrief({ ...brief, ...change }));
    assert.notEqual(changed.article, base.article, `${Object.keys(change)[0]} should change the article`);
    assert.notDeepEqual(changed.plan, base.plan, `${Object.keys(change)[0]} should change the plan`);
  }
  const professional = createDemoResult(normalizeBrief({
    ...brief,
    tone: 'Thoughtful and professional',
    goal: 'Give readers a practical framework they can use today.',
    mustInclude: 'Checking accuracy, protecting privacy, and using AI to support learning'
  }));
  assert.match(professional.article, /A useful approach begins with a clear purpose/);
  assert.match(professional.article, /Checking accuracy/);
  assert.match(professional.article, /protecting privacy/i);
  assert.match(professional.article, /using AI to support learning/i);
  const lengths = [350, 550, 750].map(wordCount => {
    const article = createDemoResult(normalizeBrief({ ...brief, wordCount })).article;
    return article.trim().split(/\s+/).length;
  });
  assert.ok(lengths[0] < lengths[1] && lengths[1] < lengths[2]);
  lengths.forEach((actual, index) => assert.ok(Math.abs(actual - [350, 550, 750][index]) <= 75, `unexpected sample length: ${actual}`));
});

test('live workflow revises a rejected draft and stops after approval', async () => {
  const responses = [
    { workingTitle: 'A practical guide', angle: 'Use AI carefully', outline: [{ heading: 'Start', notes: 'Set a goal' }, { heading: 'Check', notes: 'Verify outputs' }] },
    '# A practical guide\n\nFirst draft.',
    { approved: false, score: 59, strengths: ['Clear opening'], fixes: ['Add a privacy example'] },
    '# A practical guide\n\nRevised draft with a privacy example.',
    { approved: true, score: 88, strengths: ['Useful example'], fixes: [] },
    { titles: ['One', 'Two', 'Three'], hooks: ['Hook one', 'Hook two'] }
  ];
  const requests = [];
  const mock = http.createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    requests.push({ authorization: request.headers.authorization, body: JSON.parse(body) });
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ choices: [{ message: { content: typeof responses[requests.length - 1] === 'string' ? responses[requests.length - 1] : JSON.stringify(responses[requests.length - 1]) } }] }));
  });
  await new Promise(resolve => mock.listen(0, '127.0.0.1', resolve));
  try {
    const events = [];
    const result = await runAgent(brief, event => events.push(event), {
      mode: 'live', key: 'test-key', model: 'test-model', url: `http://127.0.0.1:${mock.address().port}/chat/completions`
    });
    assert.equal(requests.length, 6);
    assert.ok(requests.every(x => x.authorization === 'Bearer test-key'));
    assert.equal(result.revisionCount, 1);
    assert.equal(result.review.score, 88);
    assert.match(result.article, /privacy example/);
    assert.deepEqual(events.filter(x => x.stage === 'review' && x.status === 'done').map(x => x.pass), [1, 2]);
    assert.equal(JSON.stringify(result).includes('test-key'), false);
  } finally {
    await new Promise(resolve => mock.close(resolve));
  }
});

test('HTTP server serves the app, protects the key, and streams a sample result', async () => {
  const server = createServer({ key: 'server-secret', model: 'test-model' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const home = await fetch(base);
    assert.equal(home.status, 200);
    assert.match(await home.text(), /Draftroom/);
    const appScript = await fetch(`${base}/app.js`);
    assert.equal(appScript.headers.get('cache-control'), 'no-cache');
    const config = await (await fetch(`${base}/api/config`)).json();
    assert.deepEqual(config, { aiAvailable: true, model: 'test-model' });
    assert.equal(JSON.stringify(config).includes('server-secret'), false);
    const invalid = await fetch(`${base}/api/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'demo', brief: { ...brief, topic: 'x' } }) });
    assert.equal(invalid.status, 400);
    const stream = await fetch(`${base}/api/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'demo', brief }) });
    assert.equal(stream.headers.get('content-type'), 'text/event-stream; charset=utf-8');
    const body = await stream.text();
    assert.match(body, /"type":"result"/);
    assert.match(body, /"mode":"demo"/);
    assert.equal(body.includes('server-secret'), false);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
