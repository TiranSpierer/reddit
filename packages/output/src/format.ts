import { stringify as yamlStringify } from "yaml";

export function toYaml(data: unknown): string {
  try {
    return yamlStringify(data, { indent: 2, lineWidth: 0 }).trimEnd() + "\n";
  } catch {
    return JSON.stringify(data, null, 2);
  }
}
