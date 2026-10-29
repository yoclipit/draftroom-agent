'use strict';

const $ = id => document.getElementById(id);
const form = $('briefForm');
const chatForm = $('chatForm');
const chatInput = $('chatInput');
const chatSendButton = $('chatSendButton');
const modeSelect = $('writingMode');
const generateButton = $('generateButton');
const cancelButton = $('cancelButton');
const formError = $('formError');
const formNote = $('formNote');
const stageList = $('stageList');
const stages = [
  ['plan', 'Plan the story', 'Find an angle and shape the outline'],
  ['draft', 'Write the draft', 'Turn the outline into an article'],
  ['review', 'Review the work', 'Check clarity, coverage, and flow'],
  ['revise', 'Revise if needed', 'Apply the editor’s feedback'],
  ['package', 'Explore the options', 'Suggest titles and opening hooks']
];
let controller = null;
let lastResult = null;
let chatBusy = false;

function setBusy(busy) {
  generateButton.disabled = busy;
  generateButton.firstChild.textContent = busy ? 'Working on your draft ' : (modeSelect.value === 'live' ? 'Generate with AI ' : 'Run sample workflow ');
  cancelButton.hidden = !busy;
}

function showError(message) {
  formError.textContent = message;
  formError.hidden = !message;
}

function getBrief() {
  return {
    topic: $('topic').value,
    audience: $('audience').value,
    tone: $('tone').value,
    goal: $('goal').value,
    mustInclude: $('mustInclude').value,
    wordCount: Number($('wordCount').value)
  };
}

function initialStages() {
  stageList.replaceChildren();
  for (const [id, title, description] of stages) {
    const row = document.createElement('div');
    row.className = 'stage-item';
    row.dataset.stage = id;
    const icon = document.createElement('span');
    icon.className = 'stage-icon';
    icon.textContent = '·';
    const copy = document.createElement('div');
    copy.className = 'stage-copy';
    const strong = document.createElement('strong');
    strong.textContent = title;
    const p = document.createElement('p');
    p.textContent = description;
    copy.append(strong, p);
    const state = document.createElement('span');
    state.className = 'stage-state';
    state.textContent = 'WAITING';
    row.append(icon, copy, state);
    stageList.append(row);
  }
}

function updateStage(event) {
  const row = stageList.querySelector(`[data-stage="${event.stage}"]`);
  if (!row) return;
  row.classList.remove('running', 'done');
  row.classList.add(event.status);
  row.querySelector('.stage-icon').textContent = event.status === 'done' ? '✓' : '↗';
  row.querySelector('.stage-state').textContent = event.status === 'done' ? 'DONE' : 'WORKING';
  if (event.detail) row.querySelector('.stage-copy p').textContent = event.detail;
  const name = stages.find(stage => stage[0] === event.stage)?.[1] || 'Working';
  if (event.status === 'running') $('activityTitle').textContent = name;
}

function textElement(tag, value) {
  const element = document.createElement(tag);
  element.textContent = value;
  return element;
}

function addInline(parent, text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  for (const part of parts) {
    if (part.startsWith('**') && part.endsWith('**')) parent.append(textElement('strong', part.slice(2, -2)));
    else parent.append(document.createTextNode(part));
  }
}

function renderMarkdown(markdown) {
  const container = $('articleBody');
  container.replaceChildren();
  const blocks = markdown.replace(/\r/g, '').split(/\n\s*\n/);
  for (const block of blocks) {
    const lines = block.split('\n').filter(Boolean);
    if (!lines.length) continue;
    const first = lines[0];
    if (/^#{1,3} /.test(first)) {
      const level = first.match(/^#+/)[0].length;
      const heading = document.createElement(`h${level}`);
      addInline(heading, first.slice(level + 1));
      container.append(heading);
      if (lines.length > 1) container.append(textElement('p', lines.slice(1).join(' ')));
      continue;
    }
    if (lines.every(line => /^[-*] /.test(line) || /^\d+\. /.test(line))) {
      const ordered = /^\d+\. /.test(first);
      const list = document.createElement(ordered ? 'ol' : 'ul');
      for (const line of lines) {
        const item = document.createElement('li');
        addInline(item, line.replace(/^([-*]|\d+\.) /, ''));
        list.append(item);
      }
      container.append(list);
      continue;
    }
    const paragraph = document.createElement('p');
    addInline(paragraph, lines.join(' '));
    container.append(paragraph);
  }
}

function fillList(id, values) {
  const list = $(id);
  list.replaceChildren();
  for (const value of values) list.append(textElement('li', value));
}

function showResult(result) {
  lastResult = result;
  $('activity').hidden = true;
  $('result').hidden = false;
  $('outputState').textContent = 'DRAFT COMPLETE';
  $('resultMode').textContent = result.mode === 'demo' ? 'SAMPLE WORKFLOW' : `AI WORKFLOW · ${result.model}`;
  $('resultHeading').textContent = result.mode === 'demo' ? 'Your sample draft is ready.' : (result.review.approved ? 'Your draft is ready.' : 'Your draft needs a final look.');
  $('scoreBadge').hidden = result.mode === 'demo';
  $('scoreValue').textContent = `${result.review.score}/100`;
  $('resultDisclaimer').textContent = result.mode === 'demo'
    ? 'Template preview based on your brief. It changes with your settings, but it is not AI-written and its claims need checking before use.'
    : 'The editor checked the writing brief, but facts and sources still need your review before publishing.';
  $('wordCountLabel').textContent = `${result.article.trim().split(/\s+/).length} words · ${result.revisionCount} revision${result.revisionCount === 1 ? '' : 's'}`;
  renderMarkdown(result.article);
  $('planTitle').textContent = result.plan.workingTitle;
  $('planAngle').textContent = result.plan.angle;
  fillList('planOutline', result.plan.outline.map(item => `${item.heading} — ${item.notes}`));
  $('reviewSummary').textContent = result.mode === 'demo' ? 'Sample checklist completed' : (result.review.approved ? 'Approved by the editor' : 'The editor recommends another pass');
  fillList('reviewNotes', [...result.review.strengths.map(x => `Strength: ${x}`), ...result.review.fixes.map(x => `To improve: ${x}`)]);
  fillList('titleOptions', result.packaging.titles);
  fillList('hookOptions', result.packaging.hooks);
  switchTab('article');
}

function applyBrief(brief) {
  for (const key of ['topic', 'audience', 'tone', 'goal', 'mustInclude', 'wordCount']) {
    if (brief[key] !== undefined) $(key).value = String(brief[key]);
  }
}

function addChatMessage(kind, message, pending = false) {
  const bubble = document.createElement('div');
  bubble.className = `chat-message ${kind}-message${pending ? ' pending' : ''}`;
  bubble.textContent = message;
  $('chatMessages').append(bubble);
  $('chatMessages').scrollTop = $('chatMessages').scrollHeight;
  return bubble;
}

function setChatBusy(busy) {
  chatBusy = busy;
  chatInput.disabled = busy;
  chatSendButton.disabled = busy;
  for (const button of document.querySelectorAll('[data-chat-prompt]')) button.disabled = busy;
}

function updateChatMode() {
  const live = modeSelect.value === 'live';
  $('assistantMode').textContent = live ? 'AI CONNECTED' : 'SAMPLE TASK MODE';
  $('chatNote').textContent = live
    ? 'The assistant uses the server AI key to plan writing actions. Your key stays on the server.'
    : 'Sample task mode uses local commands and templates. AI actions need a server API key.';
}

async function sendChat(message) {
  if (chatBusy || controller) return;
  const requestText = message.trim();
  if (!requestText) return;
  addChatMessage('user', requestText);
  chatInput.value = '';
  const pending = addChatMessage('assistant', 'Working on that…', true);
  const earlyCopy = /^\s*(?:please\s+)?copy\b/i.test(requestText) && lastResult && navigator.clipboard?.writeText
    ? navigator.clipboard.writeText(lastResult.article).then(() => true, () => false)
    : null;
  setChatBusy(true);
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: requestText, brief: getBrief(), article: lastResult?.article || '', mode: modeSelect.value })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
    applyBrief(data.brief);
    if (data.result) {
      $('emptyState').hidden = true;
      showResult(data.result);
      $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (data.brief && lastResult && JSON.stringify(data.brief) !== JSON.stringify(lastResult.brief)) {
      $('outputState').textContent = 'BRIEF UPDATED';
    }
    let reply = data.reply;
    if (data.clientAction === 'copy') {
      const copied = earlyCopy ? await earlyCopy : (navigator.clipboard?.writeText ? await navigator.clipboard.writeText(lastResult.article).then(() => true, () => false) : false);
      reply = copied ? 'Copied the current draft to your clipboard.' : 'Clipboard access was blocked. Use the Copy Markdown button beside the article.';
    }
    if (data.clientAction === 'download') {
      $('downloadButton').click();
      reply = 'Started the Markdown download for the current draft.';
    }
    pending.textContent = reply;
  } catch (error) {
    pending.textContent = error.message || 'The assistant could not complete that task.';
  } finally {
    pending.classList.remove('pending');
    $('chatMessages').scrollTop = $('chatMessages').scrollHeight;
    setChatBusy(false);
    chatInput.focus({ preventScroll: true });
  }
}

function switchTab(name) {
  const article = name === 'article';
  $('articlePanel').hidden = !article;
  $('processPanel').hidden = article;
  $('articleTab').classList.toggle('active', article);
  $('processTab').classList.toggle('active', !article);
  $('articleTab').setAttribute('aria-selected', String(article));
  $('processTab').setAttribute('aria-selected', String(!article));
}

function handleEvent(event) {
  if (event.type === 'stage') updateStage(event);
  if (event.type === 'result') showResult(event.data);
  if (event.type === 'error') throw new Error(event.message);
}

async function readEvents(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split('\n\n');
    buffer = frames.pop();
    for (const frame of frames) {
      const line = frame.split('\n').find(part => part.startsWith('data: '));
      if (line) handleEvent(JSON.parse(line.slice(6)));
    }
  }
  if (!lastResult) throw new Error('The connection closed before the draft was complete.');
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  if (controller) return;
  showError('');
  lastResult = null;
  initialStages();
  $('emptyState').hidden = true;
  $('result').hidden = true;
  $('activity').hidden = false;
  $('activityTitle').textContent = 'Putting the pieces together';
  $('outputState').textContent = 'IN PROGRESS';
  controller = new AbortController();
  setBusy(true);
  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: modeSelect.value, brief: getBrief() }),
      signal: controller.signal
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || `Request failed (${response.status}).`);
    }
    await readEvents(response);
  } catch (error) {
    const message = error.name === 'AbortError' ? 'Generation was cancelled.' : error.message;
    showError(message);
    $('activity').hidden = true;
    $('outputState').textContent = 'PLEASE TRY AGAIN';
    if (!lastResult) $('emptyState').hidden = false;
  } finally {
    controller = null;
    setBusy(false);
  }
});

cancelButton.addEventListener('click', () => controller?.abort());
chatForm.addEventListener('submit', event => {
  event.preventDefault();
  sendChat(chatInput.value);
});
chatInput.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
});
for (const button of document.querySelectorAll('[data-chat-prompt]')) {
  button.addEventListener('click', () => sendChat(button.dataset.chatPrompt));
}
modeSelect.addEventListener('change', () => {
  setBusy(false);
  updateChatMode();
  formNote.textContent = modeSelect.value === 'live'
    ? 'AI mode uses the server’s API key. The key is never sent to your browser.'
    : 'Sample mode uses your brief to build a template preview. It works without an API key and does not use AI.';
});
$('articleTab').addEventListener('click', () => switchTab('article'));
$('processTab').addEventListener('click', () => switchTab('process'));
$('copyButton').addEventListener('click', async () => {
  if (!lastResult) return;
  try {
    await navigator.clipboard.writeText(lastResult.article);
    $('copyButton').textContent = 'Copied!';
    setTimeout(() => { $('copyButton').textContent = 'Copy Markdown'; }, 1800);
  } catch { showError('Copy failed. Use Download .md instead.'); }
});
$('downloadButton').addEventListener('click', () => {
  if (!lastResult) return;
  const blob = new Blob([lastResult.article], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'draftroom-article.md';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

fetch('/api/config').then(response => response.json()).then(config => {
  if (config.aiAvailable) {
    modeSelect.options[1].disabled = false;
    modeSelect.value = 'live';
    $('modeText').textContent = `AI CONNECTED · ${config.model}`;
    formNote.textContent = 'AI mode uses the server’s API key. The key is never sent to your browser.';
  } else {
    $('modeText').textContent = 'SAMPLE MODE READY';
  }
  updateChatMode();
  setBusy(false);
}).catch(() => {
  $('modeText').textContent = 'SAMPLE MODE READY';
  updateChatMode();
  setBusy(false);
});
