import { rpc } from "./supabase.js?v=5";

const maximumTime = 43_200_000;
const milestones = [25, 50, 75, 100];

export function trackPageActivity(viewId) {
  const openedAt = performance.now();
  let visibleSince = openedAt;
  let visibleTime = 0;
  let scrollDepth = 0;
  let eventNumber = 0;
  let ready = false;
  let sending = false;
  let scheduled = 0;
  let sentTime = -1;
  let sentDepth = -1;
  const pending = new Map();

  function record(action) {
    if (eventNumber >= 100) return;
    eventNumber += 1;
    pending.set(eventNumber, {
      event_no: eventNumber,
      action,
      offset_ms: Math.min(maximumTime, Math.round(performance.now() - openedAt)),
    });
  }

  function updateScroll() {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    if (scrollable <= 0) {
      scrollDepth = 100;
      return;
    }
    const depth = Math.max(0, Math.min(100, Math.floor(100 * (window.scrollY + 1) / scrollable)));
    for (const milestone of milestones) {
      if (scrollDepth < milestone && depth >= milestone) record(`scroll_${milestone}`);
    }
    scrollDepth = Math.max(scrollDepth, depth);
  }

  async function flush(keepalive = false) {
    if (!ready || (sending && !keepalive)) return;
    const elapsed = visibleTime + (visibleSince === null ? 0 : performance.now() - visibleSince);
    const duration = Math.min(maximumTime, Math.floor(elapsed / 1000) * 1000);
    const depth = scrollDepth;
    const events = [...pending.values()];
    if (duration <= sentTime && depth <= sentDepth && !events.length) return;
    if (!keepalive) sending = true;
    try {
      await rpc("btv_record_view_activity", {
        target_view_id: viewId,
        active_ms: duration,
        deepest_scroll: depth,
        activity_events: events,
      }, undefined, { keepalive });
      sentTime = Math.max(sentTime, duration);
      sentDepth = Math.max(sentDepth, depth);
      for (const event of events) pending.delete(event.event_no);
    } catch {
      // The next checkpoint can safely resend any unconfirmed events.
    } finally {
      if (!keepalive) sending = false;
    }
  }

  function pause() {
    if (visibleSince !== null) {
      visibleTime += performance.now() - visibleSince;
      visibleSince = null;
    }
    void flush(true);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") pause();
    else {
      visibleSince ??= performance.now();
      updateScroll();
    }
  });
  window.addEventListener("pagehide", pause);
  window.addEventListener("pageshow", () => {
    if (document.visibilityState === "visible") visibleSince ??= performance.now();
  });
  window.addEventListener("scroll", updateScroll, { passive: true });
  window.addEventListener("resize", updateScroll, { passive: true });
  document.addEventListener("click", (event) => {
    if (!event.isTrusted || !(event.target instanceof Element)) return;
    const marked = event.target.closest("[data-analytics]");
    const link = event.target.closest("a[href]");
    if (marked) record(marked.dataset.analytics);
    else if (event.target.closest("form, input, textarea, select, [contenteditable]")) return;
    else if (link || event.target.closest("button, [role='button']")) record("control_other");
    else record(event.target.closest("[data-page-area]")?.dataset.pageArea ?? "page_other");

    if (link) void flush(true);
    else if (!scheduled) {
      scheduled = window.setTimeout(() => {
        scheduled = 0;
        void flush();
      }, 500);
    }
  }, { capture: true, passive: true });
  window.setInterval(() => {
    if (visibleSince !== null) void flush();
  }, 15_000);
  updateScroll();
  return () => {
    ready = true;
    void flush(document.visibilityState === "hidden");
  };
}
