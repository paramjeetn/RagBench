"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { DocumentResponse } from "@/lib/types";
import { useChatContext } from "@/context/chat-context";
import { MessageList } from "@/components/chat/message-list";
import { MessageInput } from "@/components/chat/message-input";
import { Button } from "@/components/ui/button";
import { Trash2, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ChatPage() {
  const { messages, streaming, sendMessage, clearMessages } = useChatContext();
  const [documents, setDocuments] = useState<DocumentResponse[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);

  useEffect(() => {
    api.get<DocumentResponse[]>("/api/documents/").then(setDocuments).catch(() => {});
  }, []);

  const toggleDoc = (id: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  return (
    <div className="relative flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Chat</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ask questions against your ingested documents.</p>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearMessages} className="gap-2 text-muted-foreground hover:text-foreground">
            <Trash2 className="h-4 w-4" />
            Clear
          </Button>
        )}
      </div>

      {/* Document filter */}
      {documents.length > 0 && (
        <div className="flex shrink-0 flex-wrap gap-2.5 border-b border-border/50 pb-4 mb-4">
          {documents.map((doc) => {
            const active = selectedDocIds.includes(doc.id);
            return (
              <button
                key={doc.id}
                onClick={() => toggleDoc(doc.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all duration-200",
                  active
                    ? "border-primary bg-primary/8 text-primary shadow-sm"
                    : "border-border/60 bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
                )}
              >
                <FileText className="h-3.5 w-3.5" />
                {doc.filename}
              </button>
            );
          })}
          {selectedDocIds.length > 0 && (
            <button
              onClick={() => setSelectedDocIds([])}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline px-1"
            >
              Clear filter
            </button>
          )}
        </div>
      )}

      {/* Messages — scrolls behind the floating input */}
      <div className="min-h-0 flex-1 overflow-y-auto pb-24 pr-1">
        <MessageList messages={messages} />
      </div>

      {/* Floating input pinned to bottom */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background/95 to-transparent pt-6 pb-1">
        <MessageInput
          onSend={(q) => sendMessage(q, selectedDocIds)}
          disabled={streaming}
        />
      </div>
    </div>
  );
}
