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
