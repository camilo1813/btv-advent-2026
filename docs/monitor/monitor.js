import { configured, request, rpc } from "../supabase.js";

const form = document.querySelector("#monitor-login");
const submit = form.querySelector("button");
const panel = document.querySelector("#monitor-data");
const message = document.querySelector("#monitor-message");
const refreshButton = document.querySelector("#refresh");
const hours = document.querySelector("#hourly-views");
const lastRefresh = document.querySelector("#last-refresh");
const number = new Intl.NumberFormat("en-IN");
const date = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});

let session = null;
let refreshing = false;

function clearSession() {
  const previous = session;
  session = null;
  panel.hidden = true;
  form.hidden = false;
  form.reset();
  if (previous) {
    void request("/auth/v1/logout?scope=local", {}, previous.access_token).catch(() => {});
  }
}

async function getMetrics(activeSession) {
  try {
    return await rpc("btv_launch_metrics", {}, activeSession.access_token);
  } catch (error) {
    if (error.status !== 401 || !activeSession.refresh_token) throw error;
    const renewed = await request("/auth/v1/token?grant_type=refresh_token", {
      refresh_token: activeSession.refresh_token,
    });
    Object.assign(activeSession, renewed);
    return rpc("btv_launch_metrics", {}, activeSession.access_token);
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

  const rows = metrics.hours.map((hour) => {
    const row = document.createElement("tr");
    const heading = document.createElement("th");
    heading.scope = "row";
    heading.textContent = date.format(new Date(hour.start));
    row.append(heading);
    row.insertCell().textContent = number.format(hour.views);
    row.insertCell().textContent = number.format(hour.whatsapp_views);
    return row;
  });
  hours.replaceChildren(...rows);
  lastRefresh.textContent = `Last updated ${date.format(new Date(metrics.updated_at))} IST`;
}

async function refresh() {
  if (!session || refreshing) return;
  refreshing = true;
  refreshButton.disabled = true;
  const activeSession = session;
  try {
    const metrics = await getMetrics(activeSession);
    if (session !== activeSession) return;
    renderMetrics(metrics);
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
    refreshButton.disabled = false;
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
  document.querySelector("#sign-out").addEventListener("click", () => {
    clearSession();
    message.textContent = "Signed out.";
  });
  function refreshWhenVisible() {
    if (document.visibilityState === "visible") void refresh();
  }
  document.addEventListener("visibilitychange", refreshWhenVisible);
  setInterval(refreshWhenVisible, 15_000);
}
