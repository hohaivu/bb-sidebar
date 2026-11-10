export interface ThreadSession {
  id: string;
  name: string;
  threadIds: string[];
  expanded: boolean;
}

/** Trim names, then keep the first of each session id and the first session of each thread. */
export function normalizeSessions(sessions: readonly ThreadSession[]): ThreadSession[] {
  const seenSessions = new Set<string>();
  const seenThreads = new Set<string>();
  const result: ThreadSession[] = [];
  for (const session of sessions) {
    const name = session.name.trim();
    if (!name || seenSessions.has(session.id)) continue;
    seenSessions.add(session.id);
    const threadIds = [...new Set(session.threadIds)].filter((id) => !seenThreads.has(id));
    if (threadIds.length === 0) continue;
    for (const id of threadIds) seenThreads.add(id);
    result.push({ ...session, name, threadIds });
  }
  return result;
}

/** `null` removes the thread from every session. */
export function moveThreadToSession(
  sessions: readonly ThreadSession[],
  threadId: string,
  sessionId: string | null,
): ThreadSession[] {
  return normalizeSessions(
    sessions.map((session) => ({
      ...session,
      threadIds:
        session.id === sessionId
          ? [...session.threadIds.filter((id) => id !== threadId), threadId]
          : session.threadIds.filter((id) => id !== threadId),
    })),
  );
}

/** A name that matches an existing session, ignoring case, joins it. */
export function createSession(
  sessions: readonly ThreadSession[],
  name: string,
  threadId: string,
  id: string,
): ThreadSession[] {
  const trimmed = name.trim();
  const existing = sessions.find((session) => session.name.trim().toLowerCase() === trimmed.toLowerCase());
  if (existing) return moveThreadToSession(sessions, threadId, existing.id);
  return moveThreadToSession([...sessions, { id, name: trimmed, threadIds: [], expanded: true }], threadId, id);
}

export function toggleSessionExpanded(sessions: readonly ThreadSession[], id: string): ThreadSession[] {
  return sessions.map((session) => (session.id === id ? { ...session, expanded: !session.expanded } : session));
}

export function pruneSessionThreads(
  sessions: readonly ThreadSession[],
  knownThreadIds: ReadonlySet<string>,
): ThreadSession[] {
  return normalizeSessions(
    sessions.map((session) => ({ ...session, threadIds: session.threadIds.filter((id) => knownThreadIds.has(id)) })),
  );
}
