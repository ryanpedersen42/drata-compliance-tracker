import clsx from "clsx";
import type { Status } from "@/lib/types";

export function StatusBadge({ status }: { status: Status }) {
  if (status === null) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-500">
        No data
      </span>
    );
  }

  return (
    <span
      className={clsx(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        status === "PASS" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800",
      )}
    >
      {status === "PASS" ? "Passing" : "Failing"}
    </span>
  );
}
