import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function Loader({ className }: { className?: string }) {
  return <Loader2 className={cn("h-6 w-6 animate-spin text-primary-500", className)} />;
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader className="h-10 w-10" />
    </div>
  );
}
