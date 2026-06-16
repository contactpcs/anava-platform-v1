import { cn } from "@/lib/utils/cn";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-md bg-neutral-200", className)} />
  );
}

// ─── Patient list skeleton ────────────────────────────────────────────────────

export function PatientListSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
      </div>
      <Skeleton className="h-10 w-80" />
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-neutral-100 last:border-0">
            <Skeleton className="h-10 w-10 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Patient detail skeleton ──────────────────────────────────────────────────

export function PatientDetailSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f7f6f2] to-[#f4f0ef] dark:from-neutral-900 dark:to-neutral-900">
      {/* Sub-header */}
      <div className="bg-white border-b border-neutral-200">
        <div className="max-w-full px-8 py-4 flex items-center justify-between">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-40" />
        </div>
      </div>

      <div className="max-w-full px-8 py-8 space-y-6">
        {/* Patient info cards */}
        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2 bg-white rounded-lg shadow-md p-7">
            <div className="flex items-center gap-5">
              <Skeleton className="w-20 h-20 rounded-full shrink-0" />
              <div className="space-y-3 flex-1">
                <Skeleton className="h-7 w-48" />
                <div className="flex gap-3">
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-40" />
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-5 space-y-5">
            <div className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-5 w-32" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-5 w-20" />
            </div>
          </div>
        </div>

        {/* Assessments card */}
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-8 w-32" />
          </div>
          <div className="space-y-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-4 border-b border-neutral-100 last:border-0 gap-4">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-52" />
                </div>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-8 w-32" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Assessment (on-behalf) skeleton ─────────────────────────────────────────

export function AssessmentSkeleton() {
  return (
    <div className="flex h-[calc(100vh-4rem)] -mx-6 -mb-6">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-neutral-200 p-4">
        <Skeleton className="h-4 w-32 mb-4" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-lg" />
          ))}
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-6 w-44 rounded-full" />
              <Skeleton className="h-6 w-48" />
            </div>
            <Skeleton className="h-3 w-32 rounded-full" />
          </div>
          <Skeleton className="h-4 w-56 mt-2" />
        </div>

        {/* Question area */}
        <div className="flex-1 p-8">
          <div className="max-w-2xl mx-auto space-y-6">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-7 w-3/4" />
            <div className="mt-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-white border-t px-6 py-4 flex items-center justify-between">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-28" />
        </div>
      </div>
    </div>
  );
}

// ─── Patient dashboard skeleton ───────────────────────────────────────────────

export function PatientDashboardSkeleton() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Doctor card */}
      <div className="bg-white rounded-lg shadow-sm p-4 flex items-center gap-4">
        <Skeleton className="w-10 h-10 rounded-full shrink-0" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-4 w-36" />
        </div>
      </div>

      {/* Section heading */}
      <Skeleton className="h-4 w-40" />

      {/* Assessment cards */}
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm p-4 flex items-center justify-between gap-4">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-56" />
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-8 w-36 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
