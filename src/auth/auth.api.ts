// src/auth/auth.api.ts
import type { User } from "../types";

export type RegisterDto = {
  name: string;
  email: string;
  password: string;
};

export type LoginDto = {
  email: string;
  password: string;
};

type AuthResponse = {
  user: User;
  accessToken: string;
};

const TOKEN_KEY = "nutrilens_access_token";
const USER_KEY = "nutrilens_user";

function isAuthResponse(value: unknown): value is AuthResponse {
  if (!value || typeof value !== "object") return false;

  const v = value as Record<string, unknown>;
  const user = v.user as Record<string, unknown> | undefined;

  return (
    typeof v.accessToken === "string" &&
    !!user &&
    typeof user.id === "string" &&
    typeof user.name === "string" &&
    typeof user.email === "string"
  );
}

async function parseJsonOrThrow(res: Response): Promise<unknown> {
  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");

  if (!isJson) {
    const text = await res.text();
    // se não for JSON, ainda pode ter uma mensagem útil
    throw new Error(text || `Erro HTTP ${res.status}`);
  }

  return res.json();
}

function extractErrorMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;

  const obj = data as Record<string, unknown>;
  const msg = obj.message;

  // Nest às vezes retorna message como string ou array
  if (typeof msg === "string") return msg;
  if (Array.isArray(msg)) return msg.map(String).join(" | ");

  if (typeof obj.error === "string") return obj.error;

  return fallback;
}

export function setAuthSession(accessToken: string, user: User) {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuthSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getAuthUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

/**
 * Cadastro
 */
export async function registerUser(args: {
  apiBaseUrl: string;
  dto: RegisterDto;
}): Promise<{ user: User; accessToken: string }> {
  const res = await fetch(`${args.apiBaseUrl}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args.dto),
  });

  const data = await parseJsonOrThrow(res);

  if (!res.ok) {
    throw new Error(extractErrorMessage(data, `Erro HTTP ${res.status}`));
  }

  if (!isAuthResponse(data)) {
    throw new Error("Resposta inesperada do servidor no cadastro.");
  }

  return { user: data.user, accessToken: data.accessToken };
}

/**
 * Login
 */
export async function loginUser(args: {
  apiBaseUrl: string;
  dto: LoginDto;
}): Promise<{ user: User; accessToken: string }> {
  const res = await fetch(`${args.apiBaseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args.dto),
  });

  const data = await parseJsonOrThrow(res);

  if (!res.ok) {
    throw new Error(extractErrorMessage(data, `Erro HTTP ${res.status}`));
  }

  if (!isAuthResponse(data)) {
    throw new Error("Resposta inesperada do servidor no login.");
  }

  return { user: data.user, accessToken: data.accessToken };
}

/**
 * Fetch com Authorization automaticamente.
 * - Se der 401, limpa a sessão (token inválido/expirado).
 */
export async function fetchAuth(
  input: RequestInfo | URL,
  init: RequestInit = {}
) {
  const token = getAuthToken();

  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const resp = await fetch(input, { ...init, headers });

  if (resp.status === 401) {
    clearAuthSession();
  }

  return resp;
}

// Alias (se você já estava usando `authFetch` em algum lugar)
export const authFetch = fetchAuth;
