"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { SettingsSheet } from "./settings-sheet";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar onOpenSettings={() => setSettingsOpen(true)} />
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
