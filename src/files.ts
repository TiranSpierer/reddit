import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export function subredditDirectory(name: string): string {
  return join(tmpdir(), "reddit-cli", "subreddits", name);
}

export function threadDirectory(id: string): string {
  return join(tmpdir(), "reddit-cli", "posts", id);
}

export async function atomicWrite(path: string, data: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = join(dirname(path), `.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, data, "utf8");
    await rename(temporary, path);
  } finally {
    await unlink(temporary).catch(() => undefined);
  }
}
