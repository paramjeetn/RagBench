"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { DocumentResponse } from "@/lib/types";
import { useChatContext } from "@/context/chat-context";
import { MessageList } from "@/components/chat/message-list";
import { MessageInput } from "@/components/chat/message-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

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
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Chat</h1>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearMessages}>
            Clear
          </Button>
        )}
      </div>

      {/* Document filter */}
      {documents.length > 0 && (
        <div className="flex flex-wrap gap-1 py-2">
          {documents.map((doc) => (
            <Badge
              key={doc.id}
              variant={selectedDocIds.includes(doc.id) ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => toggleDoc(doc.id)}
            >
              {doc.filename}
              {selectedDocIds.includes(doc.id) && (
                <X className="ml-1 h-3 w-3" />
              )}
            </Badge>
          ))}
        </div>
      )}

      <MessageList messages={messages} />

      <div className="pt-4">
        <MessageInput
          onSend={(q) => sendMessage(q, selectedDocIds)}
          disabled={streaming}
        />
      </div>
    </div>
  );
}
