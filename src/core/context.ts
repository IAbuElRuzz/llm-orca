import fs from "fs-extra";
import path from "node:path";
import { MAX_CONTEXT_BYTES } from "./constants.js";
import type { PackedContextItem } from "../types/provider.js";

const IGNORE_DIRS = new Set([".git", "node_modules", "dist", "build", ".next", ".turbo", ".idea"]);
const TEXT_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".txt", ".py", ".go", ".rs", ".java", ".kt", ".swift", ".c", ".cpp", ".h", ".hpp", ".yml", ".yaml", ".toml", ".ini", ".sql", ".sh", ".zsh", ".html", ".css", ".scss", ".xml"
]);

function isTextFile(filePath: string): boolean {
  return TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

async function walk(dir: string, maxFiles: number, out: string[]): Promise<void> {
  if (out.length >= maxFiles) return;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (out.length >= maxFiles) return;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name)) {
        await walk(full, maxFiles, out);
      }
    } else if (entry.isFile() && isTextFile(full)) {
      out.push(full);
    }
  }
}

export async function collectContextFiles(cwd: string, requested: string[] = [], maxFiles = 8): Promise<string[]> {
  const resolved: string[] = [];
  for (const value of requested) {
    const full = path.resolve(cwd, value);
    if (await fs.pathExists(full)) {
      const stat = await fs.stat(full);
      if (stat.isFile()) {
        resolved.push(full);
      } else if (stat.isDirectory()) {
        await walk(full, maxFiles, resolved);
      }
    }
  }
  return [...new Set(resolved)].slice(0, maxFiles);
}

export async function packContext(files: string[], cwd: string, byteLimit = MAX_CONTEXT_BYTES): Promise<{items: PackedContextItem[]; packed: string}> {
  const items: PackedContextItem[] = [];
  let total = 0;
  const parts: string[] = [];

  for (const file of files) {
    if (!(await fs.pathExists(file))) continue;
    const content = await fs.readFile(file, "utf8");
    const relative = path.relative(cwd, file) || file;
    const bytes = Buffer.byteLength(content, "utf8");
    const remaining = byteLimit - total;
    if (remaining <= 0) break;
    const snippet = bytes <= remaining ? content : content.slice(0, remaining);
    const actualBytes = Buffer.byteLength(snippet, "utf8");
    items.push({ path: relative, bytes: actualBytes, content: snippet });
    parts.push(`\n\n--- FILE: ${relative} ---\n${snippet}`);
    total += actualBytes;
  }

  return {
    items,
    packed: parts.join("").trim(),
  };
}

export function attachPackedContext(prompt: string, packed: string): string {
  if (!packed.trim()) return prompt;
  return `${prompt}\n\nContext files:\n${packed}`;
}
