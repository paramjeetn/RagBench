"use client";

import { useEffect, useRef } from "react";
import { MessageSquare } from "lucide-react";
import { SourceCard } from "./source-card";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

interface MessageListProps {
  messages: ChatMessage[];
}

export function MessageList({ messages }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
          <MessageSquare className="h-6 w-6 opacity-40" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium">Ask anything</p>
          <p className="text-xs text-muted-foreground/70">Your answers will appear here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 py-4">
      {messages.map((msg, i) => (
        <div key={i} className={cn("flex flex-col", msg.role === "user" ? "items-end" : "items-start")}>
          {/* Bubble */}
          <div
            className={cn(
              "max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
              msg.role === "user"
                ? "rounded-br-sm bg-primary text-primary-foreground shadow-sm"
                : "rounded-bl-sm border bg-card shadow-sm"
            )}
          >
            <p className="whitespace-pre-wrap">{msg.content}</p>
          </div>

          {/* Sources */}
          {msg.role === "assistant" && msg.sources && msg.sources.length > 0 && (
            <div className="mt-2 w-full max-w-[78%] space-y-1">
              {msg.sources.map((src, j) => (
                <SourceCard key={j} source={src} />
              ))}
            </div>
          )}

          {/* Metadata */}
          {msg.role === "assistant" && msg.metadata && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground/60">
              <span>{msg.metadata.latency_ms}ms</span>
              <span>·</span>
              <span>{msg.metadata.tokens_used} tokens</span>
              <span>·</span>
              <span>{msg.metadata.model}</span>
              <span>·</span>
              <span>{msg.metadata.retrieval_mode}</span>
              <span>·</span>
              <span>{msg.metadata.chunks_used}/{msg.metadata.total_chunks} chunks</span>
            </div>
          )}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
