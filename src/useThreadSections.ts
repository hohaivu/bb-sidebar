import { useCallback, useEffect, useMemo, useRef } from "react";
import type { PluginSidebarThread } from "@get-bb/plugin-sdk/app";
import type { useSidebarThreads } from "./bb-sdk";
import { threadSectionsCodec } from "./lib/inbox-preference-codecs";
import { STORAGE_KEYS } from "./lib/storage-keys";
import { usePersistedPreference } from "./lib/use-persisted-preference";
import { visibleShelfThreads } from "./inbox-layout";
import { orderPinnedThreads } from "./pinned-order";
import { createSection, moveThreadToSection, type ThreadSection } from "./thread-sections";

/** Only the inbox passes `snapshot`, so only it prunes ids the host no longer lists. */
export function useThreadSections(snapshot?: Pick<ReturnType<typeof useSidebarThreads>, "threads" | "status">) {
  const [sections, setSections] = usePersistedPreference(STORAGE_KEYS.threadSections.key, threadSectionsCodec);
  const threads = snapshot?.threads;
  const ready = snapshot?.status === "ready";
  const listed = useRef<ReadonlySet<string> | null>(null);
  useEffect(() => {
    if (!ready || !threads) return;
    const known = new Set(threads.map((thread) => thread.id));
    // Another window can add a member before this window's list shows it, so only an id that was
    // listed (or stored before the first list) and now is not counts as archived or deleted.
    const before = listed.current ?? new Set(sections.flatMap((section) => section.threadIds));
    listed.current = known;
    const gone = (id: string) => before.has(id) && !known.has(id);
    // A subscribe-mode write always notifies, so write only when an id is gone.
    if (sections.some((section) => section.threadIds.some(gone))) {
      setSections((current) =>
        current.map((section) => ({ ...section, threadIds: section.threadIds.filter((id) => !gone(id)) })),
      );
    }
  }, [ready, threads, sections, setSections]);
  const sectionThreadIds = useMemo(
    () => new Map(sections.flatMap((section) => section.threadIds.map((id) => [id, section.id] as const))),
    [sections],
  );
  return {
    sections,
    sectionThreadIds,
    moveThread: useCallback(
      (threadId: string, sectionId: string | null) =>
        setSections((current) => moveThreadToSection(current, threadId, sectionId)),
      [setSections],
    ),
    createSection: useCallback(
      (name: string, threadId: string) =>
        setSections((current) => createSection(current, name, threadId, crypto.randomUUID())),
      [setSections],
    ),
    toggleSection: useCallback(
      (id: string) =>
        setSections((current) =>
          current.map((section) => (section.id === id ? { ...section, expanded: !section.expanded } : section)),
        ),
      [setSections],
    ),
  };
}

/** One shelf per section that still has a visible member, in creation order. */
export function useSectionShelves({
  sections,
  sectionBase,
  order,
  activeThreadId,
  attentionIds,
}: {
  sections: readonly ThreadSection[];
  sectionBase: readonly PluginSidebarThread[];
  order: readonly string[] | null;
  activeThreadId: string | null;
  attentionIds: ReadonlySet<string>;
}) {
  return useMemo(
    () =>
      sections.flatMap((section) => {
        const threads = orderPinnedThreads(
          sectionBase.filter((thread) => section.threadIds.includes(thread.id)),
          order,
        );
        const visibleThreads = visibleShelfThreads(threads, section.expanded, activeThreadId, undefined, attentionIds);
        return threads.length > 0 ? [{ section, threads, visibleThreads }] : [];
      }),
    [activeThreadId, attentionIds, order, sectionBase, sections],
  );
}
