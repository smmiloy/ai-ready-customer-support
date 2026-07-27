"use client";

import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";

export function AuthButtons() {
  const { isAuthenticated, user, logout } = useAuth();

  if (isAuthenticated && user) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Logged in as <span className="font-medium">{user.name}</span>
        </p>
        <div className="flex gap-2">
          <Link
            href="/chats"
            className="flex h-10 items-center justify-center rounded-full bg-foreground px-5 text-sm text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Go to Chats
          </Link>
          <button
            onClick={logout}
            className="flex h-10 items-center justify-center rounded-full border border-solid border-black/[.08] px-5 text-sm transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Link
        href="/login"
        className="flex h-10 w-full items-center justify-center rounded-full bg-foreground px-5 text-sm text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] md:w-[158px]"
      >
        Login
      </Link>
      <Link
        href="/register"
        className="flex h-10 w-full items-center justify-center rounded-full border border-solid border-black/[.08] px-5 text-sm transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a] md:w-[158px]"
      >
        Register
      </Link>
    </div>
  );
}
