/**
 * Single source of truth for the backend base URL, shared by every REST API
 * client and the socket.io connections so they always point at the same host.
 *
 * To change the backend URL, edit the fallback below (or set the
 * `VITE_API_BASE_URL` env var to override it per-environment, e.g.
 * http://localhost:3002 for local testing). Every file imports `API_BASE_URL`
 * from here, so this is the only place that ever needs to change.
 */
export const API_BASE_URL =
  ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "")
    .trim()
    .replace(/\/+$/, "") || "https://api.trusto.exchange";
