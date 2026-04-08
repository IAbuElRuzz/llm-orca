import fs from "fs-extra";
import path from "node:path";
import { HISTORY_DIR, TRANSCRIPTS_DIR } from "./constants.js";

export interface HistoryEntry {
  id: string;
  timestamp: string;
  provider: string;
  mode: "open" | "run" | "compare" | "chat";
  cwd: string;
  prompt?: string;
  promptPreview?: string;
  exitCode?: number;
  model?: string;
  approvalPolicy?: string;
  profileName?: string;
  sandboxMode?: string;
  transcriptPath?: string;
  contextFiles?: string[];
  results?: Array<{
    provider: string;
    exitCode: number;
    model?: string;
    stdoutPreview?: string;
    stderrPreview?: string;
    score?: number;
    transcriptPath?: string;
  }>;
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function previewText(value: string | undefined, max = 240): string | undefined {
  if (!value) return undefined;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= max ? normalized : `${normalized.slice(0, max)}...`;
}

export async function writeTranscript(id: string, payload: unknown): Promise<string> {
  await fs.ensureDir(TRANSCRIPTS_DIR);
  const filePath = path.join(TRANSCRIPTS_DIR, `${id}.json`);
  await fs.writeJson(filePath, payload, { spaces: 2 });
  return filePath;
}

export async function appendHistory(entry: Omit<HistoryEntry, "id" | "timestamp">): Promise<string> {
  await fs.ensureDir(HISTORY_DIR);
  const id = makeId();
  const record: HistoryEntry = {
    id,
    timestamp: new Date().toISOString(),
    ...entry,
  };

  const filePath = path.join(HISTORY_DIR, `${record.timestamp.slice(0, 10)}.jsonl`);
  await fs.appendFile(filePath, `${JSON.stringify(record)}\n`, "utf8");
  return id;
}

export async function readRecentHistory(limit = 20): Promise<HistoryEntry[]> {
  await fs.ensureDir(HISTORY_DIR);
  const files = (await fs.readdir(HISTORY_DIR))
    .filter((name) => name.endsWith(".jsonl"))
    .sort()
    .reverse();

  const entries: HistoryEntry[] = [];

  for (const file of files) {
    const content = await fs.readFile(path.join(HISTORY_DIR, file), "utf8");
    const lines = content.split(/\r?\n/).filter(Boolean).reverse();
    for (const line of lines) {
      try {
        entries.push(JSON.parse(line) as HistoryEntry);
      } catch {
        // ignore malformed lines
      }
      if (entries.length >= limit) {
        return entries;
      }
    }
  }

  return entries;
}
