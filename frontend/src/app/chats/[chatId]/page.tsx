"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { Chat, Message, FileAttachment, updateChat, deleteChat } from "@/lib/api";
import { uploadFile, attachFileToMessage } from "@/lib/api";

export default function ChatDetailPage() {
  const params = useParams();
  const chatId = params.chatId as string;
  const router = useRouter();
  const { accessToken, refreshToken, isAuthenticated, logout, updateTokens } = useAuth();
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<FileAttachment[]>([]);
  const [previewFile, setPreviewFile] = useState<FileAttachment | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameTitle, setRenameTitle] = useState("");
  const [renameLoading, setRenameLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function loadChat() {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chats/${chatId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        setChat(await res.json());
      } else if (res.status === 404) {
        router.push("/chats");
      } else if (res.status === 401 && refreshToken) {
        const refreshRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (refreshRes.ok) {
          const tokens = await refreshRes.json();
          updateTokens(tokens);
          const retryRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chats/${chatId}`, {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
          });
          if (retryRes.ok) {
            setChat(await retryRes.json());
          } else {
            setError("Failed to load chat");
          }
        } else {
          await logout();
          router.push("/login");
        }
      }
    } catch {
      setError("Failed to load chat");
    } finally {
      setLoading(false);
    }
  }

  async function loadMessages() {
    if (!accessToken) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chats/${chatId}/messages`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      } else if (res.status === 401 && refreshToken) {
        const refreshRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (refreshRes.ok) {
          const tokens = await refreshRes.json();
          updateTokens(tokens);
          const retryRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chats/${chatId}/messages`, {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
          });
          if (retryRes.ok) {
            const data = await retryRes.json();
            setMessages(data.messages || []);
          }
        } else {
          await logout();
          router.push("/login");
        }
      }
    } catch {
      // silent
    }
  }

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated && accessToken) {
      const timeoutId = setTimeout(() => {
        loadChat();
        loadMessages();
      });
      const interval = setInterval(loadMessages, 3000);
      return () => {
        clearTimeout(timeoutId);
        clearInterval(interval);
      };
    }
  }, [isAuthenticated, accessToken, refreshToken, chatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError("");

    try {
      const uploaded = await uploadFile(accessToken!, refreshToken!, file);
      setAttachedFiles((prev) => [...prev, uploaded]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "File upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function removeAttachedFile(fileId: string) {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== fileId));
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if ((!newMessage.trim() && attachedFiles.length === 0) || sending) return;

    setSending(true);
    setError("");

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chats/${chatId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ content: newMessage.trim() || "File attachment" }),
      });

      if (res.ok) {
        const createdMessage = await res.json();
        const newMessageId = createdMessage.id;

        for (const file of attachedFiles) {
          await attachFileToMessage(accessToken!, refreshToken!, chatId, newMessageId, file.id);
        }

        setNewMessage("");
        setAttachedFiles([]);
        await loadMessages();
      } else if (res.status === 401 && refreshToken) {
        const refreshRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });

        if (refreshRes.ok) {
          const tokens = await refreshRes.json();
          updateTokens(tokens);
          const retryRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chats/${chatId}/messages`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${tokens.access_token}`,
            },
            body: JSON.stringify({ content: newMessage.trim() || "File attachment" }),
          });
          if (retryRes.ok) {
            const createdMessage = await retryRes.json();
            const newMessageId = createdMessage.id;

            for (const file of attachedFiles) {
              await attachFileToMessage(tokens.access_token, refreshToken!, chatId, newMessageId, file.id);
            }

            setNewMessage("");
            setAttachedFiles([]);
            await loadMessages();
          }
        } else {
          await logout();
          router.push("/login");
        }
      } else {
        setError("Failed to send message");
      }
    } catch {
      setError("Failed to send message");
    } finally {
      setSending(false);
    }
  }

  async function handleRenameSave() {
    if (!chat) return;
    const title = renameTitle.trim() || undefined;
    setRenameLoading(true);
    setError("");
    try {
      await updateChat(accessToken!, refreshToken!, chat.id, title);
      await loadChat();
      showToast("Chat renamed successfully", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename chat");
      showToast(err instanceof Error ? err.message : "Failed to rename chat", "error");
    } finally {
      setRenameLoading(false);
      setRenaming(false);
      setRenameTitle("");
    }
  }

  async function handleDelete() {
    if (!chat) return;
    setDeleteLoading(true);
    setError("");
    try {
      await deleteChat(accessToken!, refreshToken!, chat.id);
      showToast("Chat deleted successfully", "success");
      router.push("/chats");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete chat");
      showToast(err instanceof Error ? err.message : "Failed to delete chat", "error");
    } finally {
      setDeleteLoading(false);
      setDeleteOpen(false);
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (loading) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-zinc-600 dark:text-zinc-400">Loading...</p>
      </div>
    );
  }

  if (!chat) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-zinc-600 dark:text-zinc-400">Chat not found</p>
        <Link href="/chats" className="mt-4 underline text-sm">
          Back to chats
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 dark:bg-black">
      <div className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <Link href="/chats" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
            ← Back
          </Link>
          {renaming ? (
            <div className="flex items-center gap-2 flex-1">
              <input
                type="text"
                value={renameTitle}
                onChange={(e) => setRenameTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRenameSave();
                  if (e.key === "Escape") {
                    setRenaming(false);
                    setRenameTitle("");
                  }
                }}
                autoFocus
                className="flex-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1 text-sm"
                placeholder="Chat title"
                maxLength={200}
              />
              <button
                onClick={handleRenameSave}
                disabled={renameLoading}
                className="rounded bg-foreground px-3 py-1 text-xs text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] disabled:opacity-50"
              >
                {renameLoading ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => {
                  setRenaming(false);
                  setRenameTitle("");
                }}
                className="rounded border border-zinc-300 dark:border-zinc-700 px-3 py-1 text-xs transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              <h1 className="font-medium truncate flex-1">
                {chat.title || `Chat ${chat.id.slice(0, 8)}`}
              </h1>
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center justify-center w-8 h-8 rounded text-zinc-600 hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  title="Chat options"
                >
                  ⚙️
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg z-40 overflow-hidden">
                    <button
                      onClick={() => {
                        setRenaming(true);
                        setRenameTitle(chat.title || "");
                        setMenuOpen(false);
                      }}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm text-left hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                    >
                      ✏️ Rename
                    </button>
                    <button
                      onClick={() => {
                        setDeleteOpen(true);
                        setMenuOpen(false);
                      }}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto py-4 px-4">
          {error && (
            <div className="mb-4 p-3 text-sm text-red-500 bg-red-50 dark:bg-red-950 rounded">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.sender === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
                    message.sender === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  }`}
                >
                  <p className="text-xs opacity-70 mb-1 capitalize">{message.sender}</p>
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  {message.files && message.files.length > 0 && (
                    <div className="mt-2 flex flex-col gap-1">
                      {message.files.map((file) => (
                        <button
                          key={file.id}
                          type="button"
                          onClick={() => setPreviewFile(file)}
                          className={`flex items-center gap-2 text-xs rounded px-2 py-1 text-left transition-colors ${
                            message.sender === "user"
                              ? "hover:bg-blue-700"
                              : "hover:bg-zinc-300 dark:hover:bg-zinc-700"
                          }`}
                        >
                          📎 {file.file_name} ({formatFileSize(file.file_size)})
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {attachedFiles.length > 0 && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-2">
          <div className="max-w-3xl mx-auto flex flex-wrap gap-2">
            {attachedFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-2 rounded bg-zinc-100 dark:bg-zinc-800 px-3 py-1 text-xs"
              >
                📎 <span className="truncate max-w-[150px]">{file.file_name}</span>
                <button
                  type="button"
                  onClick={() => removeAttachedFile(file.id)}
                  className="text-zinc-500 hover:text-red-500"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3">
        <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className="flex items-center justify-center w-10 h-10 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
            title="Upload file"
          >
            📎
          </label>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
            disabled={sending || uploading}
          />
          <button
            type="submit"
            disabled={sending || uploading || (!newMessage.trim() && attachedFiles.length === 0)}
            className="rounded bg-foreground px-4 py-2 text-sm text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] disabled:opacity-50"
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </form>
      </div>

      {previewFile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 cursor-pointer"
          onClick={() => setPreviewFile(null)}
        >
          <div className="max-w-[90vw] max-h-[90vh] bg-white dark:bg-zinc-900 rounded-lg p-4">
            {previewFile.file_type.startsWith("image/") ? (
              <img
                src={previewFile.secure_url}
                alt={previewFile.file_name}
                className="max-w-[85vw] max-h-[85vh] object-contain rounded"
              />
            ) : (
              <div className="text-center">
                <p className="text-lg mb-2">📄</p>
                <p className="font-medium text-sm mb-1">{previewFile.file_name}</p>
                <p className="text-xs text-zinc-500 mb-3">{formatFileSize(previewFile.file_size)}</p>
                <a
                  href={previewFile.secure_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block rounded bg-foreground px-4 py-2 text-sm text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
                >
                  Download File
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {deleteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 cursor-pointer"
          onClick={() => !deleteLoading && setDeleteOpen(false)}
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
                onClick={() => setDeleteOpen(false)}
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
