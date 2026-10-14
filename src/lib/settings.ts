import { db } from "@/lib/db";

export async function getSettings() {
  return db.settings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });
}

/** Settings shape safe to send to the browser: secrets are reduced to a presence flag. */
export async function getSettingsForClient() {
  const s = await getSettings();
  return {
    hasDrataApiKey: Boolean(s.drataApiKey),
    scheduleEnabled: s.scheduleEnabled,
    scheduleHour: s.scheduleHour,
    scheduleMinute: s.scheduleMinute,
    scheduleTimezone: s.scheduleTimezone,
  };
}
