import { configured, rpc } from "./supabase.js?v=5";
import { trackPageActivity } from "./engagement.js";

const source = new URLSearchParams(location.search).get("utm_source")?.toLowerCase() === "whatsapp"
  ? "whatsapp"
  : "other";

function browserToken() {
  try {
    const key = "btv-advent-browser";
    const saved = localStorage.getItem(key);
    if (saved && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(saved)) return saved;
    const token = crypto.randomUUID();
    localStorage.setItem(key, token);
    return token;
  } catch {
    return null;
  }
}

async function countView() {
  if (document.visibilityState !== "visible" || !globalThis.crypto?.randomUUID) return;
  document.removeEventListener("visibilitychange", countView);
  const args = { view_id: crypto.randomUUID(), campaign_source: source, browser_token: browserToken() };
  const activityReady = trackPageActivity(args.view_id);
  try {
    await rpc("btv_record_browser_view", args);
  } catch {
    // A lost response may have arrived after the insert. Reuse its ID on retry.
    if (document.visibilityState !== "visible") return;
    try { await rpc("btv_record_browser_view", args); }
    catch { return; }
  }
  activityReady();
}

if (configured) {
  document.addEventListener("visibilitychange", countView);
  void countView();

  const form = document.querySelector("#signup-form");
  const status = document.querySelector("#signup-status");
  const submit = form.querySelector("button");
  form.hidden = false;
  document.querySelector("#signup-unavailable").hidden = true;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = new FormData(form).get("email").trim();
    submit.disabled = true;
    status.textContent = "Saving your sign-up…";
    try {
      await rpc("btv_sign_up_for_updates", { signup_email: email, campaign_source: source });
      form.reset();
      status.textContent = "You’re signed up for Advent Challenge updates.";
    } catch {
      status.textContent = "We couldn’t save your sign-up. Please try again.";
    } finally {
      submit.disabled = false;
    }
  });
}
