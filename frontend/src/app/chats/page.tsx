"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Chat, updateChat, deleteChat } from "@/lib/api";

export default function ChatsPage() {
  const { accessToken, refreshToken, isAuthenticated, loading, updateTokens } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [error, setError] = useState("");
  const [loadingChats, setLoadingChats] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [renameLoading, setRenameLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
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
            const data = await retryRes.json();
            setChats(data.chats || []);
          } else {
            setError("Failed to load chats");
          }
        } else {
          setError("Session expired. Please login again.");
        }
      } else if (response.ok) {
        const data = await response.json();
        setChats(data.chats || []);
      } else {
        setError("Failed to load chats");
      }
    } catch {
      setError("Failed to load chats");
    } finally {
      setLoadingChats(false);
    }
  }

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleRenameSave(chatId: string) {
    const title = renameTitle.trim() || undefined;
    setRenameLoading(true);
    setError("");
    try {
      await updateChat(accessToken!, refreshToken!, chatId, title);
      await loadChats();
      showToast("Chat renamed successfully", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename chat");
      showToast(err instanceof Error ? err.message : "Failed to rename chat", "error");
    } finally {
      setRenameLoading(false);
      setRenamingId(null);
      setRenameTitle("");
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleteLoading(true);
    setError("");
    try {
      await deleteChat(accessToken!, refreshToken!, deleteId);
      await loadChats();
      showToast("Chat deleted successfully", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete chat");
      showToast(err instanceof Error ? err.message : "Failed to delete chat", "error");
    } finally {
      setDeleteLoading(false);
      setDeleteId(null);
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
            <div className="text-6xl mb-4">💬</div>
            <p className="text-zinc-600 dark:text-zinc-400 mb-4 text-lg">
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
              <div
                key={chat.id}
                className="group relative rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 transition-all hover:shadow-md dark:hover:shadow-zinc-800/50 hover:border-zinc-300 dark:hover:border-zinc-700"
              >
                {renamingId === chat.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={renameTitle}
                      onChange={(e) => setRenameTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRenameSave(chat.id);
                        if (e.key === "Escape") {
                          setRenamingId(null);
                          setRenameTitle("");
                        }
                      }}
                      autoFocus
                      className="flex-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1 text-sm"
                      placeholder="Chat title"
                      maxLength={200}
                    />
                    <button
                      onClick={() => handleRenameSave(chat.id)}
                      disabled={renameLoading}
                      className="rounded bg-foreground px-3 py-1 text-xs text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] disabled:opacity-50"
                    >
                      {renameLoading ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={() => {
                        setRenamingId(null);
                        setRenameTitle("");
                      }}
                      className="rounded border border-zinc-300 dark:border-zinc-700 px-3 py-1 text-xs transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/chats/${chat.id}`}
                        className="block font-medium truncate hover:underline"
                      >
                        {chat.title || `Chat ${chat.id.slice(0, 8)}`}
                      </Link>
                      <p className="text-sm text-zinc-500 mt-1">
                        Created: {new Date(chat.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          setRenamingId(chat.id);
                          setRenameTitle(chat.title || "");
                        }}
                        className="flex items-center justify-center w-8 h-8 rounded text-zinc-600 hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        title="Rename"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => setDeleteId(chat.id)}
                        className="flex items-center justify-center w-8 h-8 rounded text-zinc-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {deleteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 cursor-pointer"
          onClick={() => !deleteLoading && setDeleteId(null)}
        >
          <div
            className="bg-white dark:bg-zinc-900 rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-2">Delete Chat</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
              Are you sure you want to delete this chat? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteId(null)}
                disabled={deleteLoading}
                className="rounded border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="rounded bg-red-600 px-4 py-2 text-sm text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {deleteLoading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 rounded px-4 py-3 text-sm shadow-lg transition-all duration-300 ${
            toast.type === "success"
              ? "bg-green-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
