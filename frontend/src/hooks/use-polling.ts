"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

export function usePolling<T>(
  url: string | null,
  intervalMs: number,
  shouldPoll: (data: T) => boolean = () => true
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!url) return;
    try {
      const result = await api.get<T>(url);
      setData(result);
      setError(null);
      return result;
    } catch (err) {
      setError((err as Error).message);
      return null;
    }
  }, [url]);

  // Initial fetch
  useEffect(() => {
    if (!url) {
      setData(null);
      return;
    }
    setLoading(true);
    fetchData().finally(() => setLoading(false));
  }, [url, fetchData]);

  // Polling
  useEffect(() => {
    if (!url || !data || !shouldPoll(data)) return;

    const interval = setInterval(async () => {
      const result = await fetchData();
      if (result && !shouldPoll(result)) {
        // Stop polling
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [url, data, intervalMs, shouldPoll, fetchData]);

  return { data, loading, error, refetch: fetchData };
}
