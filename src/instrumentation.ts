export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { rescheduleFromSettings } = await import("@/lib/scheduler");
  await rescheduleFromSettings();
}
