"use strict";

/* Workshop Agent — NDJSON stream client and DOM renderer. */

const SAMPLE_QUERY =
  "Plan a two-day workshop for 30 students within a 15000 INR budget. " +
  "Daily cost per person is 200 INR. Check projector, Wi-Fi, whiteboard, " +
  "laptops, and microphones.";

const MAX_GAUGE_OFFSET = 314.159;
const TOOL_META = {
  calculate_budget: {
    title: "Budget verified",
    subtitle: "Exact INR arithmetic · deterministic Python",
    order: ["participants", "days", "daily_cost_per_person", "budget"],
  },
  check_resources: {
    title: "Inventory checked",
    subtitle: "Alias-normalized lookup · deterministic Python",
    order: ["required_items"],
  },
};

const ARG_LABELS = {
  participants: "participants",
  days: "days",
  daily_cost_per_person: "daily / person",
  budget: "budget",
  required_items: "required items",
};

const moneyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const state = {
  running: false,
  terminal: false,
  timer: null,
  startedAt: 0,
  health: null,
};

const $ = (id) => document.getElementById(id);

const dom = {
  form: $("planForm"),
  query: $("query"),
  charCount: $("charCount"),
  sampleButton: $("sampleButton"),
  runButton: $("runButton"),
  buttonLabel: document.querySelector("#runButton .button-label"),
  formError: $("formError"),
  ollamaPill: $("ollamaPill"),
  ollamaText: $("ollamaText"),
  emptyState: $("emptyState"),
  liveState: $("liveState"),
  workspace: document.querySelector(".workspace"),
  runBadge: $("runBadge"),
  runBadgeText: $("runBadgeText"),
  elapsed: $("elapsed"),
  activityModel: $("activityModel"),
  thinkingBar: $("thinkingBar"),
  thinkingTitle: $("thinkingTitle"),
  thinkingDetail: $("thinkingDetail"),
  thinkingElapsed: $("thinkingElapsed"),
  timeline: $("timeline"),
  budgetCard: $("budgetCard"),
  budgetStatus: $("budgetStatus"),
  gauge: $("gauge"),
  gaugeValue: $("gaugeValue"),
  usagePct: $("usagePct"),
  costValue: $("costValue"),
  budgetValue: $("budgetValue"),
  remainingValue: $("remainingValue"),
  budgetNote: $("budgetNote"),
  resourceCard: $("resourceCard"),
  resourceStatus: $("resourceStatus"),
  resourceList: $("resourceList"),
  resourceNote: $("resourceNote"),
  summaryCard: $("summaryCard"),
  summaryTitle: $("summaryTitle"),
  summaryStatus: $("summaryStatus"),
  summaryPlaceholder: $("summaryPlaceholder"),
  summaryText: $("summaryText"),
  summaryFooter: $("summaryFooter"),
  copyButton: $("copyButton"),
  toast: $("toast"),
  toolTemplate: $("toolItemTemplate"),
  guardrailTemplate: $("guardrailTemplate"),
  finalTemplate: $("finalItemTemplate"),
  resourceTemplate: $("resourceChipTemplate"),
};

/* --------------------------------------------------------------------------
   Formatting helpers
   -------------------------------------------------------------------------- */

function formatDuration(totalSeconds) {
  const safe = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

function formatMoney(value) {
  const number = Number(value);
  return Number.isFinite(number) ? moneyFormatter.format(number) : "—";
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "—";
  return `${Math.round(value)}%`;
}

function prettyResource(value) {
  return String(value)
    .replace(/\bwi-fi\b/gi, "Wi-Fi")
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function formatArgument(key, value) {
  if (key === "daily_cost_per_person" || key === "budget") {
    const number = Number(value);
    if (Number.isFinite(number)) return formatMoney(number);
  }
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null) return "null";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function isNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

/* --------------------------------------------------------------------------
   Small UI helpers
   -------------------------------------------------------------------------- */

let toastTimer = null;

function showToast(message) {
  dom.toast.textContent = message;
  dom.toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    dom.toast.hidden = true;
  }, 2400);
}

function setFormError(message) {
  if (!message) {
    dom.formError.textContent = "";
    dom.formError.hidden = true;
    return;
  }
  dom.formError.textContent = message;
  dom.formError.hidden = false;
}

function setBusy(busy) {
  dom.runButton.disabled = busy;
  dom.query.disabled = busy;
  dom.sampleButton.disabled = busy;
  dom.runButton.classList.toggle("is-loading", busy);
  dom.runButton.setAttribute("aria-busy", String(busy));
  dom.buttonLabel.textContent = busy ? "Planning…" : "Run planning agent";
  dom.form.setAttribute("aria-busy", String(busy));
}

function setRunBadge(kind, label) {
  dom.runBadge.className = `run-badge is-${kind}`;
  dom.runBadgeText.textContent = label;
}

function setThinking(title, detail, mode = "running") {
  dom.thinkingTitle.textContent = title;
  dom.thinkingDetail.textContent = detail;
  dom.thinkingBar.classList.toggle("is-done", mode === "done");
  dom.thinkingBar.classList.toggle("is-blocked", mode === "blocked");
}

function setElapsed(seconds) {
  const safe = Number.isFinite(seconds) ? seconds : 0;
  dom.elapsed.textContent = formatDuration(safe);
  dom.thinkingElapsed.textContent = formatDuration(safe);
}

function startTimer() {
  stopTimer();
  state.startedAt = Date.now();
  setElapsed(0);
  state.timer = window.setInterval(() => {
    if (!state.running) return;
    const seconds = (Date.now() - state.startedAt) / 1000;
    dom.elapsed.textContent = formatDuration(seconds);
    dom.thinkingElapsed.textContent = formatDuration(seconds);
  }, 1000);
}

function stopTimer() {
  if (state.timer) {
    window.clearInterval(state.timer);
    state.timer = null;
  }
}

function updateElapsedFromEvent(event) {
  if (isNumber(event.elapsed) && event.elapsed > 0) {
    dom.elapsed.textContent = formatDuration(event.elapsed);
    dom.thinkingElapsed.textContent = formatDuration(event.elapsed);
  }
}

/* --------------------------------------------------------------------------
   Health
   -------------------------------------------------------------------------- */

async function checkHealth() {
  dom.ollamaPill.className = "status-pill is-checking";
  dom.ollamaText.textContent = "Checking Ollama";
  dom.ollamaPill.title = "Checking the local Ollama server";

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch("/api/health", {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Health check returned ${response.status}.`);
    const health = await response.json();
    state.health = health;

    if (health.ok) {
      dom.ollamaPill.className = "status-pill is-ready";
      dom.ollamaText.textContent = "Ollama ready";
      dom.ollamaPill.title = `${health.model} is installed and Ollama is reachable.`;
    } else if (health.ollama) {
      dom.ollamaPill.className = "status-pill is-warning";
      dom.ollamaText.textContent = "Model not pulled";
      dom.ollamaPill.title = `Run: ollama pull ${health.model}`;
    } else {
      dom.ollamaPill.className = "status-pill is-error";
      dom.ollamaText.textContent = "Ollama offline";
      dom.ollamaPill.title = "Start Ollama on http://localhost:11434.";
    }
  } catch {
    state.health = null;
    dom.ollamaPill.className = "status-pill is-error";
    dom.ollamaText.textContent = "Host offline";
    dom.ollamaPill.title = "The local web host is not responding.";
  } finally {
    window.clearTimeout(timeout);
  }
}

/* --------------------------------------------------------------------------
   Timeline
   -------------------------------------------------------------------------- */

function appendToolItem(event) {
  const meta = TOOL_META[event.name] || {
    title: "Tool request",
    subtitle: "Bounded Python tool",
    order: [],
  };
  const node = dom.toolTemplate.content.firstElementChild.cloneNode(true);
  node.dataset.step = String(event.step);
  node.dataset.tool = String(event.name || "");
  node.querySelector('[data-role="title"]').textContent = meta.title;
  node.querySelector('[data-role="subtitle"]').textContent = `Step ${event.step} · ${meta.subtitle}`;
  node.querySelector('[data-role="status"]').textContent = "Running";

  const args = event.arguments && typeof event.arguments === "object" ? event.arguments : {};
  const keys = meta.order.length
    ? meta.order.filter((key) => Object.prototype.hasOwnProperty.call(args, key))
    : Object.keys(args);
  const extraKeys = Object.keys(args).filter((key) => !keys.includes(key));
  const argList = node.querySelector('[data-role="args"]');

  for (const key of [...keys, ...extraKeys]) {
    const badge = document.createElement("span");
    badge.className = "arg-badge";
    const keyNode = document.createElement("span");
    keyNode.textContent = ARG_LABELS[key] || key;
    const valueNode = document.createElement("span");
    valueNode.textContent = formatArgument(key, args[key]);
    badge.append(keyNode, valueNode);
    argList.append(badge);
  }

  dom.timeline.append(node);
  return node;
}

function findToolItem(event) {
  const items = dom.timeline.querySelectorAll(".timeline-item[data-step]");
  for (const item of items) {
    if (item.dataset.step === String(event.step)) return item;
  }
  return null;
}

function appendNotice(title, message, kind = "warning", pill = "Blocked") {
  const node = dom.guardrailTemplate.content.firstElementChild.cloneNode(true);
  node.classList.toggle("is-warning", kind === "warning");
  node.classList.toggle("is-error", kind === "error");
  node.querySelector(".timeline-title-row strong").textContent = title;
  const pillNode = node.querySelector(".mini-pill");
  pillNode.className = `mini-pill is-${kind}`;
  pillNode.textContent = pill;
  node.querySelector('[data-role="message"]').textContent = message;
  dom.timeline.append(node);
  return node;
}

function appendFinalItem() {
  const node = dom.finalTemplate.content.firstElementChild.cloneNode(true);
  dom.timeline.append(node);
}

function summarizeBudgetResult(result) {
  const total = Number(result.total_estimated_cost);
  const remaining = Number(result.remaining_budget);
  if (!Number.isFinite(total) || !Number.isFinite(remaining)) {
    return "Budget tool returned no usable totals.";
  }
  const verdict = result.within_budget === true ? "within budget" : "over budget";
  return `${formatMoney(total)} estimate · ${formatMoney(remaining)} remaining · ${verdict}`;
}

function summarizeResourceResult(result) {
  const available = Array.isArray(result.available) ? result.available : [];
  const missing = Array.isArray(result.missing) ? result.missing : [];
  const missingText = missing.length
    ? ` · missing ${missing.map(prettyResource).join(", ")}`
    : " · nothing missing";
  return `${available.length} available${missingText}`;
}

function updateToolItem(event) {
  const item = findToolItem(event);
  if (!item) return;

  const ok = event.ok === true;
  item.classList.remove("is-running");
  item.classList.add(ok ? "is-complete" : "is-error");

  const pill = item.querySelector('[data-role="status"]');
  pill.className = `mini-pill is-${ok ? "complete" : "error"}`;
  pill.textContent = ok ? "Verified" : "Error";

  const resultNode = item.querySelector('[data-role="result"]');
  const result = event.result && typeof event.result === "object" ? event.result : {};
  let summary = "";

  if (!ok) {
    summary = `Stopped: ${result.error || "The tool rejected this request."}`;
    resultNode.classList.add("is-error");
  } else if (event.name === "calculate_budget") {
    summary = summarizeBudgetResult(result);
  } else if (event.name === "check_resources") {
    summary = summarizeResourceResult(result);
  } else {
    summary = "Tool returned successfully.";
  }

  resultNode.textContent = summary;
  resultNode.hidden = false;

  const details = item.querySelector('[data-role="details"]');
  const raw = item.querySelector('[data-role="raw"]');
  try {
    raw.textContent = JSON.stringify(event.result, null, 2);
    details.hidden = false;
  } catch {
    details.hidden = true;
  }
}

/* --------------------------------------------------------------------------
   Verified result panels
   -------------------------------------------------------------------------- */

function showBudgetResult(result) {
  const total = Number(result.total_estimated_cost);
  const budget = Number(result.budget);
  const remaining = Number(result.remaining_budget);

  if (![total, budget, remaining].every(Number.isFinite) || budget <= 0) {
    dom.budgetNote.textContent = "The budget tool returned incomplete values.";
    return;
  }

  const usage = (total / budget) * 100;
  const boundedUsage = Math.min(100, Math.max(0, usage));
  dom.costValue.textContent = formatMoney(total);
  dom.budgetValue.textContent = formatMoney(budget);
  dom.remainingValue.textContent = formatMoney(remaining);
  dom.usagePct.textContent = formatPercent(usage);

  dom.gaugeValue.style.strokeDashoffset = String(
    MAX_GAUGE_OFFSET * (1 - boundedUsage / 100)
  );
  dom.gauge.classList.toggle("is-over", usage > 100);
  dom.gauge.setAttribute(
    "aria-label",
    `${formatPercent(usage)} of the workshop budget used. Estimated cost ${formatMoney(
      total
    )}, allocated ${formatMoney(budget)}, remaining ${formatMoney(remaining)}.`
  );

  const difference = Math.abs(remaining);
  if (result.within_budget === false || remaining < 0) {
    dom.budgetNote.textContent = `Over budget by ${formatMoney(difference)}. Reduce the cost or increase the allocation.`;
    dom.remainingValue.style.color = "var(--danger)";
    dom.budgetNote.style.color = "var(--danger)";
  } else {
    dom.budgetNote.textContent = `Within budget by ${formatMoney(difference)}.`;
    dom.remainingValue.style.color = "";
    dom.budgetNote.style.color = "";
  }

  dom.budgetCard.classList.add("is-ready");
  dom.budgetStatus.className = "result-status is-ready";
  dom.budgetStatus.textContent = "Verified";
}

function makeResourceGroup(label, items, kind) {
  const group = document.createElement("div");
  group.className = "resource-group";

  const labelNode = document.createElement("span");
  labelNode.className = "resource-group-label";
  labelNode.textContent = `${label} · ${items.length}`;
  group.append(labelNode);

  for (const item of items) {
    const chip = dom.resourceTemplate.content.firstElementChild.cloneNode(true);
    chip.classList.add(`is-${kind}`);
    chip.querySelector('[data-role="label"]').textContent = prettyResource(item);
    chip.querySelector(".chip-icon").textContent = kind === "available" ? "✓" : "!";
    group.append(chip);
  }

  return group;
}

function showResourceResult(result) {
  const available = Array.isArray(result.available) ? result.available.filter(Boolean) : [];
  const missing = Array.isArray(result.missing) ? result.missing.filter(Boolean) : [];

  dom.resourceList.replaceChildren();
  dom.resourceList.classList.remove("is-pending");

  if (available.length) {
    dom.resourceList.append(makeResourceGroup("Available", available, "available"));
  }
  if (missing.length) {
    dom.resourceList.append(makeResourceGroup("Missing", missing, "missing"));
  }
  if (!available.length && !missing.length) {
    const empty = document.createElement("span");
    empty.className = "resource-placeholder";
    empty.textContent = "No resource names were returned.";
    dom.resourceList.append(empty);
  }

  const missingText = missing.length
    ? `${missing.length} still needs sourcing.`
    : "All requested resources are available.";
  dom.resourceNote.textContent = `${available.length} available, ${missing.length} missing. ${missingText}`;
  dom.resourceCard.classList.add("is-ready");
  dom.resourceStatus.className = "result-status is-ready";
  dom.resourceStatus.textContent = "Verified";
}

/* --------------------------------------------------------------------------
   Run lifecycle
   -------------------------------------------------------------------------- */

function resetRunView() {
  dom.emptyState.hidden = true;
  dom.liveState.hidden = false;
  dom.timeline.replaceChildren();
  setFormError("");
  setElapsed(0);

  dom.thinkingBar.classList.remove("is-done", "is-blocked");
  setThinking("Starting session", "Contacting the local model…", "running");

  dom.budgetCard.classList.remove("is-ready");
  dom.budgetStatus.className = "result-status is-pending";
  dom.budgetStatus.textContent = "Awaiting";
  dom.costValue.textContent = "—";
  dom.budgetValue.textContent = "—";
  dom.remainingValue.textContent = "—";
  dom.remainingValue.style.color = "";
  dom.usagePct.textContent = "—";
  dom.gaugeValue.style.strokeDashoffset = String(MAX_GAUGE_OFFSET);
  dom.gauge.classList.remove("is-over");
  dom.gauge.setAttribute("aria-label", "Budget usage awaiting calculation");
  dom.budgetNote.textContent = "Waiting for the budget tool.";
  dom.budgetNote.style.color = "";

  dom.resourceCard.classList.remove("is-ready");
  dom.resourceStatus.className = "result-status is-pending";
  dom.resourceStatus.textContent = "Awaiting";
  dom.resourceList.replaceChildren();
  dom.resourceList.classList.add("is-pending");
  const placeholder = document.createElement("span");
  placeholder.className = "resource-placeholder";
  const dot = document.createElement("span");
  dot.className = "placeholder-dot";
  dot.setAttribute("aria-hidden", "true");
  placeholder.append(dot, document.createTextNode("Waiting for inventory check"));
  dom.resourceList.append(placeholder);
  dom.resourceNote.textContent = "No inventory claims until the tool returns.";

  dom.summaryCard.classList.remove("is-ready", "is-blocked");
  dom.summaryTitle.textContent = "Grounded summary";
  dom.summaryStatus.className = "result-status is-pending";
  dom.summaryStatus.textContent = "Pending";
  dom.summaryPlaceholder.hidden = false;
  dom.summaryText.hidden = true;
  dom.summaryText.textContent = "";
  dom.summaryText.classList.remove("is-blocked");
  dom.summaryFooter.hidden = true;
  dom.copyButton.hidden = false;
}

function scrollToWorkspace() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.requestAnimationFrame(() => {
    dom.workspace.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "start",
    });
  });
}

function showFinal(event) {
  state.terminal = true;
  updateElapsedFromEvent(event);
  dom.thinkingElapsed.textContent = formatDuration(
    isNumber(event.elapsed) ? event.elapsed : (Date.now() - state.startedAt) / 1000
  );

  const content = typeof event.content === "string" ? event.content.trim() : "";
  const blocked = event.status === "blocked";
  dom.summaryPlaceholder.hidden = true;
  dom.summaryText.hidden = false;
  dom.summaryText.textContent = content || "The agent returned an empty response.";
  dom.summaryText.classList.toggle("is-blocked", blocked);

  if (blocked) {
    dom.summaryTitle.textContent = "Run stopped";
    dom.summaryStatus.className = "result-status is-warning";
    dom.summaryStatus.textContent = "Blocked";
    dom.summaryCard.classList.add("is-blocked");
    dom.summaryFooter.hidden = true;
    setRunBadge("blocked", "Blocked");
    setThinking("Run stopped", "A guardrail ended this run before a verified summary.", "blocked");
    appendNotice(
      "Run stopped",
      "No verified summary was produced. Review the reason below the console.",
      "warning",
      "Blocked"
    );
    if (content.startsWith("Model request failed:")) checkHealth();
    return;
  }

  dom.summaryTitle.textContent = "Grounded summary";
  dom.summaryStatus.className = "result-status is-ready";
  dom.summaryStatus.textContent = "Verified";
  dom.summaryCard.classList.add("is-ready");
  dom.summaryFooter.hidden = false;
  dom.copyButton.hidden = false;
  setRunBadge("success", "Verified");
  setThinking("Run complete", "Both tools finished. The summary is grounded in their results.", "done");
  appendFinalItem();
}

function showFailure(message) {
  if (state.terminal) return;
  state.terminal = true;
  state.running = false;
  stopTimer();
  setRunBadge("error", "Run failed");
  setThinking("Run failed", "The interface did not receive a complete agent result.", "blocked");
  dom.summaryPlaceholder.hidden = true;
  dom.summaryText.hidden = false;
  dom.summaryText.textContent = message;
  dom.summaryText.classList.add("is-blocked");
  dom.summaryCard.classList.add("is-blocked");
  dom.summaryTitle.textContent = "Run failed";
  dom.summaryStatus.className = "result-status is-error";
  dom.summaryStatus.textContent = "Error";
  dom.summaryFooter.hidden = true;
  appendNotice("Run failed", message, "error", "Error");
  setBusy(false);
}

/* --------------------------------------------------------------------------
   Event handling
   -------------------------------------------------------------------------- */

function handleEvent(event) {
  if (!event || typeof event !== "object") return;

  switch (event.type) {
    case "accepted":
      updateElapsedFromEvent(event);
      if (event.model) dom.activityModel.textContent = event.model;
      setThinking("Session accepted", "The host opened a bounded local session.", "running");
      break;

    case "session":
      updateElapsedFromEvent(event);
      if (event.model) dom.activityModel.textContent = event.model;
      setThinking(
        "Workflow armed",
        "Budget → inventory → grounded summary. One tool per turn.",
        "running"
      );
      break;

    case "status": {
      updateElapsedFromEvent(event);
      let title = "Model thinking";
      let detail = event.message || "Waiting for the local model.";

      if (event.next_tool === "calculate_budget") {
        title = "Selecting the budget tool";
        detail = "The local model is routing your brief to calculate_budget.";
      } else if (event.next_tool === "check_resources") {
        title = "Budget verified · checking inventory";
        detail = "The model is routing the resource list to check_resources.";
      } else {
        title = "Writing the grounded summary";
        detail = "Both tool results are present. The model is writing the final brief.";
      }
      setThinking(title, detail, "running");
      break;
    }

    case "tool_call":
      updateElapsedFromEvent(event);
      appendToolItem(event);
      setThinking(
        event.name === "calculate_budget" ? "Budget tool requested" : "Inventory tool requested",
        "Arguments passed the signature gate. Running deterministic Python.",
        "running"
      );
      break;

    case "tool_result":
      updateElapsedFromEvent(event);
      updateToolItem(event);
      if (event.ok === true && event.name === "calculate_budget") {
        showBudgetResult(event.result || {});
        setThinking("Budget verified", "Exact INR arithmetic is complete.", "running");
      } else if (event.ok === true && event.name === "check_resources") {
        showResourceResult(event.result || {});
        setThinking("Inventory verified", "The equipment lookup is complete.", "running");
      } else {
        setThinking("Tool error", "The guarded tool returned an error. The run will stop.", "blocked");
      }
      break;

    case "guardrail":
      updateElapsedFromEvent(event);
      appendNotice(
        "Guardrail triggered",
        event.message || "The host rejected an unsafe tool request.",
        "warning",
        "Blocked"
      );
      setThinking("Guardrail triggered", "The host rejected an unsafe request.", "blocked");
      break;

    case "error":
      updateElapsedFromEvent(event);
      appendNotice(
        "Agent error",
        event.message || "The agent encountered an unexpected error.",
        "error",
        "Error"
      );
      setThinking("Agent error", event.message || "The run could not continue.", "blocked");
      break;

    case "heartbeat":
      updateElapsedFromEvent(event);
      break;

    case "final":
      showFinal(event);
      break;

    default:
      break;
  }
}

async function buildErrorMessage(response) {
  try {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await response.json();
      if (data && typeof data.error === "string" && data.error.trim()) {
        return data.error.trim();
      }
    }
    const text = (await response.text()).trim();
    if (text) return text.slice(0, 300);
  } catch {
    /* Fall through to the status message. */
  }
  return `The planning request failed with HTTP ${response.status}.`;
}

async function streamPlan(queryText) {
  const response = await fetch("/api/plan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/x-ndjson",
    },
    body: JSON.stringify({ query: queryText }),
  });

  if (!response.ok) {
    throw new Error(await buildErrorMessage(response));
  }
  if (!response.body) {
    throw new Error("This browser cannot read the streaming response.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const consume = (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let event;
    try {
      event = JSON.parse(trimmed);
    } catch {
      console.warn("Ignored a malformed NDJSON event.");
      return;
    }
    handleEvent(event);
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      consume(buffer.slice(0, newline));
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) consume(buffer);
}

async function runPlannedAgent(event) {
  event.preventDefault();
  if (state.running) return;

  const queryText = dom.query.value.trim();
  if (!queryText) {
    setFormError("Describe the workshop before running the agent.");
    dom.query.focus();
    return;
  }
  if (queryText.length > Number(dom.query.maxLength)) {
    setFormError(`Keep the brief to ${dom.query.maxLength} characters or fewer.`);
    dom.query.focus();
    return;
  }

  resetRunView();
  setFormError("");
  state.running = true;
  state.terminal = false;
  setBusy(true);
  setRunBadge("running", "Running");
  startTimer();
  scrollToWorkspace();

  try {
    await streamPlan(queryText);
    if (!state.terminal) {
      showFailure("The event stream closed before the agent returned a final result.");
    }
  } catch (error) {
    if (!state.terminal) {
      const message =
        error && error.message
          ? error.message
          : "Could not reach the local host. Is web_app.py running?";
      showFailure(message);
    } else {
      console.error(error);
    }
  } finally {
    state.running = false;
    setBusy(false);
    stopTimer();
    if (!state.terminal) {
      showFailure("The run ended without a verified result.");
    }
    dom.thinkingElapsed.textContent = dom.elapsed.textContent;
  }
}

/* --------------------------------------------------------------------------
   Copy, character count, boot
   -------------------------------------------------------------------------- */

async function copySummary() {
  const text = dom.summaryText.textContent;
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
    showToast("Summary copied");
  } catch {
    const helper = document.createElement("textarea");
    helper.value = text;
    helper.setAttribute("readonly", "");
    helper.style.position = "fixed";
    helper.style.opacity = "0";
    document.body.append(helper);
    helper.select();
    const copied = document.execCommand("copy");
    helper.remove();
    showToast(copied ? "Summary copied" : "Could not copy the summary");
  }
}

function updateCharacterCount() {
  const count = dom.query.value.length;
  const maximum = Number(dom.query.maxLength);
  dom.charCount.textContent = `${count.toLocaleString("en-IN")} / ${maximum.toLocaleString("en-IN")}`;
}

function loadSample() {
  if (state.running) return;
  dom.query.value = SAMPLE_QUERY;
  updateCharacterCount();
  setFormError("");
  dom.query.focus();
  dom.query.setSelectionRange(dom.query.value.length, dom.query.value.length);
  showToast("Sample brief loaded");
}

dom.form.addEventListener("submit", runPlannedAgent);
dom.query.addEventListener("input", () => {
  updateCharacterCount();
  if (!dom.formError.hidden) setFormError("");
});
dom.sampleButton.addEventListener("click", loadSample);
dom.copyButton.addEventListener("click", copySummary);

updateCharacterCount();
setRunBadge("idle", "Ready");
checkHealth();
