/**
 * App-wide socket.io connection for the authenticated session.
 *
 * A single socket is shared across the whole app (not scoped to any screen) so
 * server-pushed events — like `withdrawal:payment_initiated` — are received no
 * matter where the user has navigated. The connection is opened once the user
 * is authenticated and torn down on logout.
 *
 * Auth: the JWT is passed in the handshake (`auth.token`). The backend reads it
 * from `handshake.auth.token` and disconnects the socket if it's missing or
 * invalid, so we only connect once we have a token and re-establish the
 * connection after login / token refresh (a changed token rebuilds the socket
 * so the new token is sent in the handshake).
 */

import { io, type Socket } from "socket.io-client";
import { API_BASE_URL } from "@/lib/api-base";

let socket: Socket | null = null;
let currentToken: string | null = null;

export function getSocket(): Socket | null {
  return socket;
}

/**
 * Open (or refresh) the shared connection for the given access token.
 *
 * Safe to call repeatedly: if the token is unchanged the existing socket is
 * returned (reconnecting only if it had dropped). If the token changed
 * (login / refresh) the old socket is torn down and a new one built, because
 * socket.io only reads `auth` during the handshake.
 */
export function connectSocket(token: string): Socket {
  if (socket && currentToken === token) {
    if (!socket.connected) socket.connect();
    return socket;
  }
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  currentToken = token;
  // Same env-driven base URL as the REST API.
  socket = io(API_BASE_URL, {
    auth: { token },
  });
  return socket;
}

/** Tear down the connection and forget the token (call on logout). */
export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  currentToken = null;
}
