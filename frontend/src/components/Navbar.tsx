"use client";

import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";

export function Navbar() {
  const { isAuthenticated, user, logout } = useAuth();

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
      <div className="mx-auto max-w-3xl px-4 h-12 flex items-center justify-between">
        <Link href="/chats" className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 hover:underline">
          AI Customer Support
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            {user.name}
          </span>
          <button
            onClick={logout}
            className="text-xs rounded border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
