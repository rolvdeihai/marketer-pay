// mobile/src/lib/dialogs.ts
import { Alert, Platform } from "react-native";

// Alert.alert with buttons doesn't work on web, so use the browser's dialogs there.
export function confirmAsync(title: string, message: string): Promise<boolean> {
  if (Platform.OS === "web") return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: "OK", style: "destructive", onPress: () => resolve(true) },
    ]),
  );
}

export function notify(title: string, message: string) {
  if (Platform.OS === "web") window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}
/**
 * Confirm, then run a remove mutation. The server deletes the record if it has
 * no history, or archives it (hidden, history kept) if it does.
 * Returns true if something was removed.
 */
export async function confirmRemove(
  what: string,
  run: () => Promise<{ data?: unknown }>,
): Promise<boolean> {
  const ok = await confirmAsync(
    `Remove ${what}?`,
    "If it has sales or payouts it will be archived (hidden, history kept). Otherwise it is deleted.",
  );
  if (!ok) return false;
  try {
    const res = await run();
    const result = Object.values((res.data ?? {}) as Record<string, unknown>)[0];
    if (result === "ARCHIVED") notify("Archived", `${what} has sales history, so it was archived instead of deleted.`);
    return true;
  } catch (e) {
    notify("Can't remove", (e as Error).message);
    return false;
  }
}
