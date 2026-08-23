import { stringify as yamlStringify } from "yaml";
import { RedditError } from "./types.js";

export function toYaml(data: unknown): string {
  try {
    return yamlStringify(data, { indent: 2, lineWidth: 0 });
  } catch {
    return JSON.stringify(data, null, 2);
  }
}

export function handleError(err: unknown): never {
  if (err instanceof RedditError) throw new Error(`${err.code}: ${err.message}`);
  throw err;
}
