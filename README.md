# Workshop Planning Agent

**Hacktoberfest Hack Day - NIAT-ADYPU · NIAT × Hacktoberfest 2026**

**Author:** Suraj Balasaheb Khanase

**Repository:** <https://github.com/cyber-suraj/workshop-planning-agent>

A bounded, local AI agent for workshop budgeting and equipment checks. The
language model only chooses actions; Python controls tool availability,
validates arguments, performs exact arithmetic, and owns all inventory facts.

## Problem

Workshop organizers need to answer two high-stakes questions before committing
to an event:

1. Will the planned attendance and daily costs fit the available budget?
2. Are all required equipment categories actually available?

General-purpose chatbots can produce plausible but incorrect arithmetic or
resource claims. This project separates language understanding from exact
calculations and trusted inventory lookups so the final answer is grounded in
deterministic tool results.

## Solution

The user describes the workshop in natural language. A local
`llama3.1:8b` model, served by Ollama, selects the next approved tool. The
Python host executes that tool inside strict security gates and returns the
JSON result to the model for a final, grounded summary.

The same workflow is available through a polished local web console and the
original command-line runner. The browser interface streams each host event
over NDJSON, so the tool trace, budget position, inventory board, and final
brief appear as the agent runs.

The demonstrated scenario is a two-day workshop for 30 students at INR 200 per
person per day, with a budget of INR 15,000. The agent verifies projector,
Wi-Fi, whiteboard, laptops, and microphone availability.

## Browser interface

![Workshop Agent web console showing a verified live run](docs/screenshots/web-ui-results.png)

The interface is served by Flask on `127.0.0.1` and uses only local, same-origin
HTML, CSS, and JavaScript. It includes:

- A one-run-at-a-time console with live status, elapsed time, and a streamed
  tool trace.
- A budget gauge populated exclusively from `calculate_budget`.
- An available/missing equipment board populated exclusively from
  `check_resources`.
- The model's grounded summary with copy-to-clipboard support.
- Explicit blocked/error states when any host guardrail stops the run.
- Responsive layouts for desktop and mobile.

## Key features

- Exact INR budgeting with over-budget detection.
- Inventory checks with aliases such as `beamer`, `WIFI`, and `notebooks`.
- Deterministic facts; the model never performs the arithmetic or invents stock.
- Strict allowlist, workflow-order lock, signature validation, and safe
  exception handling.
- Fail-safe termination on malformed or repeated tool calls.
- Streaming web console with a visible, auditable tool trace.
- Fully local model execution at `http://localhost:11434`; no cloud API keys.
- No frontend build step, package manager, CDN, or external asset requests.

## Architecture

```text
Browser (HTML/CSS/JS)
    |
    |  POST /api/plan  (NDJSON progress stream)
    v
Flask host (web_app.py) -- request validation, run lock, security headers
    |
    v
Bounded agent (app.py) -- system prompt + SKILL.md; one allowed tool at a time
    |
    v
Ollama (llama3.1:8b)
    |
    +-- tool request --> Gate 1: allowlist + workflow order
                         |
                         +--> Gate 2: argument dict + signature validation
                              |
                              +--> Gate 3: guarded execution in tools.py
                                   |
                                   +--> JSON result appended as role: tool
    |
    +-- no tool request --> final answer --> summary card
```

The workflow is locked to `calculate_budget` followed by `check_resources`.
Execution is capped at five model turns. Requesting multiple tools, an unknown
tool, a repeated/out-of-order tool, or retrying after an error stops the run.

The web host adds presentation-only event callbacks to `run_agent`. Those
callbacks receive `session`, `status`, `tool_call`, `tool_result`, `guardrail`,
and `error` events for the browser. They cannot alter tool execution, bypass a
gate, or change the final string returned to the command-line runner.

## Tech stack

| Component | Technology |
| --- | --- |
| Language model | `llama3.1:8b` via Ollama |
| Local LLM client | `ollama` Python SDK 0.6.3 |
| Host application | Python 3.10+ |
| Deterministic tools | Python standard library |
| Web host | Flask 3.1.3 |
| Interface | Responsive browser console + command-line runner |
| Browser code | Vanilla HTML, CSS, and JavaScript; no build step |
| Verification | `demo_tools.py`, `unittest`, and live browser runs |
| Regression tests | `tests/` with mocked agent/host checks |

## Files

| File | Purpose |
| --- | --- |
| `app.py` | Host agent, tool gates, Ollama loop, and final dispatch |
| `web_app.py` | Flask routes, NDJSON stream, health check, and web security headers |
| `index.py` | Vercel entrypoint that exposes the Flask `app` |
| `templates/index.html` | Server-rendered web interface shell |
| `public/app.js` | Streaming client, live trace, result rendering, and UI state |
| `public/styles.css` | Responsive dark-forest design system |
| `vercel.json` | Vercel function duration configuration |
| `.python-version` | Python runtime version used by Vercel |
| `tools.py` | Integer-guarded budget arithmetic and inventory lookup |
| `SKILL.md` | Behavioral contract loaded into the system prompt |
| `demo_tools.py` | Deterministic tool verification, independent of the LLM |
| `tests/` | Agent streaming, gate, request-validation, and security-header tests |
| `DEMO.md` | Verified live-run transcript, browser evidence, and final summary |
| `docs/screenshots/` | Browser evidence from the live verification runs |
| `requirements.txt` | Pinned Python dependencies |
| `SUBMISSION.md` | Submission details and compliance checklist |
| `LICENSE` | MIT License |
| `CONTRIBUTING.md` | Setup, contribution workflow, and AI disclosure rules |
| `CODE_OF_CONDUCT.md` | Project-level collaboration and reporting expectations |
| `.gitignore` | Local environments, caches, and secrets |

## Setup

Requires Python 3.10+ and a local
[Ollama](https://ollama.com/download) installation.

Clone the public repository:

```powershell
git clone https://github.com/cyber-suraj/workshop-planning-agent.git
cd workshop-planning-agent
```

### Windows PowerShell

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
ollama pull llama3.1:8b
```

If `ollama` is not recognised in an already-open terminal, restart the terminal
or use `%LOCALAPPDATA%\Programs\Ollama\ollama.exe` directly. On this machine the
Ollama 0.40.11 service is installed and `llama3.1:8b` is already pulled.

### Linux / macOS

```bash
python3 -m venv venv
source venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
ollama pull llama3.1:8b
```

Keep Ollama running at `http://localhost:11434` (the default).

## Deploy on Vercel

Vercel can host the Flask console, but it cannot run Ollama. A deployment must
point at an Ollama endpoint that Vercel can reach:

| Environment variable | Purpose |
| --- | --- |
| `OLLAMA_HOST` | Remote Ollama base URL. For Ollama Cloud use `https://ollama.com`. |
| `OLLAMA_MODEL` | Model available on that host. For Ollama Cloud use a hosted name such as `gpt-oss:20b`. |
| `OLLAMA_API_KEY` | Bearer token for hosts that require authentication. |

Set them through the Vercel dashboard or CLI, then deploy:

```powershell
npx vercel env add OLLAMA_HOST production
npx vercel env add OLLAMA_MODEL production
npx vercel env add OLLAMA_API_KEY production
npx vercel --prod
```

The Vercel entrypoint is `index.py`; browser assets live in `public/` and are
served by the Vercel CDN. The agent run is capped by `maxDuration` in
`vercel.json` and is one request per browser session.

A deployment is publicly reachable by default. Enable Vercel Deployment
Protection, or add your own access control, before sharing `/api/plan`: every
run consumes inference on the configured Ollama host.

## Demo

Verify deterministic tools first:

```powershell
python demo_tools.py
```

Expected output:

```text
All direct tool checks passed successfully.
```

Run the regression suite:

```powershell
python -m unittest discover -s tests -t . -v
```

Expected result:

```text
Ran 17 tests in ...s

OK
```

The suite covers ordered agent events, CLI behavior without a callback, blocked
tool calls, argument failures, NDJSON streaming, blocked-result classification,
request limits, health, and security headers.

### Browser interface

Start the local web host:

```powershell
python web_app.py
```

Open <http://127.0.0.1:5000> and select **Run planning agent**. The sample
brief is preloaded. The interface streams the guarded tool trace and fills the
budget, inventory, and final-summary panels as events arrive. Local inference
typically takes 30–60 seconds after the model is loaded.

The host binds to `127.0.0.1`, not the public internet. Keep the terminal
running while using the interface. Press `Ctrl+C` to stop it.

### Command line

Run the original CLI:

```powershell
python app.py
```

Expected result for the sample request:

- Estimated cost: INR 12,000
- Budget: INR 15,000
- Remaining budget: INR 3,000 (within budget)
- Available: projector, Wi-Fi, whiteboard, laptops
- Missing: microphones

`microphones` are intentionally absent from the local inventory, so the agent
must report them as missing rather than invent availability.

### Live verification

Verified end to end on 26 October 2026 with Ollama 0.40.11, Python 3.14.7,
Flask 3.1.3, and `llama3.1:8b`:

- All 17 regression tests pass.
- Both tool calls executed in the required order in the CLI.
- The model's final summary used the deterministic results and reported
  microphones as missing.
- The CLI run was repeated twice with the same results.
- The Flask interface completed two additional live runs (53s and 51s), with
  the same INR 12,000 cost, INR 3,000 remaining, four available resources, and
  one missing resource.
- Browser checks at 1440px and 390px showed no horizontal overflow or console
  errors.

Evidence:

- Full CLI transcript: [DEMO.md](DEMO.md).
- Desktop result view:
  [docs/screenshots/web-ui-results.png](docs/screenshots/web-ui-results.png).
- Live workspace:
  [docs/screenshots/web-ui-workspace.png](docs/screenshots/web-ui-workspace.png).
- Mobile result view:
  [docs/screenshots/web-ui-mobile.png](docs/screenshots/web-ui-mobile.png).

## Security and responsible AI

- The `TOOLS` dictionary is the only allowlist; there is no dynamic dispatch or
  `eval()`.
- Only the next workflow tool is exposed to the model.
- `inspect.signature(...).bind()` rejects missing, extra, or malformed arguments.
- `tools.py` rejects booleans and non-integer numeric inputs even though `bool`
  is a subclass of `int`.
- Tool exceptions become structured error payloads and terminate the run.
- `MAX_STEPS = 5` bounds model and tool execution.
- The LLM runs locally and has no access to cloud services, credentials, or
  arbitrary functions.
- The web host binds to localhost, rejects malformed/oversized requests, limits
  input to 2,000 characters, permits one active run, and sends restrictive
  security headers including a same-origin Content Security Policy.
- Automated tests cover both the protected agent path and the web streaming
  contract, including blocked-result classification and request-size limits.
- The interface loads no CDN assets, analytics, fonts, or third-party scripts.
- The agent logs tool names and arguments for traceability. Do not submit
  student PII or confidential data as test input.

The model can still phrase a summary incorrectly; the host ensures that all
budget and inventory facts come from the deterministic tools. An operator should
review the final response and rerun `demo_tools.py` when changing tool logic.

## Originality and attribution

This repository was created for the event submission. The initial
implementation and documentation were produced with AI-assisted development
using OpenCode, then verified through the deterministic test suite, mocked
host-gate checks, and live Ollama runs. The participant must review the code,
understand the implementation, and keep this disclosure accurate before
submission.

No pre-existing project source code is included. Any libraries used retain their
original licenses. See [SUBMISSION.md](SUBMISSION.md) for the submission
checklist, solo contribution record, and verification status.

## Open-source focus

The project is built on open-source technologies and is released under the
[MIT License](LICENSE). Contributions are welcome under the guidelines in
[CONTRIBUTING.md](CONTRIBUTING.md), and all participation is covered by
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

Copyright (c) 2026 Suraj Balasaheb Khanase. Distributed under the
[MIT License](LICENSE).

## Event compliance

This project was built for **Hacktoberfest Hack Day - NIAT-ADYPU**, part of
**NIAT × Hacktoberfest 2026**. The event rules require eligibility,
registration, a public repository, original-work disclosure, responsible AI use,
and a completed submission before the organizer deadline. The project-level
checklist is in [SUBMISSION.md](SUBMISSION.md); registration, team-size limits,
judging, and deadlines remain the team's responsibility.
