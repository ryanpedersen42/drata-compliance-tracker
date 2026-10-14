export function TagChip({
  name,
  color,
  onRemove,
}: {
  name: string;
  color: string;
  onRemove?: () => void;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: `${color}22`, color }}
    >
      {name}
      {onRemove && (
        <button
          onClick={onRemove}
          aria-label={`Remove ${name} tag`}
          className="hover:opacity-70 leading-none"
        >
          &times;
        </button>
      )}
    </span>
  );
}
