# Thread sessions

A session is a shelf that the user names by hand. It groups top-level threads in the sidebar. This spec also records the rules that decide which shelf shows each thread.

## Terms

| Term | Meaning |
| --- | --- |
| Shelf | A collapsible region of thread rows in the sidebar, for example Pinned or Active. |
| Session | A user-named shelf. It has an id, a name, a list of thread ids, and an expanded flag. |
| Member | A thread whose id is in the list of a session. |
| Top-level thread | A thread that has no parent thread. |
| Subscribe mode | A mode of `usePersistedPreference`. The hook reads storage again when a storage event or a codec event fires. |

## Entry points

| Part | File | Role |
| --- | --- | --- |
| Pure rules | `src/thread-sessions.ts` | Normalizes sessions, creates a session, and moves a thread between sessions. It has no React and no browser API. |
| State hook | `src/useThreadSessions.ts` | Reads and writes the stored sessions. It toggles the collapse state. It removes members that leave the thread list. |
| Placement | `src/useInboxShelfThreads.ts` | Decides which shelf shows each thread. |
| Render | `src/ThreadInboxView.tsx` | Renders the shelves and the empty states. |
| Row menu | `src/RowContextMenu.tsx` | Holds the Session submenu. |
| Dialog | `src/NewSessionDialog.tsx` | Asks for the name of a new session. |
| Storage | `src/lib/use-persisted-preference.ts`, `src/lib/storage-keys.ts` | Read, write and key registry for device-local preferences. |

## Shelf placement

`useInboxShelfThreads` computes the shelves in this order. An earlier step wins over a later step.

1. Archived threads are hidden. Reason: an archived thread never belongs in the inbox.
2. The project scope keeps only threads of the selected projects. An empty scope keeps all projects.
3. A child thread is hidden when its parent is on screen. The child shows in the chip of its parent. An orphan whose parent is not on screen stays in the list.
4. The lifecycle state sends a thread to the Parked, Snoozed or Settled shelf.
5. A pinned thread goes to Pinned. BB supplies pinned threads in the persisted pin order.
6. Each remaining thread goes to its session, if it is a member. Reason: a session is an explicit user choice, and Working is automatic.
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

Session members skip step 7. A working member stays in its session and does not show in Working.

## Shelf order

`ThreadInboxView` renders the shelves in this order: Pinned, session shelves, Active, Working, Inactive, Snoozed, Parked, Settled.

- Each session shelf has a name, a count and a collapse toggle. Session shelves follow the creation order of their sessions.
- A session shelf with no threads does not render.
- A session shelf row is not reorderable and shows its project. Its rename shelf is "active".
- The collapse state of a session shelf persists with the session.
- `ActiveEmptyState` renders when Pinned, no session shelf, Active, Working and Inactive all have no threads.
- `WorkingEmptyState` renders when Pinned, no session shelf and Active have no threads, Working has threads, and Inactive has none.

## Membership rules

- A thread belongs to at most one session. Moving a thread to a session removes it from every other session.
- Membership is dormant while a higher-priority placement wins. A parked, snoozed, settled or pinned member keeps its membership. It returns to its session when resumed, woken, un-settled or unpinned.
- "None" removes the thread from its session. The thread then returns to Active, Working or Inactive.
- A session with no threads disappears, and its stored entry disappears. There is no rename and no explicit delete.
- `useThreadSessions` removes a member only when the window knows that the thread left the thread list. Each ready thread list counts, and the hook compares it with the previous ready list of the same window.
- The hook also removes a member in this case. The member was stored before the first ready list of the window, and that list does not contain it.
- Absence from the list is not enough to remove a member. Reason: another window can add a member before the thread list of this window shows it. A removal would then reach the shared storage and delete the new member.
- The list holds only unarchived threads, so archive and delete both remove a member. The code cannot tell them apart without a backend query.
- The prune writes only when it removes an id. Reason: a write in subscribe mode always notifies, so an unconditional write would loop.
- Only `ThreadInbox` passes the thread list to `useThreadSessions`. The menu and the dialog read and write without pruning.

## Row menu

`RowMenuContents` builds the thread menu. Its items appear in this order:

1. Open in split.
2. Parent (`ParentThreadMenu`).
3. Parent notifications, only when `notifiesParent` is true.
4. Project, only when project actions exist.
5. Session, only for a top-level, unpinned row that is not parked, snoozed or settled.
6. A separator, when a Pin or lifecycle item follows.
7. Pin or Unpin.
8. Snooze, when snooze is allowed and presets exist.
9. Wake now, Park thread, Resume, Settle and Un-settle, each when its handler exists.
10. A separator, then Rename, Regenerate title and Mark read or Mark unread.
11. A separator, then Copy.
12. A separator, then Archive and Delete.

The Session submenu has a radio group and one command:

- The group holds "None" and one item for each session. The current session is checked.
- A separator follows the group. Then "New session…" opens `NewSessionDialog`.
- A pinned row, a child row, and a parked, snoozed or settled row show no Session item. Reason: these rows are placed by a higher-priority rule.

## New session dialog

- The dialog title is "New session". It has one text input with the label "Session name".
- The input accepts 1 to 60 characters. The code trims the name before it checks the length.
- The input starts empty each time the dialog opens, and it has focus.
- The Create button stays disabled while the trimmed name is empty. Enter submits the form.
- A trimmed name that matches an existing session name, ignoring case, adds the thread to that session. No second session appears.
- Any other name adds a new session at the end of the list, with `expanded` set to true. The thread leaves any other session.

## Menu focus and dialogs

The delete and snooze dialogs open from the menu. The menu cannot return focus to the row when a dialog needs focus.

- `onCloseAutoFocus` prevents the default focus return while `confirmingDelete` or `pickingSnooze` is set. The session dialog uses the same rule with its own flag.
- Rename differs. The menu sets `renameAfterClose`. After the menu closes, the code prevents the default and runs the rename action. Reason: the editor must get focus after the menu releases its focus scope.
- The dialogs mount next to the menu, not inside it. Reason: the menu content unmounts when a choice closes the menu, and the dialog must outlive it.
- The snooze dialog mounts only when a snooze handler exists.
- The dialog content stops the `contextmenu` event.

## Storage

Sessions live in browser local storage. Scope: one browser profile and one origin. Windows on the same origin share sessions. Other browsers, servers and devices do not.

- The key is `bb-sidebar:thread-sessions:v1`. The value is a JSON array of `{ id, name, threadIds, expanded }`.
- Every storage key lives in `STORAGE_KEYS` in `src/lib/storage-keys.ts`. Reason: one registry lets the quota logic know every plugin key.
- The sessions key has eviction priority 89. Lower priorities are evicted first. Reason: the user wrote the data, so it is among the last to go.
- When a write exceeds the quota, `safeSetItem` removes the other plugin keys in ascending priority order. It retries after each removal. If the write still fails, it removes the key itself and reports failure.
- Decode runs one time at the boundary. It drops entries of the wrong shape, then normalizes the result. A value that is not an array reads as no sessions. Corrupt JSON reads as no sessions.
- Normalize trims names and drops empty names. It drops a duplicate session id and keeps the first. It keeps each thread in one session and keeps the first. It drops sessions with no threads. Applying it twice gives the same result as applying it once.
- A write passes through normalize before it reaches storage. A failed write leaves the UI unchanged and shows no error.
- Writes dispatch the `bb-sidebar:thread-sessions-changed` event. Reason: the browser fires the `storage` event only in other windows.

## Preference hook

`usePersistedPreference(key, codec)` returns the value and a setter.

- Without `subscribe`, the hook keeps the value in React state and writes it to storage in an effect.
- In subscribe mode, the hook reads the raw stored string through `useSyncExternalStore`. It decodes the string. If decode fails or returns null, it uses the codec fallback.
- The decoded value keeps its identity until the stored string changes. Reason: a new array on each render would run every effect that depends on it again.
- The setter reads the current stored value and applies the update. It writes the result and calls `notify`. Reason: several components share the same state, so each write must reach all of them.
- A codec with `subscribe` supplies `notify`. `PortLinkSettings` and the sessions codec follow this pattern.

## Related decisions

None.
