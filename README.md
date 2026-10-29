# Draftroom

Draftroom is a web app that turns a short writing brief into a planned, reviewed blog article. Its agent workflow follows a **plan → write → review → revise → package** cycle. The chat assistant can change the brief, create a draft, and copy or download it. Sample mode builds a template preview without an API key; AI mode calls the OpenAI API from the server.

**Live website:** [https://draftroom-agent.onrender.com](https://draftroom-agent.onrender.com)

## Run locally

Requires Node.js 20 or newer. The server uses Express 5.

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000). Sample mode works immediately.

To enable original AI generated articles, set an API key in the server environment before starting:

```powershell
$env:OPENAI_API_KEY = "your-key-here"
npm.cmd install
npm.cmd start
```

On macOS or Linux:

```bash
npm install
OPENAI_API_KEY="your-key-here" npm start
```

The default model is `gpt-4o-mini`. Set `OPENAI_MODEL` to use another compatible chat completion model. The API key stays on the server and is never included in browser responses or tracked files. Do not put a real key in `.env.example` or commit one to Git.

## What the agents do

1. **Planner:** turns the brief into an angle and structured outline.
2. **Writer:** writes a Markdown article from the brief and plan.
3. **Reviewer:** scores clarity, coverage, and usefulness and returns specific fixes.
4. **Reviser:** updates a rejected draft. A second review decides whether to stop. The loop also has a hard limit of one revision.
5. **Packager:** supplies three title ideas and two opening hooks.

The app streams each stage to the browser as Server Sent Events. The result includes the article, editor notes, outline, title ideas, and a Markdown download. Sample mode responds to the topic, audience, tone, takeaway, requested points, and target length. It uses local templates and is labeled as a preview; it does not generate original AI writing or verify facts.

## Chat assistant

The chat box can carry out writing tasks. Try **“set tone to thoughtful and professional,” “include checking sources and make it shorter,” “write a 350-word draft about community gardens for local volunteers,”** or **“download the draft.”** Changes appear in the brief and generated articles appear in the draft panel. The no-key version understands a limited set of commands and uses the local template writer. It does not pretend to be an AI model.

When `OPENAI_API_KEY` is set, the chat uses a model to plan an allowed action. The server validates the plan and executes brief updates and draft generation or revision; the browser handles copy and download actions. A revision uses the current article as input and runs the writing review workflow again. The key remains on the server. Chat has no access to arbitrary websites, files, email, or system commands.

## Project report

The [LaTeX source](report/project_report.tex) and [compiled PDF](output/pdf/project_report.pdf) explain the architecture, implementation, tests, and deployment status.

## Project structure

| File | Purpose |
| --- | --- |
| `agent.js` | Brief validation, model calls, agent prompts, review loop |
| `demo.js` | Local sample preview built from every brief setting |
| `chat.js` | Chat task planning, allowed actions, and no-key commands |
| `server.js` | Express server, static files, API route, streaming, basic rate limiting |
| `public/` | Responsive web interface |
| `test/` | Agent flow and HTTP integration tests |
| `render.yaml` | Render deployment blueprint |

## Test

```bash
npm test
```

On this Windows PowerShell setup, use `npm.cmd` instead of `npm`.

The live workflow test uses a local mock API and verifies that a rejected article is revised and reviewed again. A real AI generation requires your own API key and account access.

## Deploy on Render

The app is deployed at [draftroom-agent.onrender.com](https://draftroom-agent.onrender.com) on Render's free web service plan. To deploy your own copy:

1. Push this repository to GitHub.
2. In Render, create a **Blueprint** from the repository and apply `render.yaml`.
3. For AI mode, set `OPENAI_API_KEY` as a secret environment variable in Render. The public site can run in sample mode without the key.
4. Open the Render URL and generate a draft.

The blueprint does not contain an API key. Add one privately in the Render dashboard only when AI mode is needed. Review AI generated claims and sources before publishing an article. The editor checks the brief and writing quality; it does not independently verify facts.

## Design note

The lab example describes a planner, writer, and checker and points out that a quality loop needs an explicit stopping rule. Draftroom stops when the reviewer approves the draft or after one revision, whichever comes first.
