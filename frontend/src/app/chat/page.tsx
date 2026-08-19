"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { api } from "@/lib/api";
import type { DocumentResponse } from "@/lib/types";
import { useChatContext } from "@/context/chat-context";
import { MessageList } from "@/components/chat/message-list";
import { MessageInput } from "@/components/chat/message-input";
import { Trash2, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

const CHIP_COLORS = ["#E63946", "#F4C542", "#2563EB"];

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
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        className="flex shrink-0 items-center justify-between pb-5"
        style={{ borderBottom: "4px solid oklch(0.10 0.01 240)" }}
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-2" style={{ background: "#E63946" }} />
          <div>
            <h1 className="text-4xl font-black uppercase tracking-tight text-foreground">Chat</h1>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Query your ingested documents
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <motion.button
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.96 }}
            onClick={clearMessages}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-widest"
            style={{
              border: "2px solid oklch(0.10 0.01 240)",
              boxShadow: "3px 3px 0 oklch(0.10 0.01 240)",
              borderRadius: 0,
              color: "oklch(0.10 0.01 240)",
              background: "white",
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </motion.button>
        )}
      </motion.div>

      {/* Document filter chips */}
      {documents.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex shrink-0 flex-wrap gap-2 pb-4 pt-3"
          style={{ borderBottom: "2px solid oklch(0.88 0.01 240)" }}
        >
          {documents.map((doc, i) => {
            const active = selectedDocIds.includes(doc.id);
            const color = CHIP_COLORS[i % CHIP_COLORS.length];
            const isYellow = color === "#F4C542";
            return (
              <button
                key={doc.id}
                onClick={() => toggleDoc(doc.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase tracking-wider transition-all duration-150"
                style={{
                  background: active ? color : "white",
                  color: active ? (isYellow ? "oklch(0.10 0.01 240)" : "white") : "oklch(0.10 0.01 240)",
                  border: `2px solid ${color}`,
                  boxShadow: active ? `3px 3px 0 oklch(0.10 0.01 240)` : "none",
                  borderRadius: 0,
                }}
              >
                <FileText className="h-3 w-3" />
                {doc.filename.length > 16 ? doc.filename.slice(0, 16) + "…" : doc.filename}
              </button>
            );
          })}
          {selectedDocIds.length > 0 && (
            <button
              onClick={() => setSelectedDocIds([])}
              className="px-2 py-1.5 text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
            >
              ✕ Clear
            </button>
          )}
        </motion.div>
      )}

      {/* Messages */}
      <div className="min-h-0 flex-1 overflow-y-auto pb-24 pr-1">
        <MessageList messages={messages} />
      </div>

      {/* Floating input */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-background pt-4 pb-1"
        style={{ borderTop: "3px solid oklch(0.10 0.01 240)" }}
      >
        <MessageInput
          onSend={(q) => sendMessage(q, selectedDocIds)}
          disabled={streaming}
        />
      </div>
    </div>
  );
}
