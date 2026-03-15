"use client";

import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
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
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <p className="text-sm">Ask a question about your documents.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 pr-4">
      <div className="space-y-4 py-4">
        {messages.map((msg, i) => (
          <div key={i}>
            <div
              className={cn(
                "max-w-[80%] rounded-lg px-4 py-3",
                msg.role === "user"
                  ? "ml-auto bg-primary text-primary-foreground"
                  : "bg-muted"
              )}
            >
              <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
            </div>

            {/* Sources */}
            {msg.sources && msg.sources.length > 0 && (
              <div className="mt-2 space-y-1">
                {msg.sources.map((src, j) => (
                  <SourceCard key={j} source={src} />
                ))}
              </div>
            )}

            {/* Metadata bar */}
            {msg.metadata && (
              <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span>{msg.metadata.latency_ms}ms</span>
                <span>{msg.metadata.tokens_used} tokens</span>
                <span>{msg.metadata.model}</span>
                <span>{msg.metadata.retrieval_mode}</span>
                <span>{msg.metadata.chunks_used} chunks</span>
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
