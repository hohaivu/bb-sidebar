import { useSidebarThreads } from "./bb-sdk";
import { BROWSER_EVENTS } from "./lib/browser-events";
import { STORAGE_KEYS } from "./lib/storage-keys";

import { sharedPreferenceEvents, usePersistedPreference } from "./lib/use-persisted-preference";
import type { PreferenceCodec } from "./lib/use-persisted-preference";
import { SettingRow, SettingsSelect } from "./settings-ui";

const PORT_LINK_HOST_KEY = STORAGE_KEYS.portLinkHost.key;
const hostCodec: PreferenceCodec<string | null> = {
  decode: (stored) => stored || null,
  fallback: () => null,
  encode: (host) => host ?? "",
  ...sharedPreferenceEvents(BROWSER_EVENTS.portLinkHostChanged),
};
export function usePortLinkHost() {
  return usePersistedPreference(PORT_LINK_HOST_KEY, hostCodec)[0];
}
export function PortLinkSettings({ onSaved }: { onSaved?: () => void }) {
  const [hostId, setHostId] = usePersistedPreference(PORT_LINK_HOST_KEY, hostCodec);
  const { threads } = useSidebarThreads();
  const hosts = new Map(
    threads.flatMap((thread) => (thread.host ? [[thread.host.id, thread.host.name] as const] : [])),
  );
  return (
    <SettingRow
      title="Open port links on"
      description="The machine this browser can reach. Ports on other machines stay as text. Saved only on this device."
      control={
        <SettingsSelect
          aria-label="Open port links on"
          value={hostId ?? ""}
          onChange={(event) => {
            setHostId(event.target.value);
            onSaved?.();
          }}
          className="w-48"
        >
          <option value="">No machine</option>
          {hostId && !hosts.has(hostId) ? <option value={hostId}>Previously selected machine</option> : null}
          {[...hosts].map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </SettingsSelect>
      }
    />
  );
}
