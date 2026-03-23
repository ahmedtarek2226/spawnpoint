// In-memory session store. Sessions are lost on restart, which is acceptable
// for a self-hosted dashboard — users just log in again.
export const activeSessions = new Set<string>();
