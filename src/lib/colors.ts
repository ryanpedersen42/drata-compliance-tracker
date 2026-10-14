// A small, curated set of distinct, readable colors for tags - simpler than
// a full color picker, and different enough from each other to stay legible
// as chips.
export const TAG_PALETTE = [
  "#6366f1", // indigo
  "#059669", // emerald
  "#d97706", // amber
  "#e11d48", // rose
  "#0284c7", // sky
  "#7c3aed", // violet
  "#ea580c", // orange
  "#0d9488", // teal
  "#be185d", // pink
  "#65a30d", // lime
] as const;

export function nextTagColor(existingCount: number): string {
  return TAG_PALETTE[existingCount % TAG_PALETTE.length];
}
