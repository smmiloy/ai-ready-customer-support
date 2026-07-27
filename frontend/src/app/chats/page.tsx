"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Chat } from "@/lib/api";

export default function ChatsPage() {
  const { accessToken, refreshToken, isAuthenticated, loading, updateTokens } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [error, setError] = useState("");
  const [loadingChats, setLoadingChats] = useState(false);
  const router = useRouter();

  async function loadChats() {
    setLoadingChats(true);
    setError("");

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chats/`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (response.status === 401 && refreshToken) {
        const refreshRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });

        if (refreshRes.ok) {
          const tokens = await refreshRes.json();
          updateTokens(tokens);
          const retryRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chats/`, {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
          });
          if (retryRes.ok) {
            setChats(await retryRes.json());
          } else {
            setError("Failed to load chats");
          }
        } else {
          setError("Session expired. Please login again.");
        }
      } else if (response.ok) {
        setChats(await response.json());
      } else {
        setError("Failed to load chats");
      }
    } catch {
      setError("Failed to load chats");
    } finally {
      setLoadingChats(false);
    }
  }

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated && accessToken) {
      const timeoutId = setTimeout(() => loadChats());
      return () => clearTimeout(timeoutId);
    }
  }, [isAuthenticated, accessToken, refreshToken]);

  if (loading || !isAuthenticated) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-zinc-600 dark:text-zinc-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 dark:bg-black py-8 px-4">
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">Your Chats</h1>
          <Link
            href="/chats/new"
            className="rounded bg-foreground px-4 py-2 text-sm text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            New Chat
          </Link>
        </div>

        {error && (
          <div className="mb-4 p-3 text-sm text-red-500 bg-red-50 dark:bg-red-950 rounded">
            {error}
          </div>
        )}

        {loadingChats ? (
          <p className="text-zinc-600 dark:text-zinc-400">Loading chats...</p>
        ) : chats.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-zinc-600 dark:text-zinc-400 mb-4">
              No chats yet. Start your first conversation!
            </p>
            <Link
              href="/chats/new"
              className="rounded bg-foreground px-4 py-2 text-sm text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
            >
              Create Chat
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {chats.map((chat) => (
              <Link
                key={chat.id}
                href={`/chats/${chat.id}`}
                className="block rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 transition-colors hover:border-zinc-300 dark:hover:border-zinc-700"
              >
                <h2 className="font-medium">
                  {chat.title || `Chat ${chat.id.slice(0, 8)}`}
                </h2>
                <p className="text-sm text-zinc-500 mt-1">
                  Created: {new Date(chat.created_at).toLocaleString()}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
