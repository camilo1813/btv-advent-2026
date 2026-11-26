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
const repeatPopup = document.querySelector("#repeat-popup");
const repeatStatus = document.querySelector("#repeat-status");
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
const countries = new Intl.DisplayNames(["en-IN"], { type: "region", fallback: "none" });

let session = null;
let refreshing = false;
let timeline = null;
let filter = { recent_minutes: 60, range_start: null, range_end: null };
let frozenRange = null;
const cursors = [];
const alerted = new Map();
let alertsAfter = null;

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
  alerted.clear();
  alertsAfter = null;
  repeatPopup.hidden = true;
  repeatStatus.textContent = "";
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
      rpc("btv_live_visitors", { alerts_after: alertsAfter }, activeSession.access_token),
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
    row.insertCell().textContent = event.country_code
      ? countries.of(event.country_code) ?? event.country_code
      : "Unavailable";
    row.insertCell().textContent = event.device_type ?? "Unavailable";
    row.insertCell().textContent = event.masked_ip ?? "Unavailable";
    return row;
  });
  if (!rows.length) {
    const row = document.createElement("tr");
    const cell = row.insertCell();
    cell.colSpan = 5;
    cell.textContent = "No views in this time range.";
    rows.push(row);
  }
  document.querySelector("#view-events").replaceChildren(...rows);
  const from = preciseDate.format(new Date(log.window_start));
  const until = preciseDate.format(new Date(log.window_end));
  document.querySelector("#view-window").textContent = `${from} to ${until} IST · Page ${cursors.length + 1}`;
}

function renderVisitors(visitors) {
  const rows = visitors.ips.map((ip) => {
    const row = document.createElement("tr");
    const connection = document.createElement("th");
    connection.scope = "row";
    connection.textContent = `IP #${ip.id}`;
    row.append(connection);
    for (const value of [
      ip.masked_ip,
      [ip.city, ip.region].filter(Boolean).join(", ") || "Unavailable",
      ip.country_code ? countries.of(ip.country_code) ?? ip.country_code : "Unavailable",
      ip.devices.join(", ") || "Unavailable",
      number.format(ip.visit_count),
      preciseDate.format(new Date(ip.first_seen)),
      preciseDate.format(new Date(ip.last_seen)),
    ]) {
      row.insertCell().textContent = value;
    }
    if (ip.visit_count > 1) {
      row.className = "repeat-connection";
      connection.textContent += " · Repeat IP";
    }
    return row;
  });
  if (!rows.length) {
    const row = document.createElement("tr");
    const cell = row.insertCell();
    cell.colSpan = 8;
    cell.textContent = "No IP addresses recorded yet.";
    rows.push(row);
  }
  document.querySelector("#distinct-ips").replaceChildren(...rows);

  const newAlerts = visitors.alerts.filter((event) => !alerted.has(event.id));
  for (const event of newAlerts) alerted.set(event.id, Date.parse(event.opened_at));
  for (const [id, time] of alerted) {
    if (time < Date.parse(visitors.as_of) - 60_000) alerted.delete(id);
  }
  alertsAfter = visitors.as_of;
  if (newAlerts.length) {
    const browsers = newAlerts.filter((event) => event.repeat_browser).length;
    const ipOnly = newAlerts.length - browsers;
    const labels = [];
    if (browsers) labels.push(`${number.format(browsers)} returning-browser ${browsers === 1 ? "view" : "views"}`);
    if (ipOnly) labels.push(`${number.format(ipOnly)} repeat-IP ${ipOnly === 1 ? "view" : "views"}`);
    repeatPopup.hidden = false;
    repeatStatus.textContent = labels.join(" · ");
  }
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
    const [metrics, log, visitors] = await getData(activeSession);
    if (session !== activeSession) return;
    renderMetrics(metrics);
    renderTimeline(log);
    renderVisitors(visitors);
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
  document.querySelector("#dismiss-repeat").addEventListener("click", () => {
    repeatPopup.hidden = true;
    repeatStatus.textContent = "";
  });
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
