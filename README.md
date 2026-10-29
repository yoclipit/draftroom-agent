# Draftroom

Draftroom is a web app that turns a short writing brief into a planned, reviewed blog article. Its agent workflow follows a **plan → write → review → revise → package** cycle. A sample mode makes the flow easy to demonstrate without an API key; AI mode calls the OpenAI API from the server.

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

The app streams each stage to the browser as Server Sent Events. The result includes the article, editor notes, outline, title ideas, and a Markdown download. Sample mode runs illustrative local content through the same visible stages; it is clearly labeled as a simulation.

## Project report

The [LaTeX source](report/project_report.tex) and [compiled PDF](output/pdf/project_report.pdf) explain the architecture, implementation, tests, and deployment status.

## Project structure

| File | Purpose |
| --- | --- |
| `agent.js` | Brief validation, model calls, agent prompts, review loop, sample mode |
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

1. Push this repository to GitHub.
2. In Render, create a **Blueprint** from the repository and apply `render.yaml`.
3. Set `OPENAI_API_KEY` as a secret environment variable in Render. The public site can run in sample mode without the key.
4. Open the Render URL and generate a draft.

`OPENAI_API_KEY` is listed as `sync: false` so it must be entered privately in Render. Review AI generated claims and sources before publishing an article. The editor checks the brief and writing quality; it does not independently verify facts.

## Design note

The lab example describes a planner, writer, and checker and points out that a quality loop needs an explicit stopping rule. Draftroom stops when the reviewer approves the draft or after one revision, whichever comes first.
