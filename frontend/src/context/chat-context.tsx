"use client";

import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { api } from "@/lib/api";
import type { ChatMessage, StreamEvent, SourceInfo, QueryMetadata } from "@/lib/types";

const STORAGE_KEY = "rag-eval-chat-messages";

function saveMessages(messages: ChatMessage[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // quota exceeded — ignore
  }
}

interface ChatContextValue {
  messages: ChatMessage[];
  streaming: boolean;
  sendMessage: (question: string, documentIds?: string[]) => Promise<void>;
  clearMessages: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [messages, _setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const ready = useRef(false);

  // Wrapper that also persists to sessionStorage
  const setMessages: typeof _setMessages = useCallback((action) => {
    _setMessages((prev) => {
      const next = typeof action === "function" ? action(prev) : action;
      saveMessages(next);
      return next;
    });
  }, []);

  // Hydrate from sessionStorage after mount
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as ChatMessage[];
        if (stored.length > 0) _setMessages(stored);
      }
    } catch {
      // ignore
    }
    ready.current = true;
  }, []);

  const sendMessage = useCallback(
    async (question: string, documentIds?: string[]) => {
      setMessages((prev) => [...prev, { role: "user", content: question }]);
      setStreaming(true);

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await api.stream("/api/query/stream", {
          question,
          document_ids: documentIds?.length ? documentIds : null,
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          const isApiKey =
            text.toLowerCase().includes("api_key") ||
            text.toLowerCase().includes("api key") ||
            text.toLowerCase().includes("not configured") ||
            text.toLowerCase().includes("authentication") ||
            text.toLowerCase().includes("401");
          throw new Error(
            isApiKey
              ? `API key error: ${text}\n\nPlease check your API key in Settings.`
              : `Request failed (${res.status}): ${text}`
          );
        }

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
            } else if (event.type === "error") {
              const msg: string = event.message ?? "Unknown error";
              const isApiKey =
                msg.toLowerCase().includes("api_key") ||
                msg.toLowerCase().includes("api key") ||
                msg.toLowerCase().includes("not configured") ||
                msg.toLowerCase().includes("authentication") ||
                msg.toLowerCase().includes("unauthorized") ||
                msg.toLowerCase().includes("401");
              const display = isApiKey
                ? `API key error: ${msg}\n\nPlease check your API key in Settings.`
                : `Error: ${msg}`;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  content: display,
                  error: true,
                };
                return updated;
              });
            }
          }
        }

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
    [setMessages]
  );

  const clearMessages = useCallback(() => setMessages([]), [setMessages]);

  return (
    <ChatContext.Provider value={{ messages, streaming, sendMessage, clearMessages }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be used within ChatProvider");
  return ctx;
}
