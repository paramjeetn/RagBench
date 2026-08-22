"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { SettingsSheet } from "./settings-sheet";
import { ChatProvider } from "@/context/chat-context";
import { EvalProvider } from "@/context/eval-context";
import { ProjectProvider } from "@/context/project-context";

const BARE_ROUTES = ["/home"];

function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="h-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const pathname = usePathname();

  // Landing page and other bare routes render without sidebar chrome
  if (BARE_ROUTES.some((r) => pathname.startsWith(r))) {
    return <>{children}</>;
  }

  return (
    <ProjectProvider>
    <ChatProvider>
      <EvalProvider>
        <div className="flex h-screen overflow-hidden bg-background">
          {/* Bauhaus geometric background */}
          <div className="pointer-events-none fixed inset-0 bauhaus-grid-bg opacity-100" />

          {/* Bold decorative geometric shapes — Bauhaus corner accents */}
          <div className="pointer-events-none fixed inset-0 overflow-hidden">
            {/* Top-right large circle */}
            <div className="absolute -top-32 -right-32 h-72 w-72 rounded-full border-[20px] border-bauhaus-yellow opacity-15" />
            {/* Bottom-left triangle (CSS) */}
            <div
              className="absolute -bottom-16 -left-16 h-48 w-48 opacity-10"
              style={{
                background: "var(--bauhaus-blue)",
                clipPath: "polygon(0 100%, 50% 0, 100% 100%)",
              }}
            />
            {/* Mid-right rectangle accent */}
            <div className="absolute top-1/2 -right-6 h-32 w-3 -translate-y-1/2 bg-bauhaus-red opacity-40" />
          </div>

          <Sidebar onOpenSettings={() => setSettingsOpen(true)} />
          <main className="relative flex-1 overflow-y-auto p-8">
            <PageTransition>{children}</PageTransition>
          </main>
          <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
        </div>
      </EvalProvider>
    </ChatProvider>
    </ProjectProvider>
  );
}