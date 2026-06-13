"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function MedicalQueueAutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    let es: EventSource | null = null;
    let fallbackTimer: ReturnType<typeof setInterval> | null = null;

    function connectSSE() {
      es = new EventSource("/api/queue/stream");

      es.addEventListener("refresh", () => {
        router.refresh();
      });

      es.onerror = () => {
        // SSE connection dropped — close and fall back to polling
        es?.close();
        es = null;
        startFallbackPolling();
      };
    }

    function startFallbackPolling() {
      if (fallbackTimer) return;
      // Retry SSE every 30 s; refresh page every 15 s meanwhile
      fallbackTimer = setInterval(() => {
        router.refresh();
      }, 15_000);

      setTimeout(() => {
        if (fallbackTimer) {
          clearInterval(fallbackTimer);
          fallbackTimer = null;
        }
        connectSSE();
      }, 30_000);
    }

    connectSSE();

    return () => {
      es?.close();
      if (fallbackTimer) clearInterval(fallbackTimer);
    };
  }, [router]);

  return null;
}
