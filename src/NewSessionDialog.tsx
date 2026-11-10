import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { usePortalScopeProps } from "./lib/portal-scope";
import { useThreadSessions } from "./useThreadSessions";

/** Names a new session and moves the thread into it; an existing name joins that session. */
export function NewSessionDialog({
  threadId,
  open,
  onOpenChange,
}: {
  threadId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const portalScope = usePortalScopeProps();
  const { createSession } = useThreadSessions();
  const [name, setName] = useState("");
  useEffect(() => {
    if (open) setName("");
  }, [open]);
  const trimmed = name.trim();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay {...portalScope} className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          {...portalScope}
          // The dialog renders inside a row; keep its clicks off the row's menu.
          onContextMenu={(event) => event.stopPropagation()}
          className="fixed left-1/2 top-1/2 z-50 box-border w-72 max-w-[calc(100%_-_2rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-lg outline-none"
        >
          <Dialog.Title className="text-sm font-semibold leading-5">New session</Dialog.Title>
          <Dialog.Description className="sr-only">Name the session this thread moves into.</Dialog.Description>
          <form
            className="mt-3 flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!trimmed) return;
              createSession(trimmed, threadId);
              onOpenChange(false);
            }}
          >
            <input
              aria-label="Session name"
              maxLength={60}
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <div className="flex justify-end gap-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="h-8 rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={!trimmed}
                className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
