"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/evaluate", label: "Evaluate", icon: FlaskConical },
  { href: "/compare", label: "Compare", icon: GitCompareArrows },
];

interface SidebarProps {
  onOpenSettings: () => void;
}

export function Sidebar({ onOpenSettings }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-border/50 bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-border/50 px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary shadow-sm">
          <FlaskConical className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="text-sm font-semibold tracking-tight text-foreground">RagBench</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 p-3 pt-4">
        {navItems.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-150",
                active
                  ? "bg-primary/8 text-primary shadow-sm"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <item.icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              {item.label}
              {active && (
                <span className="ml-auto h-2 w-2 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Settings */}
      <div className="border-t border-border/50 p-3">
        <button
          onClick={onOpenSettings}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all duration-150 hover:bg-muted/60 hover:text-foreground"
        >
          <Settings className="h-4 w-4 shrink-0" />
          Pipeline Settings
        </button>
      </div>
    </aside>
  );
}
