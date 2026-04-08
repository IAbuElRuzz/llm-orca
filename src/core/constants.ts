import os from "node:os";
import path from "node:path";

export const APP_DIR = path.join(os.homedir(), ".llm-router");
export const CONFIG_PATH = path.join(APP_DIR, "config.json");
export const HISTORY_DIR = path.join(APP_DIR, "history");
export const TRANSCRIPTS_DIR = path.join(APP_DIR, "transcripts");
export const SESSIONS_DIR = path.join(APP_DIR, "sessions");
export const TEMPLATES_PATH = path.join(APP_DIR, "templates.json");

export const PROJECT_CONFIG_NAME = ".llm-router.json";

export const DEFAULT_PROVIDER = "claude";
export const DEFAULT_APPROVAL_POLICY = "ask";
export const DEFAULT_SANDBOX_MODE = "workspace";
export const MAX_CONTEXT_BYTES = 100_000;
