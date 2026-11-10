import { useCallback, useEffect, useMemo } from "react";
import type { PluginSidebarThread } from "@get-bb/plugin-sdk/app";
import type { useSidebarThreads } from "./bb-sdk";
import { threadSessionsCodec } from "./lib/inbox-preference-codecs";
import { STORAGE_KEYS } from "./lib/storage-keys";
import { usePersistedPreference } from "./lib/use-persisted-preference";
import { visibleShelfThreads } from "./inbox-layout";
import { orderPinnedThreads } from "./pinned-order";
import { createSession, moveThreadToSession, type ThreadSession } from "./thread-sessions";

/** Only the inbox passes `snapshot`, so only it prunes ids the host no longer lists. */
export function useThreadSessions(snapshot?: Pick<ReturnType<typeof useSidebarThreads>, "threads" | "status">) {
  const [sessions, setSessions] = usePersistedPreference(STORAGE_KEYS.threadSessions.key, threadSessionsCodec);
  const threads = snapshot?.threads;
  const ready = snapshot?.status === "ready";
  useEffect(() => {
    if (!ready || !threads) return;
    const known = new Set(threads.map((thread) => thread.id));
    // A subscribe-mode write always notifies, so write only when an id is unknown.
    if (sessions.some((session) => session.threadIds.some((id) => !known.has(id)))) {
      setSessions((current) =>
        current.map((session) => ({ ...session, threadIds: session.threadIds.filter((id) => known.has(id)) })),
      );
    }
  }, [ready, threads, sessions, setSessions]);
  const sessionThreadIds = useMemo(
    () => new Map(sessions.flatMap((session) => session.threadIds.map((id) => [id, session.id] as const))),
    [sessions],
  );
  return {
    sessions,
    sessionThreadIds,
    moveThread: useCallback(
      (threadId: string, sessionId: string | null) =>
        setSessions((current) => moveThreadToSession(current, threadId, sessionId)),
      [setSessions],
    ),
    createSession: useCallback(
      (name: string, threadId: string) =>
        setSessions((current) => createSession(current, name, threadId, crypto.randomUUID())),
      [setSessions],
    ),
    toggleSession: useCallback(
      (id: string) =>
        setSessions((current) =>
          current.map((session) => (session.id === id ? { ...session, expanded: !session.expanded } : session)),
        ),
      [setSessions],
    ),
  };
}

/** One shelf per session that still has a visible member, in creation order. */
export function useSessionShelves({
  sessions,
  sessionBase,
  order,
  activeThreadId,
  attentionIds,
}: {
  sessions: readonly ThreadSession[];
  sessionBase: readonly PluginSidebarThread[];
  order: readonly string[] | null;
  activeThreadId: string | null;
  attentionIds: ReadonlySet<string>;
}) {
  return useMemo(
    () =>
      sessions.flatMap((session) => {
        const threads = orderPinnedThreads(
          sessionBase.filter((thread) => session.threadIds.includes(thread.id)),
          order,
        );
        const visibleThreads = visibleShelfThreads(threads, session.expanded, activeThreadId, undefined, attentionIds);
        return threads.length > 0 ? [{ session, threads, visibleThreads }] : [];
      }),
    [activeThreadId, attentionIds, order, sessionBase, sessions],
  );
}
