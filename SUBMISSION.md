# Workshop Planning Agent — Submission

**Event:** Hacktoberfest Hack Day - NIAT-ADYPU

**Initiative:** NIAT × Hacktoberfest 2026

This file collects the materials required by the event submission rules. The
repository, implementation, license, and demo are complete. External organizer
actions, final review, and actual form submission remain in the checklists
below.

## Event context

Hacktoberfest 2026 at NIAT-ADYPU is an open-source hack day focused on moving
from individual coding to collaborative, real-world software development. This
project was built for that event and is intended to be shared publicly so that
other contributors can inspect, run, and improve it.

## Short submission description

Workshop Planning Agent is a local AI assistant for event organizers. It turns a
natural-language workshop request into an exact budget calculation and a
verified equipment-availability report. A local Llama 3.1 model handled through
Ollama selects the next approved action, while a Python host enforces a strict
two-step workflow, validates every argument, performs deterministic arithmetic,
and blocks unknown, repeated, or malformed tool calls. The results are presented
in a responsive, streaming browser console that exposes each tool call, the
budget position, the equipment board, and the final grounded summary. For the
sample two-day, 30-student workshop with a INR 15,000 budget, the deterministic
tools compute a INR 12,000 estimate, INR 3,000 remaining, and missing
microphones. The project runs without cloud API keys and keeps all budget and
inventory facts inside deterministic Python tools.

## Project title and problem statement

**Title:** Workshop Planning Agent

**Problem statement:** Workshop organizers must validate a budget and confirm
equipment availability before committing to an event. General-purpose language
models can hallucinate arithmetic or inventory facts. This project builds a
bounded local AI agent that reasons about the request while Python performs
exact calculations and trusted resource checks.

## Solution overview and key features

The agent combines a local `llama3.1:8b` model with deterministic Python tools:

- `calculate_budget` computes exact INR totals and budget status.
- `check_resources` resolves common aliases and reports unavailable items.

The host exposes only one workflow tool at a time, validates arguments against
the tool signature, and terminates on errors instead of permitting blind
retries. The model receives structured JSON tool results and writes the final
summary.

The frontend is a local Flask application with server-rendered HTML and vanilla
CSS/JavaScript, requiring no build step or cloud assets. It streams NDJSON events
from `POST /api/plan` so the interface can show the live tool trace, exact budget
figures, resource chips, and final summary as soon as each verified result is
available.

Key features:

- Local-only inference through Ollama.
- Streaming browser console with a visible, auditable tool trace.
- Exact integer arithmetic with boolean rejection.
- Deterministic allowlist and workflow lock.
- Graceful failure when the model server is unavailable.
- Explicit blocked/error states in the UI when a guardrail stops a run.
- Reproducible tool verification without an LLM.
- Responsive desktop and mobile layouts with no external frontend assets.

## Source-code repository

**Public repository URL:**
<https://github.com/cyber-suraj/workshop-planning-agent>

Repository description: "Bounded local LLM agent for deterministic workshop
budgeting and equipment checks."

## Working prototype / demo

Prerequisites: Python 3.10+ and Ollama with `llama3.1:8b`.

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
ollama pull llama3.1:8b
```

Verify deterministic logic:

```powershell
python demo_tools.py
# All direct tool checks passed successfully.
```

Start the browser prototype:

```powershell
python web_app.py
```

Open <http://127.0.0.1:5000> and select **Run planning agent**. The sample brief
is preloaded. The interface streams the guarded workflow and renders the budget,
inventory, and summary panels from the verified tool results.

The original CLI remains available:

```powershell
python app.py
```

For the sample workshop, the deterministic results are:

- Estimated cost: INR 12,000
- Remaining budget: INR 3,000
- Availability: projector, Wi-Fi, whiteboard, and laptops; microphones missing

Visual evidence:

- [Desktop live result](docs/screenshots/web-ui-results.png)
- [Live run workspace](docs/screenshots/web-ui-workspace.png)
- [Mobile live result](docs/screenshots/web-ui-mobile.png)

A verified terminal transcript with the exact tool calls and model response is
available in [DEMO.md](DEMO.md). It documents the two CLI runs, the two browser
runs, and the captured screenshots.

## README and technology stack

Setup instructions, architecture, expected output, and the technology stack are
documented in [README.md](README.md). The stack is Python 3.10+, Flask 3.1.3,
the Ollama Python SDK, `llama3.1:8b` served locally, and vanilla browser
HTML/CSS/JavaScript with no build step. Regression tests use Python's built-in
`unittest` runner and require no additional dependency.

## Verification status

- [x] `python demo_tools.py` passes for budget, deficit, alias, duplicate,
  boolean, range, non-string, and empty-input cases.
- [x] The 17-test regression suite passes with
  `python -m unittest discover -s tests -t . -v`.
- [x] Host gates were exercised with a fake Ollama client: ordered happy path,
  incomplete workflow, multiple tool calls, unknown tool, out-of-order tool,
  and missing arguments.
- [x] The web stream contract was exercised with a mocked agent: accepted
  session, agent events, final and blocked-result classifications; malformed
  and oversized requests; concurrent-run rejection; health states; and
  security headers.
- [x] Ollama function schemas were generated locally to confirm the exposed
  parameter types and descriptions.
- [x] Full live CLI run completed with Ollama 0.40.11, `llama3.1:8b`, and the
  final summary on 26 October 2026. The correct result was reproduced twice;
  see [DEMO.md](DEMO.md).
- [x] The Flask browser interface completed two additional live runs on
  26 October 2026 (53s and 51s), with the same correct budget and inventory
  results. The live trace, gauge, resource chips, and final summary rendered
  without console errors.
- [x] Responsive browser checks at 1440px desktop and 390px mobile showed no
  horizontal overflow.
- [ ] The participant has reviewed the live output, README, and submission
  files.

## Team and contributions

**Team name:** Solo — Suraj Balasaheb Khanase

**Team size:** 1 participant (solo submission)

**Participant and contribution:**

| Member | Responsibilities / contribution |
| --- | --- |
| Suraj Balasaheb Khanase | Project concept and requirements, environment setup, live-run verification, and submission preparation. The implementation and documentation were produced with disclosed AI assistance. |

## Originality and pre-existing work

- The implementation in this repository was created for this submission.
- The original problem brief and high-level design were provided by the
  participant.
- No pre-existing project source code is included.
- The frontend was created for this project using local HTML, CSS, and
  JavaScript. It uses no template, UI framework, CDN, or third-party browser
  library.
- Third-party libraries are declared in [requirements.txt](requirements.txt) and
  retain their original licenses.
- AI assistance must remain disclosed. See the next section.

The repository was created from scratch for this submission. No undisclosed
project template, repository, or pre-existing source code has been added. The
problem brief and high-level design were supplied by the participant.

## Responsible AI and verification

AI-assisted development was used for the initial implementation, documentation,
and test scaffolding. This must not be represented as unaided work.

Before submission, the participant must:

- Read and understand `app.py`, `tools.py`, and `SKILL.md`.
- Run `python demo_tools.py` successfully.
- Exercise the live agent with Ollama and review the final summary.
- Confirm that no secrets, credentials, personal data, or confidential workshop
  records are committed.
- Confirm that the model is run locally and that no unexpected external egress
  has been introduced.
- Recheck any AI-generated claims in the README and submission against the code.

## Open-source and licensing

**Public repository:**
<https://github.com/cyber-suraj/workshop-planning-agent>

**License:** MIT License. Copyright (c) 2026 Suraj Balasaheb Khanase. See
[LICENSE](LICENSE).

The license is a permissive open-source license that allows reuse,
modification, and redistribution with attribution. The participant reviewed
this choice for the solo submission.

Open-source readiness:

- [x] Repository is public and accessible without credentials:
  <https://github.com/cyber-suraj/workshop-planning-agent>.
- [x] A `LICENSE` file is present and matches this document.
- [x] Setup and test instructions work from a clean environment.
- [x] Contribution and conduct expectations are documented in
  [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
- [x] Third-party dependency licenses remain intact.
- [x] No secrets, personal data, or local configuration are committed.

The project uses open-source technologies including Python, Flask, Ollama,
Pydantic, HTTPX, and their transitive dependencies. Those components retain
their original licenses and copyright notices.

## Security and privacy

- Tool access is restricted to the `TOOLS` allowlist.
- Arguments must be a dictionary of strings and must match the Python signature.
- The tools reject booleans, non-integers, out-of-range values, and empty input.
- Tool errors stop the run and are not sent back for automatic retries.
- The model loop is capped at five turns.
- The application calls Ollama at `localhost`; it does not use cloud inference.
- The Flask host binds to `127.0.0.1`, accepts a single active run, limits the
  workshop brief to 2,000 characters and request bodies to 16 KiB, and returns
  restrictive security headers.
- The frontend uses same-origin assets only; there are no CDN, analytics, or
  third-party script requests.
- The repository contains no API keys or personal data.

The demo and submission do not contain student names, contact details,
attendance records, credentials, or other personal information. The sample uses
only aggregate workshop figures.

## Eligibility, registration, and conduct

These are participant/organizer actions, not repository features:

- [ ] The participant is eligible under the organizer's rules.
- [ ] The official registration is complete and information is accurate.
- [ ] The submission complies with the announced team-size limit.
- [ ] The participant has read the event Code of Conduct.
- [ ] The submission is made before the announced deadline.
- [ ] The participant will follow judging and organizer instructions.
- [ ] All third-party intellectual property and licenses are respected.
- [ ] All decisions and submitted work remain the participant's own.

## Final submission checklist

- [x] Public repository URL added to the README and submission files.
- [ ] Public repository URL entered in the organizer's submission form.
- [x] Team name and member contribution completed for the solo submission.
- [x] MIT license reviewed and `LICENSE` file added.
- [x] Live browser screenshots captured and linked in the documentation.
- [x] `python demo_tools.py` passes.
- [x] `python -m unittest discover -s tests -t . -v` passes all 17 tests.
- [x] Live Ollama CLI and browser demos completed and recorded in `DEMO.md`.
- [ ] Participant has reviewed the live output and final submission.
- [ ] AI and pre-existing-work disclosures reviewed for accuracy.
- [ ] No secrets, personal data, or confidential records committed.
- [ ] Eligibility and registration confirmed.
- [ ] Event-specific judging and submission instructions reviewed.
- [ ] Submission completed before the deadline.
