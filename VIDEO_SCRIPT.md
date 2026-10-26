# Workshop Planning Agent — Demo Video Script

**Recommended length:** 2:20–2:35  
**Short cut:** 60 seconds  
**Format:** 1080p, 30 fps, MP4 (H.264), clear voiceover and burned-in captions.

The full script below is written to be read while recording. Record the
voiceover separately if possible, then cut the footage to match.

---

## Before recording

1. Confirm Ollama and the model are ready:

   ```powershell
   ollama list
   ```

   `llama3.1:8b` must appear.

2. Warm up the model so the recorded run is fast. Run the sample once before
   recording:

   ```powershell
   .\venv\Scripts\python.exe app.py
   ```

3. Start the local console:

   ```powershell
   .\venv\Scripts\python.exe web_app.py
   ```

   Open <http://127.0.0.1:5000>. The health pill should say the model is ready.

4. Check the deterministic tools and tests so the terminal clips are ready:

   ```powershell
   .\venv\Scripts\python.exe demo_tools.py
   .\venv\Scripts\python.exe -m unittest discover -s tests -t . -v
   ```

5. Close notifications, personal tabs, chat apps, and anything showing tokens,
   `.env` files, or the `.local` tunnel folder.

6. Use a clean browser window at 110–125% zoom. Record at 1080p. Keep the
   cursor movement slow and deliberate.

7. The live run can take 50–150 seconds. Record it, then speed up the waiting
   sections in editing. Keep every tool call, result, and final number on screen
   long enough to read.

---

## Full script — 2:20–2:35

### 0:00–0:12 — Hook

**Visual:** Title card with the project name. Quick cuts of the console, budget
gauge, and equipment board.

**Voiceover:**

> Every workshop starts with two risky questions. Will the budget actually cover
> everyone? And is the equipment really available? A confident chatbot answer is
> not enough.

**On-screen text:**

- Workshop Planning Agent
- Every rupee. Every resource. Verified.

---

### 0:12–0:30 — Problem

**Visual:** The sample brief on screen, then a quick shot of the terminal. Avoid
stock footage if it slows the edit down.

**Voiceover:**

> Organizers commit real money before the event. One wrong total, or one invented
> projector, can break the day. General-purpose language models are good at
> sounding right, but they cannot guarantee exact arithmetic or trusted inventory.

**On-screen text:**

- Wrong math = real cost
- Invented inventory = broken event

---

### 0:30–0:55 — Solution

**Visual:** Show `README.md`'s architecture diagram. Highlight the flow:
browser → Flask host → bounded agent → Ollama, with Python tools underneath.

**Voiceover:**

> Workshop Planning Agent separates language understanding from verification. A
> local Llama 3.1 model only chooses the next approved tool. Python performs the
> exact math, validates every argument, and owns every inventory fact.

**On-screen text:**

- The model chooses.
- Python verifies.
- Deterministic facts only.

---

### 0:55–1:15 — Guardrails

**Visual:** Show the relevant code in `app.py`: `TOOLS`, `ORDER`, `MAX_STEPS`,
`validate_args`, and `dispatch`. Highlight the lines as you mention them.

**Voiceover:**

> The workflow is locked to two steps: calculate the budget, then check
> resources. Only the next tool is exposed to the model. Three gates enforce the
> allowlist, the workflow order, and the function signature. Unknown, repeated,
> or malformed calls stop the run. The entire loop is capped at five turns.

**On-screen text:**

- Gate 1: allowlist + workflow order
- Gate 2: argument + signature validation
- Gate 3: guarded execution
- Maximum 5 model turns

---

### 1:15–2:05 — Live demo

**Visual:** The browser console. Show the preloaded sample brief, the green model
status, then click **Run planning agent**. Speed up the waiting sections in
editing. Keep the tool trace, budget numbers, inventory chips, and final summary
visible.

**Voiceover:**

> Here is the live console. The sample brief is a two-day workshop for 30
> students, with a 15,000 rupee budget, 200 rupees per person per day, and five
> resources to check. I will run it now.
>
> The model requests `calculate_budget`. The host validates the arguments, then
> deterministic Python returns 12,000 rupees estimated, 3,000 rupees remaining,
> and within budget.
>
> Next, `check_resources`. Projector, Wi-Fi, whiteboard, and laptops are
> available. Microphones are missing. The final summary is written only after
> both tools finish, and it can only use those verified facts.

**On-screen text (show each as it appears):**

- Estimated cost: INR 12,000
- Budget: INR 15,000
- Remaining: INR 3,000
- Available: projector, Wi-Fi, whiteboard, laptops
- Missing: microphones
- Final brief: grounded in tool results

**Editing note:** If the run is long, cut the idle heartbeats and show a small
"model thinking…" caption. Do not cut the tool call or tool result frames.

---

### 2:05–2:20 — Verification

**Visual:** Terminal. Run `demo_tools.py`, then the unittest command. Show the
final lines clearly.

**Voiceover:**

> The deterministic tools can be checked without the model. All direct tool
> checks pass. The regression suite covers the gates, the streaming contract,
> request validation, and security headers: 17 tests, all passing.

**On-screen text:**

- All direct tool checks passed
- 17/17 tests pass

---

### 2:20–2:35 — Close

**Visual:** Return to the completed console, then a clean end card with the
project name and links.

**Voiceover:**

> The same code runs locally and is deployed on Vercel. It is open source under
> the MIT license. Workshop Planning Agent: every rupee, every resource,
> verified.

**End card:**

- Workshop Planning Agent
- Live demo: https://workshop-planning-agent-main.vercel.app
- Code: https://github.com/dev-nandkishor/workshop-planning-agent
- Original project by Suraj Balasaheb Khanase · MIT License

---

## 60-second short cut

Use this if the submission form has a one-minute limit.

### 0:00–0:06 — Hook

> Every workshop starts with two risky questions: will the budget cover everyone,
> and is the equipment actually available?

### 0:06–0:16 — Problem

> One wrong total or one invented projector can break the event. A chatbot that
> sounds confident is not enough.

### 0:16–0:28 — Solution

> Workshop Planning Agent uses a local Llama model only to choose the next
> approved tool. Python does the exact arithmetic, validates every argument, and
> owns every inventory fact.

### 0:28–0:48 — Demo

> Here is the sample two-day workshop for 30 students with a 15,000 rupee budget.
> The agent calculates 12,000 rupees estimated, 3,000 remaining, and within
> budget. It then checks resources: projector, Wi-Fi, whiteboard, and laptops are
> available. Microphones are missing. The final summary uses only those verified
> results.

### 0:48–0:56 — Verification

> The tool logic is verified independently, and all 17 regression tests pass.

### 0:56–1:00 — Close

> Workshop Planning Agent: every rupee, every resource, verified.

**End card:** Project name, live URL, GitHub URL, MIT license.

---

## Suggested shot list

1. Title card — project name and tagline.
2. Browser console — health pill, sample brief, Run button.
3. Architecture diagram from the README.
4. Code close-ups — `TOOLS`, `ORDER`, `MAX_STEPS`, `validate_args`.
5. Live run — tool trace, budget gauge, inventory board, final summary.
6. Terminal — `demo_tools.py` and the 17-test suite.
7. End card — live demo and repository links.
8. Optional: mobile view for 3–4 seconds to show the responsive layout.

---

## Editing and delivery checklist

- [ ] Voiceover is clear and matches the on-screen numbers.
- [ ] Captions are burned in or uploaded.
- [ ] Idle model wait is cut or sped up; tool calls and results are readable.
- [ ] No tokens, `.env` files, `.local` secrets, terminal history, or personal
      data are visible.
- [ ] The live Vercel demo is online while recording, or the local console is
      used for reliability.
- [ ] Export is 1080p MP4 (H.264) and within the form's size limit.
- [ ] Upload to YouTube (unlisted or public) or Google Drive with view access.
- [ ] Test the video link in a private browser window before submitting.

---

## Short submission blurb

**50 words:**

> Workshop Planning Agent is a bounded AI assistant for event organizers. A local
> Llama 3.1 model chooses the next approved tool, while deterministic Python
> tools calculate the exact budget and verify equipment availability. The result
> is a streaming, auditable plan: INR 12,000 estimated, INR 3,000 remaining, and
> microphones reported as missing.

**150 words:**

> Workshop Planning Agent turns a natural-language workshop brief into a verified
> budget and equipment report. A local Llama 3.1 model served by Ollama chooses
> the next approved action, but it never performs arithmetic or invents
> inventory. The Python host locks the workflow to `calculate_budget` followed by
> `check_resources`, validates every argument, and applies three security gates
> before execution. Results stream to a responsive Flask console as NDJSON, so
> the tool trace, budget gauge, resource board, and final summary appear live.
> For the sample two-day, 30-student workshop with a INR 15,000 budget, the agent
> computes INR 12,000 estimated, INR 3,000 remaining, four available resources,
> and one missing resource: microphones. The deterministic tools can be verified
> without the model, and all 17 regression tests pass. The project is MIT
> licensed, open source, and designed to be auditable rather than merely
> plausible.

---

## Attribution

The repository and its `SUBMISSION.md` identify **Suraj Balasaheb Khanase** as
the original solo participant and author. Keep that attribution in the video,
repository, and submission form unless the event organizer confirms a different
arrangement.
