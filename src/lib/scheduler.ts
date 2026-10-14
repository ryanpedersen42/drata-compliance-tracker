import cron, { type ScheduledTask } from "node-cron";
import { getSettings } from "@/lib/settings";
import { runSync } from "@/lib/sync";

const globalForScheduler = globalThis as unknown as { complianceTask: ScheduledTask | undefined };

/** (Re)builds the daily check's cron job from whatever is currently in Settings. Safe to call repeatedly. */
export async function rescheduleFromSettings() {
  globalForScheduler.complianceTask?.stop();
  globalForScheduler.complianceTask = undefined;

  const settings = await getSettings();
  if (!settings.scheduleEnabled) return;

  const expression = `${settings.scheduleMinute} ${settings.scheduleHour} * * *`;
  if (!cron.validate(expression)) {
    console.error(`[scheduler] invalid cron expression "${expression}", not scheduling`);
    return;
  }

  globalForScheduler.complianceTask = cron.schedule(
    expression,
    async () => {
      try {
        await runSync("SCHEDULED");
      } catch (err) {
        console.error("[scheduler] scheduled check failed:", err);
      }
    },
    { timezone: settings.scheduleTimezone, noOverlap: true },
  );

  console.log(
    `[scheduler] daily check scheduled for ${String(settings.scheduleHour).padStart(2, "0")}:${String(settings.scheduleMinute).padStart(2, "0")} (${settings.scheduleTimezone})`,
  );
}
