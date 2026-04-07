import chalk from "chalk";
import { collectContextFiles, packContext } from "../core/context.js";

export async function packFiles(cwd: string, requested: string[]): Promise<void> {
  const files = await collectContextFiles(cwd, requested);
  const packed = await packContext(files, cwd);
  console.log(chalk.bold("Packed files"));
  for (const item of packed.items) {
    console.log(`- ${item.path} (${item.bytes} bytes)`);
  }
  console.log("\n" + packed.packed);
}
