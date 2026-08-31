import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { tools } from "./tools.js";

const sourceDirectory = dirname(fileURLToPath(import.meta.url));

export function createServer(): McpServer {
  const server = new McpServer({ name: "reddit-mcp", version: "2.0.0" });
  server.resource("api-behavior", "reddit://api-behavior", { mimeType: "text/markdown" }, () => ({
    contents: [{
      uri: "reddit://api-behavior",
      mimeType: "text/markdown",
      text: readFileSync(join(sourceDirectory, "../../../docs/api-behavior.md"), "utf8"),
    }],
  }));
  for (const tool of tools) {
    server.registerTool(tool.name, {
      title: tool.name,
      description: tool.description,
      inputSchema: tool.schema as any,
    }, async (args: unknown) => {
      try {
        return await tool.handler(args);
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    });
  }
  return server;
}
