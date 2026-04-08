import fs from "fs-extra";
import path from "node:path";
import { SESSIONS_DIR } from "./constants.js";
import type { ApprovalPolicy, ProviderName, SandboxMode } from "../types/provider.js";

export interface ChatSessionMessage {
  role: "user" | "assistant" | "system";
  provider?: string;
  content: string;
  timestamp: string;
}

export interface ChatSession {
  id: string;
  name: string;
  cwd: string;
  createdAt: string;
  updatedAt: string;
  activeProvider: ProviderName;
  activeModel?: string;
  approvalPolicy: ApprovalPolicy;
  sandboxMode: SandboxMode;
  compareProviders?: ProviderName[];
  messages: ChatSessionMessage[];
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "session";
}

function makeSessionId(name: string): string {
  return `${Date.now()}-${slugify(name)}`;
}

export async function saveSession(input: Omit<ChatSession, "id" | "createdAt" | "updatedAt"> & { id?: string; createdAt?: string }): Promise<ChatSession> {
  await fs.ensureDir(SESSIONS_DIR);
  const now = new Date().toISOString();
  const id = input.id ?? makeSessionId(input.name);
  const session: ChatSession = {
    ...input,
    id,
    createdAt: input.createdAt ?? now,
    updatedAt: now,
  };

  const filePath = path.join(SESSIONS_DIR, `${id}.json`);
  await fs.writeJson(filePath, session, { spaces: 2 });
  return session;
}

export async function loadSession(idOrName: string): Promise<ChatSession | null> {
  await fs.ensureDir(SESSIONS_DIR);
  const directPath = path.join(SESSIONS_DIR, `${idOrName}.json`);
  if (await fs.pathExists(directPath)) {
    return fs.readJson(directPath) as Promise<ChatSession>;
  }

  const sessions = await listSessions();
  const found = sessions.find((session) => session.name === idOrName);
  if (!found) {
    return null;
  }
  return fs.readJson(path.join(SESSIONS_DIR, `${found.id}.json`)) as Promise<ChatSession>;
}

export async function listSessions(): Promise<Array<Pick<ChatSession, "id" | "name" | "updatedAt" | "activeProvider" | "activeModel">>> {
  await fs.ensureDir(SESSIONS_DIR);
  const entries = await fs.readdir(SESSIONS_DIR);
  const sessions: Array<Pick<ChatSession, "id" | "name" | "updatedAt" | "activeProvider" | "activeModel">> = [];

  for (const entry of entries.filter((name) => name.endsWith(".json"))) {
    try {
      const session = await fs.readJson(path.join(SESSIONS_DIR, entry)) as ChatSession;
      sessions.push({
        id: session.id,
        name: session.name,
        updatedAt: session.updatedAt,
        activeProvider: session.activeProvider,
        activeModel: session.activeModel,
      });
    } catch {
      // ignore malformed session files
    }
  }

  return sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
