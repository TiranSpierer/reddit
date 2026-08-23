#!/usr/bin/env node
import { Command } from "commander";
import { buildCli } from "./cli-gen.js";
import { tools } from "./tools/index.js";

const program = new Command()
  .name("reddit-cli")
  .description("CLI for searching and reading Reddit")
  .version("1.0.0")
  .showHelpAfterError("(run with --help for usage)");

buildCli(program, tools);
program.parseAsync(process.argv).catch((error) => {
  process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
