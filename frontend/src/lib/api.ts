const API_URL = process.env.NEXT_PUBLIC_API_URL;

export interface User {
  id: number;
  name: string;
  email: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface Chat {
  id: string;
  user_id: number;
  title: string | null;
  status: string;
  created_at: string;
}

export interface Message {
  id: string;
  chat_id: string;
  sender: string;
  content: string;
  created_at: string;
  files?: FileAttachment[];
}

export interface FileAttachment {
  id: string;
  public_id: string;
  secure_url: string;
  resource_type: string;
  file_name: string;
  file_type: string;
  file_size: number;
  uploaded_by: number;
  created_at: string;
}

function getHeaders(accessToken?: string): HeadersInit {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }
  return headers;
}

export async function apiRequest(
  endpoint: string,
  options: RequestInit = {},
  accessToken?: string,
  refreshToken?: string,
  onRefresh?: (newTokens: AuthTokens) => void,
): Promise<Response> {
  const url = `${API_URL}${endpoint}`;
  const config: RequestInit = {
    ...options,
    headers: getHeaders(accessToken),
  };

  let response = await fetch(url, config);

  if (response.status === 401 && refreshToken) {
    const refreshed = await tryRefreshToken(refreshToken, onRefresh);
    if (refreshed) {
      const newAccessToken = refreshed.access_token;
      const retryConfig: RequestInit = {
        ...options,
        headers: getHeaders(newAccessToken),
      };
      response = await fetch(url, retryConfig);
    }
  }

  return response;
}

async function tryRefreshToken(
  refreshToken: string,
  onRefresh?: (newTokens: AuthTokens) => void,
): Promise<AuthTokens | null> {
  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (response.ok) {
      const tokens: AuthTokens = await response.json();
      if (onRefresh) {
        onRefresh(tokens);
      }
      return tokens;
    }
  } catch {
    // ignore
  }
  return null;
}

export async function registerUser(name: string, email: string, password: string) {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Registration failed" }));
    throw new Error(error.detail || "Registration failed");
  }

  return response.json();
}

export async function loginUser(email: string, password: string): Promise<AuthTokens> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Login failed" }));
    throw new Error(error.detail || "Login failed");
  }

  return response.json();
}

export async function logoutUser(refreshToken: string) {
  const response = await fetch(`${API_URL}/auth/logout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Logout failed" }));
    throw new Error(error.detail || "Logout failed");
  }

  return response.json();
}

export async function fetchChats(accessToken: string, refreshToken?: string) {
  const response = await apiRequest("/chats/", {}, accessToken, refreshToken);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to fetch chats" }));
    throw new Error(error.detail || "Failed to fetch chats");
  }
  return response.json();
}

export async function createChat(accessToken: string, refreshToken: string, title?: string): Promise<Chat> {
  const response = await apiRequest(
    "/chats/",
    {
      method: "POST",
      body: JSON.stringify({ title }),
    },
    accessToken,
    refreshToken,
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to create chat" }));
    throw new Error(error.detail || "Failed to create chat");
  }

  return response.json();
}

export async function fetchChat(
  accessToken: string,
  refreshToken: string,
  chatId: string,
): Promise<Chat> {
  const response = await apiRequest(`/chats/${chatId}`, {}, accessToken, refreshToken);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Chat not found" }));
    throw new Error(error.detail || "Chat not found");
  }
  return response.json();
}

export async function updateChat(
  accessToken: string,
  refreshToken: string,
  chatId: string,
  title?: string,
): Promise<Chat> {
  const response = await apiRequest(
    `/chats/${chatId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ title }),
    },
    accessToken,
    refreshToken,
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to update chat" }));
    throw new Error(error.detail || "Failed to update chat");
  }

  return response.json();
}

export async function deleteChat(
  accessToken: string,
  refreshToken: string,
  chatId: string,
) {
  const response = await apiRequest(`/chats/${chatId}`, { method: "DELETE" }, accessToken, refreshToken);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to delete chat" }));
    throw new Error(error.detail || "Failed to delete chat");
  }
  return response.json();
}

export async function uploadFile(
  accessToken: string,
  refreshToken: string,
  file: File,
): Promise<FileAttachment> {
  const formData = new FormData();
  formData.append("file", file);

  let response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/files/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  if (response.status === 401 && refreshToken) {
    const refreshRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (refreshRes.ok) {
      const tokens = await refreshRes.json();
      response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/files/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
        body: formData,
      });
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "File upload failed" }));
    throw new Error(error.detail || "File upload failed");
  }

  const data = await response.json();
  return {
    id: data.id,
    public_id: data.public_id,
    secure_url: data.secure_url,
    resource_type: data.resource_type,
    file_name: data.file_name,
    file_type: data.file_type,
    file_size: data.file_size,
    uploaded_by: data.uploaded_by,
    created_at: data.created_at,
  };
}

export async function attachFileToMessage(
  accessToken: string,
  refreshToken: string,
  chatId: string,
  messageId: string,
  fileId: string,
): Promise<void> {
  const response = await apiRequest(
    `/chats/${chatId}/messages/${messageId}/files`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_id: fileId }),
    },
    accessToken,
    refreshToken,
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to attach file to message" }));
    throw new Error(error.detail || "Failed to attach file to message");
  }
}
