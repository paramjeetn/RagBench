"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  LayoutDashboard,
  FileText,
  MessageSquare,
  FlaskConical,
  GitCompareArrows,
  Settings,
  FolderKanban,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/",          label: "Dashboard", icon: LayoutDashboard, color: "#E63946" },
  { href: "/projects",  label: "Projects",  icon: FolderKanban,    color: "#F4C542" },
  { href: "/documents", label: "Documents", icon: FileText,         color: "#2563EB" },
  { href: "/chat",      label: "Chat",      icon: MessageSquare,   color: "#E63946" },
  { href: "/evaluate",  label: "Evaluate",  icon: FlaskConical,    color: "#F4C542" },
  { href: "/compare",   label: "Compare",   icon: GitCompareArrows,color: "#2563EB" },
];

interface SidebarProps {
  onOpenSettings: () => void;
}

export function Sidebar({ onOpenSettings }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className="relative flex h-screen w-60 flex-col bg-bauhaus-black"
      style={{ borderRight: "4px solid var(--bauhaus-yellow)" }}
    >
      {/* Geometric decoration — yellow rectangle top */}
      <div className="absolute top-0 right-0 h-1 w-full bg-bauhaus-yellow" />
      {/* Red vertical stripe on far left */}
      <div className="absolute top-0 left-0 h-full w-1 bg-bauhaus-red" />

      {/* Logo */}
      <div
        className="flex h-[72px] shrink-0 items-center gap-3 px-5"
        style={{ borderBottom: "3px solid var(--bauhaus-yellow)" }}
      >
        {/* Bauhaus geometric logo — circle in square */}
        <motion.div
          className="relative flex h-10 w-10 shrink-0 items-center justify-center"
          style={{
            background: "var(--bauhaus-red)",
            border: "3px solid var(--bauhaus-yellow)",
            borderRadius: 0,
          }}
          whileHover={{ rotate: 12, scale: 1.08 }}
          transition={{ type: "spring", stiffness: 400, damping: 15 }}
        >
          <div
            className="absolute h-5 w-5 rounded-full"
            style={{ background: "var(--bauhaus-yellow)", opacity: 0.9 }}
          />
          <FlaskConical className="relative h-4 w-4 text-white z-10" />
        </motion.div>

        <div>
          <p
            className="text-xs font-black uppercase tracking-[0.2em] leading-none"
            style={{ color: "var(--bauhaus-yellow)" }}
          >
            Rag
          </p>
          <p
            className="text-lg font-black uppercase tracking-tight leading-none"
            style={{ color: "var(--bauhaus-white)" }}
          >
            BENCH
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-5 space-y-1">
        {navItems.map((item, index) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <motion.div
              key={item.href}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.06, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <Link
                href={item.href}
                className="group relative flex items-center gap-3 px-3 py-2.5 text-sm font-bold uppercase tracking-widest transition-all duration-150"
                style={{
                  color: active ? "var(--bauhaus-black)" : "oklch(0.75 0.01 240)",
                  background: active ? item.color : "transparent",
                  borderLeft: active ? `4px solid var(--bauhaus-yellow)` : "4px solid transparent",
                }}
              >
                {/* Hover bg */}
                {!active && (
                  <span
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                    style={{ background: `${item.color}22`, borderLeft: `4px solid ${item.color}` }}
                  />
                )}

                <item.icon
                  className="relative h-4 w-4 shrink-0"
                  style={{ color: active ? "var(--bauhaus-black)" : item.color }}
                />
                <span className="relative">{item.label}</span>

                {/* Active geometric indicator */}
                <AnimatePresence>
                  {active && (
                    <motion.span
                      className="ml-auto relative h-2 w-2"
                      style={{ background: "var(--bauhaus-black)" }}
                      initial={{ scale: 0, rotate: 45 }}
                      animate={{ scale: 1, rotate: 45 }}
                      exit={{ scale: 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 25 }}
                    />
                  )}
                </AnimatePresence>
              </Link>
            </motion.div>
          );
        })}
      </nav>

      {/* Bottom section - yellow block */}
      <div
        className="p-3"
        style={{ borderTop: "3px solid var(--bauhaus-yellow)" }}
      >
        <motion.button
          onClick={onOpenSettings}
          className="flex w-full items-center gap-3 px-3 py-2.5 text-xs font-bold uppercase tracking-widest transition-all duration-150"
          style={{ color: "oklch(0.75 0.01 240)" }}
          whileHover={{ x: 4, color: "var(--bauhaus-yellow)" }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
          <Settings className="h-4 w-4 shrink-0" />
          Pipeline Settings
        </motion.button>

        {/* Bauhaus footer decoration */}
        <div className="mt-3 flex gap-1.5 px-3">
          <div className="h-3 w-3 rounded-full bg-bauhaus-red" />
          <div className="h-3 w-3 bg-bauhaus-yellow" />
          <div className="h-3 w-3 rounded-full bg-bauhaus-blue" />
        </div>
      </div>
    </aside>
  );
}