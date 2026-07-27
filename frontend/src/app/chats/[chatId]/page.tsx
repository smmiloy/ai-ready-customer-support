"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { Chat, Message, FileAttachment } from "@/lib/api";
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function getFileIcon(fileType: string): React.ReactElement {
    if (fileType.startsWith("image/")) {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      );
    }
    if (fileType === "application/pdf") {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="12" y1="18" x2="12" y2="12" />
          <line x1="9" y1="15" x2="15" y2="15" />
        </svg>
      );
    }
    if (fileType.startsWith("text/")) {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      );
    }
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
        <polyline points="13 2 13 9 20 9" />
      </svg>
    );
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
          <h1 className="font-medium truncate">
            {chat.title || `Chat ${chat.id.slice(0, 8)}`}
          </h1>
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
                          <span className="flex-shrink-0">{getFileIcon(file.file_type)}</span>
                          <span className="truncate">{file.file_name}</span>
                          <span className="opacity-60">({formatFileSize(file.file_size)})</span>
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
                <span className="flex-shrink-0">{getFileIcon(file.file_type)}</span>
                <span className="truncate max-w-[150px]">{file.file_name}</span>
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
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
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
          <div className="max-w-[90vw] max-h-[90vh] rounded-lg overflow-hidden">
            {previewFile.file_type.startsWith("image/") ? (
              <img
                src={previewFile.secure_url}
                alt={previewFile.file_name}
                className="max-w-[90vw] max-h-[90vh] object-contain"
              />
            ) : (
              <div className="bg-white dark:bg-zinc-900 rounded-lg p-6 max-w-md">
                <div className="flex items-center gap-3 mb-4">
                  <span className="flex-shrink-0">{getFileIcon(previewFile.file_type)}</span>
                  <div>
                    <p className="font-medium text-sm">{previewFile.file_name}</p>
                    <p className="text-xs text-zinc-500">{formatFileSize(previewFile.file_size)}</p>
                  </div>
                </div>
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
    </div>
  );
}