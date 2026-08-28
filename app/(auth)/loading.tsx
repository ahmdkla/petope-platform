import { Loading, Bar } from "@/components/skeleton";

/** The auth pages render their own centred shell, not `AppShell`. */
export default function LoadingAuth() {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Loading label="Loading">
          <div className="space-y-5 rounded-lg border border-line bg-card p-6 shadow-card">
            <Bar className="mx-auto h-5 w-32" />
            {Array.from({ length: 2 }, (_, i) => (
              <div key={i} className="space-y-1.5">
                <Bar className="h-4 w-24" />
                <Bar className="h-field w-full" />
              </div>
            ))}
            <Bar className="h-field w-full" />
          </div>
        </Loading>
      </div>
    </div>
  );
}
