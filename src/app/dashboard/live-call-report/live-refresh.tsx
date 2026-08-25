"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

export default function LiveRefresh() {
  const router = useRouter();
  const [seconds, setSeconds] = useState(30);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSeconds((current) => {
        if (current <= 1) {
          router.refresh();
          return 30;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [router]);

  return (
    <button
      type="button"
      onClick={() => {
        router.refresh();
        setSeconds(30);
      }}
      className="inline-flex min-h-10 items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
      title="Refresh report now"
    >
      <RefreshCw className="h-4 w-4" />
      Live · {seconds}s
    </button>
  );
}
