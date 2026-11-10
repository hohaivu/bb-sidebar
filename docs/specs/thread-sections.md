# Thread sections

A section is a shelf that the user names by hand. It groups top-level threads in the sidebar. This spec also records the rules that decide which shelf shows each thread.

## Terms

| Term | Meaning |
| --- | --- |
| Shelf | A collapsible region of thread rows in the sidebar, for example Pinned or Active. |
| Section | A user-named shelf. It has an id, a name, a list of thread ids, and an expanded flag. |
| Member | A thread whose id is in the list of a section. |
| Top-level thread | A thread that has no parent thread. |
| Subscribe mode | A mode of `usePersistedPreference`. The hook reads storage again when a storage event or a codec event fires. |

## Entry points

| Part | File | Role |
| --- | --- | --- |
| Pure rules | `src/thread-sections.ts` | Normalizes sections, creates a section, and moves a thread between sections. It has no React and no browser API. |
| State hook | `src/useThreadSections.ts` | Reads and writes the stored sections. It toggles the collapse state. It removes members that leave the thread list. |
| Placement | `src/useInboxShelfThreads.ts` | Decides which shelf shows each thread. |
| Render | `src/ThreadInboxView.tsx` | Renders the shelves and the empty states. |
| Row menu | `src/RowContextMenu.tsx` | Holds the Section submenu. |
| Dialog | `src/NewSectionDialog.tsx` | Asks for the name of a new section. |
| Storage | `src/lib/use-persisted-preference.ts`, `src/lib/storage-keys.ts` | Read, write and key registry for device-local preferences. |

## Shelf placement

`useInboxShelfThreads` computes the shelves in this order. An earlier step wins over a later step.

1. Archived threads are hidden. Reason: an archived thread never belongs in the inbox.
2. The project scope keeps only threads of the selected projects. An empty scope keeps all projects.
3. A child thread is hidden when its parent is on screen. The child shows in the chip of its parent. An orphan whose parent is not on screen stays in the list.
4. The lifecycle state sends a thread to the Parked, Snoozed or Settled shelf.
5. A pinned thread goes to Pinned. BB supplies pinned threads in the persisted pin order.
6. Each remaining thread goes to its section, if it is a member. Reason: a section is an explicit user choice, and Working is automatic.
7. Each other thread goes to Active, Working or Inactive.

Step 7 applies these checks in order. The first match wins.

1. A row that the user renames in Active keeps Active. Reason: the row must not move while its editor is open.
2. A row that the user renames in Working keeps Working, if the Working shelf is on, the thread needs no attention, and it did not just wake from a snooze.
3. A row that the user renames in Inactive keeps Inactive, if the thread needs no attention.
4. A thread with work running under it goes to Working, if the Working shelf is on and the thread did not just wake from a snooze. Reason: a wake is news for Active.
5. A thread that has been idle longer than the inactive limit goes to Inactive, unless a child asks a question.
6. Every other thread goes to Active.

A thread needs attention when it needs attention itself or when a child asks a question.

Active, Working and Inactive each sort by creation time, newest first.

Section members skip step 7. A working member stays in its section and does not show in Working.

## Shelf order

`ThreadInboxView` renders the shelves in this order: Pinned, section shelves, Active, Working, Inactive, Snoozed, Parked, Settled.

- Each section shelf has a name, a count and a collapse toggle. Section shelves follow the creation order of their sections.
- A section shelf with no threads does not render.
- A section shelf row shows its project. Its rename shelf is "active".
- The user can reorder a section shelf row by drag and by Alt+ArrowUp or Alt+ArrowDown. The row moves only among the visible rows of its own section. This applies in every Active sort mode. Reason: the order of a section is always manual.
- Section shelves show their members in the shared inbox order. Active, Working and Inactive use the same order. A reorder inside a section saves to that order. Reason: one durable order needs no new storage and no new RPC.
- A member that leaves its section returns to Active at the slot that it last held in the shared inbox order.
- The user cannot drag a row into another section or another shelf. Membership changes only through the row menu.
- The Alt+Arrow announcement names the section, for example "X moved to 2 of 4 in Work".
- The collapse state of a section shelf persists with the section.
- `ActiveEmptyState` renders when Pinned, no section shelf, Active, Working and Inactive all have no threads.
- `WorkingEmptyState` renders when Pinned, no section shelf and Active have no threads, Working has threads, and Inactive has none.

## Membership rules

- A thread belongs to at most one section. Moving a thread to a section removes it from every other section.
- Membership is dormant while a higher-priority placement wins. A parked, snoozed, settled or pinned member keeps its membership. It returns to its section when resumed, woken, un-settled or unpinned.
- "None" removes the thread from its section. The thread then returns to Active, Working or Inactive.
- A section with no threads disappears, and its stored entry disappears. There is no rename and no explicit delete.
- `useThreadSections` removes a member only when the window knows that the thread left the thread list. Each ready thread list counts, and the hook compares it with the previous ready list of the same window.
- The hook also removes a member in this case. The member was stored before the first ready list of the window, and that list does not contain it.
- Absence from the list is not enough to remove a member. Reason: another window can add a member before the thread list of this window shows it. A removal would then reach the shared storage and delete the new member.
- The list holds only unarchived threads, so archive and delete both remove a member. The code cannot tell them apart without a backend query.
- The prune writes only when it removes an id. Reason: a write in subscribe mode always notifies, so an unconditional write would loop.
- Only `ThreadInbox` passes the thread list to `useThreadSections`. The menu and the dialog read and write without pruning.

## Row menu

`RowMenuContents` builds the thread menu. Its items appear in this order:

1. Open in split.
2. Parent (`ParentThreadMenu`).
3. Parent notifications, only when `notifiesParent` is true.
4. Project, only when project actions exist.
5. Section, only for a top-level, unpinned row that is not parked, snoozed or settled.
6. A separator, when a Pin or lifecycle item follows.
7. Pin or Unpin.
8. Snooze, when snooze is allowed and presets exist.
9. Wake now, Park thread, Resume, Settle and Un-settle, each when its handler exists.
10. A separator, then Rename, Regenerate title and Mark read or Mark unread.
11. A separator, then Copy.
12. A separator, then Archive and Delete.

The Section submenu has a radio group and one command:

- The group holds "None" and one item for each section. The current section is checked.
- A separator follows the group. Then "New section…" opens `NewSectionDialog`.
- A pinned row, a child row, and a parked, snoozed or settled row show no Section item. Reason: these rows are placed by a higher-priority rule.

## New section dialog

- The dialog title is "New section". It has one text input with the label "Section name".
- The input accepts 1 to 60 characters. The code trims the name before it checks the length.
- The input starts empty each time the dialog opens, and it has focus.
- The Create button stays disabled while the trimmed name is empty. Enter submits the form.
- A trimmed name that matches an existing section name, ignoring case, adds the thread to that section. No second section appears.
- Any other name adds a new section at the end of the list, with `expanded` set to true. The thread leaves any other section.

## Menu focus and dialogs

The delete and snooze dialogs open from the menu. The menu cannot return focus to the row when a dialog needs focus.

- `onCloseAutoFocus` prevents the default focus return while `confirmingDelete` or `pickingSnooze` is set. The section dialog uses the same rule with its own flag.
- Rename differs. The menu sets `renameAfterClose`. After the menu closes, the code prevents the default and runs the rename action. Reason: the editor must get focus after the menu releases its focus scope.
- The dialogs mount next to the menu, not inside it. Reason: the menu content unmounts when a choice closes the menu, and the dialog must outlive it.
- The snooze dialog mounts only when a snooze handler exists.
- The dialog content stops the `contextmenu` event.

## Storage

Sections live in browser local storage. Scope: one browser profile and one origin. Windows on the same origin share sections. Other browsers, servers and devices do not.

- The key is `bb-sidebar:thread-sessions:v1`. Reason: the key keeps its old name so saved sections still load. The value is a JSON array of `{ id, name, threadIds, expanded }`.
- Every storage key lives in `STORAGE_KEYS` in `src/lib/storage-keys.ts`. Reason: one registry lets the quota logic know every plugin key.
- The sections key has eviction priority 89. Lower priorities are evicted first. Reason: the user wrote the data, so it is among the last to go.
- When a write exceeds the quota, `safeSetItem` removes the other plugin keys in ascending priority order. It retries after each removal. If the write still fails, it removes the key itself and reports failure.
- Decode runs one time at the boundary. It drops entries of the wrong shape, then normalizes the result. A value that is not an array reads as no sections. Corrupt JSON reads as no sections.
- Normalize trims names and drops empty names. It drops a duplicate section id and keeps the first. It keeps each thread in one section and keeps the first. It drops sections with no threads. Applying it twice gives the same result as applying it once.
- A write passes through normalize before it reaches storage. A failed write leaves the UI unchanged and shows no error.
- Writes dispatch the `bb-sidebar:thread-sections-changed` event. Reason: the browser fires the `storage` event only in other windows.

## Preference hook

`usePersistedPreference(key, codec)` returns the value and a setter.

- Without `subscribe`, the hook keeps the value in React state and writes it to storage in an effect.
- In subscribe mode, the hook reads the raw stored string through `useSyncExternalStore`. It decodes the string. If decode fails or returns null, it uses the codec fallback.
- The decoded value keeps its identity until the stored string changes. Reason: a new array on each render would run every effect that depends on it again.
- The setter reads the current stored value and applies the update. It writes the result and calls `notify`. Reason: several components share the same state, so each write must reach all of them.
- A codec with `subscribe` supplies `notify`. `PortLinkSettings` and the sections codec follow this pattern.

## Related decisions

None.
