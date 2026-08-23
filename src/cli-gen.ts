import type { Command } from "commander";

type Kind = "string" | "number" | "boolean" | "array" | "record";
interface FieldLike {
  constructor: { name: string };
  unwrap?: () => FieldLike;
  _def?: { innerType?: FieldLike };
  description?: string;
}
export interface ToolLike {
  name: string;
  description: string;
  schema: { shape?: Record<string, FieldLike>; parse: (value: unknown) => unknown };
  handler: (args: any) => Promise<{
    content: Array<{ type: "text"; text: string }>;
    isError?: boolean;
  }>;
}
interface FieldInfo {
  key: string;
  flag: string;
  optional: boolean;
  kind: Kind;
  description: string;
}

const kebab = (value: string): string => value.replace(/_/g, "-");
const camel = (value: string): string =>
  value.replace(/[-_]([a-z])/g, (_, char: string) => char.toUpperCase());

function unwrap(field: FieldLike): { inner: FieldLike; optional: boolean } {
  let optional = false;
  let current = field;
  while (
    current &&
    (current.constructor?.name === "ZodOptional" || current.constructor?.name === "ZodDefault")
  ) {
    optional = true;
    current = typeof current.unwrap === "function"
      ? current.unwrap()
      : (current._def?.innerType as FieldLike);
  }
  return { inner: current, optional };
}

function kindOf(field: FieldLike): Kind {
  switch (field?.constructor?.name) {
    case "ZodNumber": return "number";
    case "ZodBoolean": return "boolean";
    case "ZodArray":
    case "ZodPipe": return "array";
    case "ZodRecord": return "record";
    default: return "string";
  }
}

function coerce(kind: Kind, value: unknown): unknown {
  if (typeof value !== "string") return value;
  if (kind === "number") return Number(value);
  if (kind === "array") return value.split(",").map((part) => part.trim()).filter(Boolean);
  if (kind === "record") return JSON.parse(value);
  return value;
}

function reflect(tool: ToolLike): FieldInfo[] {
  return Object.entries(tool.schema.shape ?? {}).map(([key, field]) => {
    const { inner, optional } = unwrap(field);
    return {
      key,
      flag: kebab(key),
      optional,
      kind: kindOf(inner),
      description: field.description ?? inner.description ?? "",
    };
  });
}

export function buildCli(program: Command, tools: ToolLike[]): Command {
  for (const tool of tools) {
    const fields = reflect(tool);
    const positional = fields.find(
      (field) => !field.optional && !["array", "record", "boolean"].includes(field.kind),
    );
    const command = program
      .command(kebab(tool.name) + (positional ? ` <${positional.flag}>` : ""))
      .description(tool.description);
    for (const field of fields) {
      if (field === positional) continue;
      const suffix = field.kind === "array"
        ? " (comma-separated)"
        : field.kind === "record" ? " (JSON object)" : "";
      const help = field.description + suffix;
      if (field.kind === "boolean") command.option(`--${field.flag}`, help);
      else if (field.optional) command.option(`--${field.flag} <value>`, help);
      else command.requiredOption(`--${field.flag} <value>`, help);
    }
    command.action(async (...commandArgs: unknown[]) => {
      const commander = commandArgs.at(-1) as { opts: () => Record<string, unknown> };
      const options = commander.opts();
      const args: Record<string, unknown> = {};
      if (positional) args[positional.key] = coerce(positional.kind, commandArgs[0]);
      for (const field of fields) {
        if (field === positional) continue;
        const value = options[camel(field.flag)];
        if (value !== undefined) args[field.key] = coerce(field.kind, value);
      }
      const result = await tool.handler(tool.schema.parse(args));
      for (const block of result.content) {
        process.stdout.write(block.text + (block.text.endsWith("\n") ? "" : "\n"));
      }
      if (result.isError) process.exitCode = 1;
    });
  }
  return program;
}
