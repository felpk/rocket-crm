"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Target,
  Zap,
  MessageSquare,
  BarChart3,
  Settings,
  Users,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  userRole: string;
  userName: string;
}

const clientLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/funnel", label: "Funil de Vendas", icon: Target },
  { href: "/automations", label: "Automações", icon: Zap },
  { href: "/whatsapp", label: "WhatsApp", icon: MessageSquare },
  { href: "/google-ads", label: "Google Ads", icon: BarChart3 },
  { href: "/settings", label: "Configurações", icon: Settings },
];

const adminLinks = [
  { href: "/admin", label: "Painel Admin", icon: Users },
];

export default function Sidebar({ userRole, userName }: SidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links =
    userRole === "admin" ? [...clientLinks, ...adminLinks] : clientLinks;

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setOpen(true)}
        className="fixed top-4 left-4 z-50 md:hidden bg-card p-2 rounded-lg"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-64 bg-card flex flex-col transition-transform duration-200",
          "md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-5 border-b border-white/10">
          <Image
            src="/logo_rocketmidia.jpg"
            alt="Rocket Marketing"
            width={44}
            height={44}
            className="rounded-full"
          />
          <div>
            <h1 className="font-bold text-base">Rocket</h1>
            <p className="text-xs text-white/60">Marketing CRM</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="ml-auto md:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors",
                  active
                    ? "bg-accent text-white"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                )}
              >
                <link.icon className="w-5 h-5" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-accent/30 rounded-full flex items-center justify-center text-sm font-bold">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{userName}</p>
              <p className="text-xs text-white/50">
                {userRole === "admin" ? "Administrador" : "Cliente"}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-white/60 hover:text-error transition-colors w-full"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
          <p className="text-[10px] text-white/20 mt-3 text-center select-none">
            v{process.env.NEXT_PUBLIC_VERSION}
          </p>
        </div>
      </aside>
    </>
  );
}
