export default function CustomerDetailLoading(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-3xl animate-pulse space-y-8">
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 rounded-full bg-muted/60" />
        <div className="space-y-2">
          <div className="h-5 w-40 rounded bg-muted/60" />
          <div className="h-3.5 w-28 rounded bg-muted/40" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {["card-1", "card-2", "card-3"].map((key) => (
          <div key={key} className="h-16 rounded-xl bg-muted/40" />
        ))}
      </div>
      <div className="flex gap-2">
        {["tab-1", "tab-2", "tab-3"].map((key) => (
          <div key={key} className="h-8 w-24 rounded-lg bg-muted/40" />
        ))}
      </div>
      <div className="space-y-4">
        {["row-1", "row-2", "row-3", "row-4"].map((key) => (
          <div key={key} className="h-12 rounded bg-muted/30" />
        ))}
      </div>
    </div>
  );
}
