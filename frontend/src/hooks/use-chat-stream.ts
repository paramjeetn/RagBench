"use client";

import { useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import type { ChatMessage, StreamEvent, SourceInfo, QueryMetadata } from "@/lib/types";

export function useChatStream() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (question: string, documentIds?: string[]) => {
      // Add user message
      setMessages((prev) => [...prev, { role: "user", content: question }]);
      setStreaming(true);

      // Add empty assistant message to accumulate into
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await api.stream("/api/query/stream", {
          question,
          document_ids: documentIds?.length ? documentIds : null,
        });

        if (!res.body) throw new Error("No response body");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let sources: SourceInfo[] = [];
        let metadata: QueryMetadata | undefined;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop()!;

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;
            const payload = trimmed.slice(6);
            if (payload === "[DONE]") continue;

            const event: StreamEvent = JSON.parse(payload);

            if (event.type === "token") {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                updated[updated.length - 1] = {
                  ...last,
                  content: last.content + event.content,
                };
                return updated;
              });
            } else if (event.type === "sources") {
              sources = event.sources;
            } else if (event.type === "metadata") {
              metadata = event.metadata;
            }
          }
        }

        // Attach sources and metadata to the final assistant message
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          updated[updated.length - 1] = { ...last, sources, metadata };
          return updated;
        });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            updated[updated.length - 1] = {
              ...last,
              content: last.content || "Failed to get response. Is the backend running?",
            };
            return updated;
          });
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    []
  );

  const clearMessages = useCallback(() => setMessages([]), []);

  return { messages, streaming, sendMessage, clearMessages };
}
