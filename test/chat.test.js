'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { handleChat } = require('../chat');
const { normalizeBrief } = require('../agent');
const { createServer } = require('../server');

const brief = normalizeBrief({
  topic: 'How college students can use AI responsibly',
  audience: 'College students',
  tone: 'Clear and approachable',
  goal: 'Give readers a practical framework',
  mustInclude: 'Checking accuracy',
  wordCount: 550
});

test('sample chat executes combined brief changes and creates a changed draft', async () => {
  const result = await handleChat({
    message: 'Include protecting privacy and make it shorter',
    brief,
    mode: 'demo'
  });
  assert.equal(result.brief.wordCount, 350);
  assert.match(result.brief.mustInclude, /protecting privacy/);
  assert.match(result.result.article, /Protecting privacy/);
  assert.equal(result.result.mode, 'demo');
  assert.match(result.reply, /local templates, not an AI model/);
});

test('chat HTTP endpoint updates the draft and offers a real download action', async () => {
  const server = createServer({ key: '' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const draft = await (await fetch(`${base}/api/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Write a 350-word draft about community gardens for local volunteers',
        brief, mode: 'demo'
      })
    })).json();
    assert.equal(draft.brief.topic, 'community gardens');
    assert.equal(draft.brief.audience, 'local volunteers');
    assert.equal(draft.brief.wordCount, 350);
    assert.match(draft.result.article, /community gardens/i);
    const download = await (await fetch(`${base}/api/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Download the draft', brief: draft.brief, article: draft.result.article, mode: 'demo' })
    })).json();
    assert.equal(download.clientAction, 'download');
    assert.equal(download.result, null);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('AI chat plans a revision and executes the writing workflow with the existing article', async () => {
  const responses = [
    { reply: 'I can revise the draft.', operation: 'revise', changes: [{ field: 'tone', value: 'Thoughtful and professional' }] },
    { workingTitle: 'A considered guide', angle: 'Make the case carefully', outline: [{ heading: 'Start', notes: 'Set a goal' }, { heading: 'Check', notes: 'Verify claims' }] },
    '# A considered guide\n\nA revised article about responsible AI use.',
    { approved: true, score: 85, strengths: ['Clearer tone'], fixes: [] },
    { titles: ['One', 'Two', 'Three'], hooks: ['First', 'Second'] }
  ];
  const requests = [];
  const mock = http.createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    requests.push({ authorization: request.headers.authorization, body: JSON.parse(body) });
    const value = responses[requests.length - 1];
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ choices: [{ message: { content: typeof value === 'string' ? value : JSON.stringify(value) } }] }));
  });
  await new Promise(resolve => mock.listen(0, '127.0.0.1', resolve));
  try {
    const result = await handleChat({
      message: 'Make this more professional and revise it',
      brief,
      article: '# Earlier draft\n\nThis is the old version.',
      mode: 'live'
    }, { key: 'mock-key', model: 'test-model', url: `http://127.0.0.1:${mock.address().port}/chat/completions` });
    assert.equal(requests.length, 5);
    assert.ok(requests.every(request => request.authorization === 'Bearer mock-key'));
    assert.match(requests[2].body.messages[1].content, /EXISTING ARTICLE/);
    assert.equal(result.brief.tone, 'Thoughtful and professional');
    assert.match(result.result.article, /revised article/);
    assert.equal(result.result.revisionCount, 1);
    assert.equal(JSON.stringify(result).includes('mock-key'), false);
  } finally {
    await new Promise(resolve => mock.close(resolve));
  }
});
