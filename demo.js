'use strict';

const TONES = {
  'Clear and approachable': {
    title: 'a practical guide',
    opening: 'A complicated subject becomes easier when it is connected to one ordinary decision.',
    startHeading: 'Begin with a clear question',
    start: 'Start by naming the specific situation you want to improve. Keep the first step small enough to explain to someone else.',
    reviewHeading: 'Check what changed',
    review: 'Look at the result, compare it with your original goal, and adjust the next step.'
  },
  'Warm and conversational': {
    title: 'where to begin',
    opening: 'Big ideas are less intimidating when we take them one step at a time.',
    startHeading: 'Start where you are',
    start: 'Pick a familiar situation and ask what would make it a little better. You do not need a perfect plan to begin.',
    reviewHeading: 'See what feels useful',
    review: 'Talk through what happened, notice what felt awkward, and keep the parts that genuinely helped.'
  },
  'Thoughtful and professional': {
    title: 'a considered approach',
    opening: 'A useful approach begins with a clear purpose, relevant context, and a willingness to evaluate the result.',
    startHeading: 'Define the objective',
    start: 'Identify the decision at hand, the constraints around it, and the standard you will use to assess progress.',
    reviewHeading: 'Evaluate the outcome',
    review: 'Compare the outcome with the stated objective, examine the tradeoffs, and document what should change.'
  },
  'Bold and energetic': {
    title: 'put the idea to work',
    opening: 'An idea gains momentum when it moves from a vague ambition to a concrete action.',
    startHeading: 'Make the first move',
    start: 'Choose one clear target and take a small step today. Momentum comes from testing an idea in the real world.',
    reviewHeading: 'Learn fast and improve',
    review: 'Check the result, keep what worked, and change what held you back before the next attempt.'
  }
};

function stripEnd(text) {
  return text.trim().replace(/[.!?]+$/, '');
}

function sentence(text) {
  const value = stripEnd(text);
  return value ? `${value[0].toUpperCase()}${value.slice(1)}.` : '';
}

function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function focusItems(text) {
  return text.split(/[,;]+|\s+and\s+/i).map(item => stripEnd(item).trim()).filter(Boolean).slice(0, 5);
}

function focusParagraph(item, audience, topic) {
  const lower = item.toLowerCase();
  const readers = audience.toLowerCase();
  const subject = item[0].toUpperCase() + item.slice(1);
  if (/accur|verif|fact|source|citation/.test(lower)) {
    return `${subject} matters because a polished explanation can still be wrong. ${audience} should compare important claims with a trustworthy source, open any cited material, and separate confirmed details from assumptions before using the result.`;
  }
  if (/priv|personal|data|security|confidential/.test(lower)) {
    return `${subject} starts with deciding what information is actually needed. Avoid sharing private details, other people's work, or identifying information when a made-up example will do. This gives ${readers} a safer way to explore ${topic.toLowerCase()}.`;
  }
  if (/learn|study|practice|education|skill/.test(lower)) {
    return `${subject} works best when the reader does part of the task independently. Use a tool or resource to practice, then close it and explain the idea in your own words. That check shows ${readers} what they understand and what still needs work.`;
  }
  return `${subject} deserves a concrete example rather than a passing mention. For ${readers}, the useful question is how this point changes a real choice about ${topic.toLowerCase()}. Try one small action, observe the result, and revise the approach if it misses the mark.`;
}

function createDemoResult(brief) {
  const topic = stripEnd(brief.topic);
  const audience = stripEnd(brief.audience);
  const readers = audience.toLowerCase();
  const goal = sentence(brief.goal);
  const tone = TONES[brief.tone] || TONES['Clear and approachable'];
  const focus = focusItems(brief.mustInclude);
  const plan = {
    workingTitle: `${topic}: ${tone.title}`,
    angle: `${goal} Written for ${readers} in a ${brief.tone.toLowerCase()} voice.`,
    outline: [
      { heading: tone.startHeading, notes: `Give ${readers} a manageable first step related to ${topic.toLowerCase()}.` },
      { heading: focus.length ? 'Put the key points into practice' : 'Make the idea useful', notes: focus.length ? `Cover ${focus.join(', ')} with examples.` : 'Connect the idea to a real situation.' },
      { heading: tone.reviewHeading, notes: 'Compare the result with the goal and suggest a next step.' }
    ]
  };

  const introduction = `${tone.opening} This article explores ${topic.toLowerCase()} for ${readers}. The goal is clear: ${goal}`;
  const start = brief.wordCount === 350
    ? `${tone.start} For ${readers}, choose one real task and decide what a useful outcome would look like.`
    : `${tone.start} For ${readers}, this means choosing one real task, noting the current approach, and deciding what a useful outcome would look like. A narrow starting point makes the rest of the discussion easier to test and explain.`;
  const aiExample = /\bAI\b|artificial intelligence/i.test(topic) && /student|learner|school|college/i.test(audience)
    ? 'For example, a student might ask an AI tool to explain a difficult concept, then close the chat and restate the explanation from memory. Comparing that answer with course material turns the tool into a study aid instead of a substitute for learning.'
    : `For example, choose a small situation where ${topic.toLowerCase()} affects a decision. Write down what you expect, try one reasonable change, and record what actually happens. This gives ${readers} a specific example to discuss instead of a broad promise.`;
  const focusText = focus.length
    ? focus.map(item => `### ${item[0].toUpperCase()}${item.slice(1)}\n\n${focusParagraph(item, audience, topic)}`).join('\n\n')
    : `Pick one aspect of ${topic.toLowerCase()} that the reader can act on this week. Explain the choice, describe the first step, and give a way to tell whether that step helped.`;
  const reviewText = `${tone.review} Ask whether the example actually supports the goal: ${goal} If the answer is unclear, narrow the claim, add a better example, or choose a simpler action. ${audience} should be able to explain both the benefit and the limitation of the approach.`;
  const conclusion = `The next step is to apply one idea from this guide to a real situation. Keep the goal in view, pay attention to ${focus.length ? focus[0].toLowerCase() : 'the outcome'}, and make a small improvement based on what you learn. That helps ${readers} put the idea into practice.`;

  const sections = [
    `# ${plan.workingTitle}`,
    introduction,
    `## ${plan.outline[0].heading}`,
    start,
    ...(brief.wordCount === 350 ? [] : [aiExample]),
    `## ${plan.outline[1].heading}`,
    focusText,
    `## ${plan.outline[2].heading}`,
    reviewText
  ];
  const optional = [
    `A useful test should have a beginning and an end. Decide what you will try, how long you will try it, and what evidence would count as improvement. For ${readers}, this keeps ${topic.toLowerCase()} tied to an observable result rather than a vague impression.`,
    `It also helps to name a likely obstacle. Time, access to information, and competing priorities can all affect an otherwise promising idea. Write down one adjustment you could make if the first attempt does not work, then compare that adjustment with the original goal.`,
    `Invite another person to challenge the explanation. Ask which step is confusing, which claim needs support, and whether the example feels realistic for ${readers}. A second perspective often reveals assumptions that the first draft leaves hidden.`,
    `Keep the language proportional to the evidence. If the example shows a small improvement, describe it as a small improvement. Avoid presenting one trial as proof of a universal result, and make clear where more information would be useful.`,
    `A repeatable process is more valuable than a one-time success. After the first trial, keep the parts that worked and change only one part at a time. That makes it easier to understand why the next result differs from the last one.`,
    `Finally, decide what the reader can do without special tools or expert knowledge. A practical recommendation should fit an ordinary day. If a step is too demanding, scale it down until ${readers} can try it and learn from the outcome.`,
    `Make the next step specific to the audience. ${audience} may have different time, resources, and priorities than another group. Describe the situation plainly, then explain why the suggested action fits those circumstances.`,
    `Consider what success would look like after a week. The answer could be a clearer decision, a completed task, or a question that needs more research. Use that result to choose one realistic follow-up action.`,
    `If the first example is too easy, test the same idea in a more demanding setting. Notice which part still works and which part depends on the original conditions. This keeps the recommendation honest and adaptable.`,
    `End by returning to the reader's purpose: ${goal} A strong takeaway gives ${readers} a reason to act and a simple way to judge whether the action helped.`
  ];
  const extras = [];
  for (const paragraph of optional) {
    const current = wordCount([...sections, ...(extras.length ? ['## Go a little deeper', ...extras] : []), conclusion].join('\n\n'));
    if (current >= brief.wordCount - 20) break;
    extras.push(paragraph);
  }
  if (extras.length) sections.push('## Go a little deeper', ...extras);
  sections.push('## A useful next step', conclusion);
  const article = sections.join('\n\n');
  const reviewNotes = focus.length ? `Covers the requested points: ${focus.join(', ')}.` : 'Gives a clear first step.';
  const review = {
    approved: true,
    score: 82,
    strengths: [`Written for ${readers}`, reviewNotes],
    fixes: [`Add verified, topic-specific evidence about ${topic.toLowerCase()} before publishing.`]
  };
  const packaging = {
    titles: [plan.workingTitle, `${topic}: what ${readers} should know`, `A fresh look at ${topic.toLowerCase()}`],
    hooks: [tone.opening, `What would change if ${readers} took one practical step toward ${topic.toLowerCase()} today?`]
  };
  return { mode: 'demo', brief, plan, article, review, packaging, revisionCount: 0, model: null };
}

async function runDemo(brief, emit) {
  const result = createDemoResult(brief);
  const pause = () => new Promise(resolve => setTimeout(resolve, 400));
  emit({ type: 'stage', stage: 'plan', status: 'running', detail: 'Finding a useful angle and structure' });
  await pause();
  emit({ type: 'stage', stage: 'plan', status: 'done', data: result.plan });
  emit({ type: 'stage', stage: 'draft', status: 'running', detail: 'Turning the outline into an article' });
  await pause();
  emit({ type: 'stage', stage: 'draft', status: 'done', detail: `${wordCount(result.article)} words drafted` });
  emit({ type: 'stage', stage: 'review', status: 'running', detail: 'Checking clarity, coverage, and usefulness' });
  await pause();
  emit({ type: 'stage', stage: 'review', status: 'done', data: result.review, pass: 1 });
  emit({ type: 'stage', stage: 'package', status: 'running', detail: 'Creating title and opening options' });
  await pause();
  emit({ type: 'stage', stage: 'package', status: 'done', data: result.packaging });
  return result;
}

module.exports = { createDemoResult, runDemo };
