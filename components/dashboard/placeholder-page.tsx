export function PlaceholderPage({
  title,
  description,
  plannedFor,
}: {
  title: string;
  description: string;
  plannedFor: string;
}) {
  return (
    <div className="flex max-w-xl flex-col gap-3">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-sm text-foreground/70">{description}</p>
      <p className="text-xs text-foreground/50">{plannedFor}</p>
    </div>
  );
}
