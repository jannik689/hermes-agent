export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-zinc-200 bg-white px-6 py-4">
        <div className="text-sm font-semibold text-zinc-900">{title}</div>
      </div>
      <div className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="text-sm text-zinc-500">Coming soon</div>
      </div>
    </div>
  )
}

