"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { SettingsSheet } from "./settings-sheet";
import { ChatProvider } from "@/context/chat-context";
import { EvalProvider } from "@/context/eval-context";
import { ProjectProvider } from "@/context/project-context";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <ProjectProvider>
    <ChatProvider>
      <EvalProvider>
        <div className="flex h-screen overflow-hidden bg-background">
          <Sidebar onOpenSettings={() => setSettingsOpen(true)} />
          <main className="flex-1 overflow-y-auto bg-background p-8">{children}</main>
          <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
        </div>
      </EvalProvider>
    </ChatProvider>
    </ProjectProvider>
  );
}
