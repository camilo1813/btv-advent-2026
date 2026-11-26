import { supabaseUrl, supabasePublishableKey } from "./config.js";

export const configured = Boolean(supabaseUrl && supabasePublishableKey);

export class SupabaseError extends Error {
  constructor(status) {
    super("Supabase request failed");
    this.status = status;
  }
}

export async function request(path, body, accessToken, { keepalive = false } = {}) {
  if (!configured) throw new Error("Supabase is not configured");

  const headers = {
    apikey: supabasePublishableKey,
    "Content-Type": "application/json",
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const response = await fetch(new URL(path, supabaseUrl), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    keepalive,
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new SupabaseError(response.status);
  if (response.status === 204) return null;
  return response.json();
}

export function rpc(name, args, accessToken, options) {
  return request(`/rest/v1/rpc/${name}`, args, accessToken, options);
}
