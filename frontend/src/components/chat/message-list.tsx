"use client";

import { useEffect, useRef } from "react";
import { MessageSquare, Sparkles } from "lucide-react";
import { SourceCard } from "./source-card";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

interface MessageListProps {
  messages: ChatMessage[];
  streaming?: boolean;
}

export function MessageList({ messages }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/60 shadow-sm">
          <MessageSquare className="h-7 w-7 opacity-35" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">Ask anything</p>
          <p className="text-xs text-muted-foreground">Your answers will appear here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-4">
      {messages.map((msg, i) => (
        <div key={i} className={cn("flex flex-col", msg.role === "user" ? "items-end" : "items-start")}>
          {/* Bubble */}
          <div
            className={cn(
              "max-w-[78%] rounded-lg px-4 py-3 text-sm leading-relaxed",
              msg.role === "user"
                ? "rounded-br-none bg-primary text-white [&_p]:text-white shadow-md"
                : msg.error
                ? "rounded-bl-none border border-destructive/40 bg-destructive/8 text-destructive [&_p]:text-destructive shadow-sm"
                : "rounded-bl-none border border-border/50 bg-card shadow-sm"
            )}
          >
            {msg.role === "assistant" && msg.content === "" ? (
              <div className="flex items-center gap-2.5 py-0.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
                </div>
                <div className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            ) : (
              <p className="whitespace-pre-wrap">{msg.content}</p>
            )}
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
            <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground/60 font-medium">
              <span>{msg.metadata.latency_ms}ms</span>
              <span className="opacity-40">·</span>
              <span>{msg.metadata.tokens_used} tokens</span>
              <span className="opacity-40">·</span>
              <span>{msg.metadata.model}</span>
              <span className="opacity-40">·</span>
              <span>{msg.metadata.retrieval_mode}</span>
              <span className="opacity-40">·</span>
              <span>{msg.metadata.chunks_used}/{msg.metadata.total_chunks} chunks</span>
            </div>
          )}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
