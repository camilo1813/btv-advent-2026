import { configured, request, rpc } from "../supabase.js";

const form = document.querySelector("#monitor-login");
const submit = form.querySelector("button");
const panel = document.querySelector("#monitor-data");
const message = document.querySelector("#monitor-message");
const refreshButton = document.querySelector("#refresh");
const hours = document.querySelector("#hourly-views");
const minutes = document.querySelector("#minute-views");
const lastRefresh = document.querySelector("#last-refresh");
const filterForm = document.querySelector("#view-filter");
const applyFilter = filterForm.querySelector("button");
const range = document.querySelector("#view-range");
const customRange = document.querySelector("#view-custom-range");
const startInput = document.querySelector("#view-start");
const endInput = document.querySelector("#view-end");
const filterMessage = document.querySelector("#view-filter-message");
const newer = document.querySelector("#newer-views");
const older = document.querySelector("#older-views");
const number = new Intl.NumberFormat("en-IN");
const date = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});
const preciseDate = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "medium",
  hourCycle: "h23",
  timeZone: "Asia/Kolkata",
});

let session = null;
let refreshing = false;
let timeline = null;
let filter = { recent_minutes: 60, range_start: null, range_end: null };
let frozenRange = null;
const cursors = [];

function clearSession() {
  const previous = session;
  session = null;
  panel.hidden = true;
  form.hidden = false;
  form.reset();
  filterForm.reset();
  customRange.hidden = true;
  startInput.required = false;
  endInput.required = false;
  filterMessage.textContent = "";
  panel.querySelectorAll("tbody, .rounds dd, #view-window, #last-refresh").forEach((element) => {
    element.replaceChildren();
  });
  filter = { recent_minutes: 60, range_start: null, range_end: null };
  frozenRange = null;
  cursors.length = 0;
  timeline = null;
  if (previous) {
    void request("/auth/v1/logout?scope=local", {}, previous.access_token).catch(() => {});
  }
}

async function getData(activeSession) {
  const cursor = cursors.at(-1);
  const timelineParameters = {
    ...filter,
    ...frozenRange,
    before_time: cursor?.opened_at ?? null,
    before_id: cursor?.id ?? null,
  };
  async function load() {
    return Promise.all([
      rpc("btv_launch_metrics", {}, activeSession.access_token),
      rpc("btv_launch_timeline", timelineParameters, activeSession.access_token),
    ]);
  }

  try {
    return await load();
  } catch (error) {
    if (error.status !== 401 || !activeSession.refresh_token) throw error;
    const renewed = await request("/auth/v1/token?grant_type=refresh_token", {
      refresh_token: activeSession.refresh_token,
    });
    Object.assign(activeSession, renewed);
    return load();
  }
}

function renderMetrics(metrics) {
  for (const [id, value] of Object.entries({
    "total-views": metrics.total_views,
    "whatsapp-views": metrics.whatsapp_views,
    "recent-views": metrics.recent_views,
    "total-signups": metrics.total_signups,
  })) {
    document.getElementById(id).textContent = number.format(value);
  }

  renderBuckets(hours, metrics.hours);
  lastRefresh.textContent = `Last updated ${preciseDate.format(new Date(metrics.updated_at))} IST`;
}

function renderBuckets(table, buckets) {
  const rows = buckets.map((bucket) => {
    const row = document.createElement("tr");
    const heading = document.createElement("th");
    heading.scope = "row";
    heading.textContent = date.format(new Date(bucket.start));
    row.append(heading);
    row.insertCell().textContent = number.format(bucket.views);
    row.insertCell().textContent = number.format(bucket.whatsapp_views);
    return row;
  });
  table.replaceChildren(...rows);
}

function renderTimeline(log) {
  renderBuckets(minutes, log.minutes);
  const rows = log.events.map((event) => {
    const row = document.createElement("tr");
    const time = document.createElement("time");
    const fractional = event.opened_at.match(/\.(\d+)/)?.[1] ?? "";
    time.dateTime = event.opened_at;
    time.textContent = `${preciseDate.format(new Date(event.opened_at))}.${fractional.padEnd(6, "0")}`;
    row.insertCell().append(time);
    row.insertCell().textContent = event.source === "whatsapp" ? "WhatsApp link" : "Other";
    return row;
  });
  if (!rows.length) {
    const row = document.createElement("tr");
    const cell = row.insertCell();
    cell.colSpan = 2;
    cell.textContent = "No views in this time range.";
    rows.push(row);
  }
  document.querySelector("#view-events").replaceChildren(...rows);
  const from = preciseDate.format(new Date(log.window_start));
  const until = preciseDate.format(new Date(log.window_end));
  document.querySelector("#view-window").textContent = `${from} to ${until} IST · Page ${cursors.length + 1}`;
}

function setBusy(busy) {
  refreshButton.disabled = busy;
  applyFilter.disabled = busy;
  newer.disabled = busy || cursors.length === 0;
  older.disabled = busy || !timeline?.has_more;
}

async function refresh() {
  if (!session || refreshing) return;
  refreshing = true;
  setBusy(true);
  const activeSession = session;
  try {
    const [metrics, log] = await getData(activeSession);
    if (session !== activeSession) return;
    renderMetrics(metrics);
    renderTimeline(log);
    timeline = log;
    form.hidden = true;
    panel.hidden = false;
    message.textContent = "";
  } catch (error) {
    if (session !== activeSession) return;
    if ([400, 401, 403].includes(error.status)) {
      clearSession();
      message.textContent = "Dashboard access was denied or your session expired.";
    } else {
      message.textContent = "The dashboard couldn’t refresh. Trying again shortly.";
    }
  } finally {
    refreshing = false;
    setBusy(false);
  }
}

if (configured) {
  document.querySelector("#monitor-setup").hidden = true;
  form.hidden = false;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (session) return;
    submit.disabled = true;
    message.textContent = "Signing in…";
    const credentials = new FormData(form);
    try {
      session = await request("/auth/v1/token?grant_type=password", {
        email: credentials.get("email").trim(),
        password: credentials.get("password"),
      });
      form.reset();
      await refresh();
    } catch {
      message.textContent = "Sign-in failed. Check your credentials and try again.";
    } finally {
      submit.disabled = false;
    }
  });

  refreshButton.addEventListener("click", refresh);
  range.addEventListener("change", () => {
    const custom = range.value === "custom";
    customRange.hidden = !custom;
    startInput.required = custom;
    endInput.required = custom;
  });
  filterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (refreshing) return;
    filterMessage.textContent = "";
    let rangeStart = null;
    let rangeEnd = null;
    if (range.value === "custom") {
      const start = new Date(`${startInput.value}+05:30`);
      const end = new Date(`${endInput.value}+05:30`);
      const duration = end - start;
      if (!(duration > 0 && duration <= 31 * 24 * 60 * 60 * 1_000)) {
        filterMessage.textContent = "Choose an end time after the start, within 31 days.";
        return;
      }
      rangeStart = start.toISOString();
      rangeEnd = end.toISOString();
    }
    filter = { recent_minutes: Number(range.value) || 60, range_start: rangeStart, range_end: rangeEnd };
    timeline = null;
    frozenRange = null;
    cursors.length = 0;
    void refresh();
  });
  older.addEventListener("click", () => {
    if (refreshing || !timeline?.has_more) return;
    frozenRange = { range_start: timeline.window_start, range_end: timeline.window_end };
    cursors.push(timeline.events.at(-1));
    timeline = null;
    void refresh();
  });
  newer.addEventListener("click", () => {
    if (refreshing || !cursors.length) return;
    cursors.pop();
    if (!cursors.length) frozenRange = null;
    timeline = null;
    void refresh();
  });
  document.querySelector("#sign-out").addEventListener("click", () => {
    clearSession();
    message.textContent = "Signed out.";
  });
  function refreshWhenVisible() {
    if (document.visibilityState === "visible") void refresh();
  }
  document.addEventListener("visibilitychange", refreshWhenVisible);
  setInterval(refreshWhenVisible, 60_000);
}
