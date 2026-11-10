export interface ThreadSection {
  id: string;
  name: string;
  threadIds: string[];
  expanded: boolean;
}

/** Trim names, then keep the first of each section id and the first section of each thread. */
export function normalizeSections(sections: readonly ThreadSection[]): ThreadSection[] {
  const seenSections = new Set<string>();
  const seenThreads = new Set<string>();
  const result: ThreadSection[] = [];
  for (const section of sections) {
    const name = section.name.trim();
    if (!name || seenSections.has(section.id)) continue;
    seenSections.add(section.id);
    const threadIds = [...new Set(section.threadIds)].filter((id) => !seenThreads.has(id));
    if (threadIds.length === 0) continue;
    for (const id of threadIds) seenThreads.add(id);
    result.push({ ...section, name, threadIds });
  }
  return result;
}

/** `null` removes the thread from every section. The codec normalizes on write, so empty sections drop out. */
export function moveThreadToSection(
  sections: readonly ThreadSection[],
  threadId: string,
  sectionId: string | null,
): ThreadSection[] {
  return sections.map((section) => {
    const threadIds = section.threadIds.filter((id) => id !== threadId);
    return { ...section, threadIds: section.id === sectionId ? [...threadIds, threadId] : threadIds };
  });
}

/** A name that matches an existing section, ignoring case, joins it. `name` is already trimmed. */
export function createSection(
  sections: readonly ThreadSection[],
  name: string,
  threadId: string,
  id: string,
): ThreadSection[] {
  const existing = sections.find((section) => section.name.toLowerCase() === name.toLowerCase());
  return moveThreadToSection(
    existing ? sections : [...sections, { id, name, threadIds: [], expanded: true }],
    threadId,
    existing?.id ?? id,
  );
}
