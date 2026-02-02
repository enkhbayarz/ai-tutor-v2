import { Skeleton } from "@/components/ui/skeleton";

export function ChatSkeleton() {
  return (
    <div className="flex flex-1 flex-col p-6 space-y-6 overflow-hidden">
      {/* User message skeleton */}
      <div className="flex justify-end">
        <Skeleton className="h-12 w-48 rounded-2xl bg-gray-200" />
      </div>

      {/* Assistant message skeleton */}
      <div className="flex justify-start gap-3">
        <Skeleton className="h-8 w-8 rounded-full shrink-0 bg-gray-200" />
        <div className="space-y-2 flex-1 max-w-[600px]">
          <Skeleton className="h-4 w-full bg-gray-200" />
          <Skeleton className="h-4 w-[90%] bg-gray-200" />
          <Skeleton className="h-4 w-[95%] bg-gray-200" />
          <Skeleton className="h-4 w-[70%] bg-gray-200" />
          <Skeleton className="h-4 w-[85%] bg-gray-200" />
          <Skeleton className="h-4 w-[60%] bg-gray-200" />
        </div>
      </div>

      {/* Optional second exchange */}
      <div className="flex justify-end">
        <Skeleton className="h-10 w-36 rounded-2xl bg-gray-200" />
      </div>

      <div className="flex justify-start gap-3">
        <Skeleton className="h-8 w-8 rounded-full shrink-0 bg-gray-200" />
        <div className="space-y-2 flex-1 max-w-[600px]">
          <Skeleton className="h-4 w-[85%] bg-gray-200" />
          <Skeleton className="h-4 w-[75%] bg-gray-200" />
          <Skeleton className="h-4 w-[50%] bg-gray-200" />
        </div>
      </div>
    </div>
  );
}
