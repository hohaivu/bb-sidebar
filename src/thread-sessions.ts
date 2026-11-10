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

/** `null` removes the thread from every session. The codec normalizes on write, so empty sessions drop out. */
export function moveThreadToSession(
  sessions: readonly ThreadSession[],
  threadId: string,
  sessionId: string | null,
): ThreadSession[] {
  return sessions.map((session) => {
    const threadIds = session.threadIds.filter((id) => id !== threadId);
    return { ...session, threadIds: session.id === sessionId ? [...threadIds, threadId] : threadIds };
  });
}

/** A name that matches an existing session, ignoring case, joins it. `name` is already trimmed. */
export function createSession(
  sessions: readonly ThreadSession[],
  name: string,
  threadId: string,
  id: string,
): ThreadSession[] {
  const existing = sessions.find((session) => session.name.toLowerCase() === name.toLowerCase());
  return moveThreadToSession(
    existing ? sessions : [...sessions, { id, name, threadIds: [], expanded: true }],
    threadId,
    existing?.id ?? id,
  );
}
