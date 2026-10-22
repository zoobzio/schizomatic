import { parseArgs } from "node:util";

import { build } from "./build";

const HELP = `Usage: schizomatic build [options]

Builds the schema schizomatic.config.ts points at: reads every JSON Schema
document under the source directory, proves each one with zod, and writes
the artifact and the declarations to the output directory.

Options:
  -c, --config <file>  Config file (default: schizomatic.config.ts)
  -r, --root <dir>     Project root (default: current directory)
  -h, --help           Show this help`;

const main = async (argv: string[]): Promise<void> => {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      config: { type: "string", short: "c" },
      root: { type: "string", short: "r" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help) {
    console.log(HELP);
    return;
  }
  if (positionals.length !== 1 || positionals[0] !== "build") {
    console.error(HELP);
    process.exitCode = 1;
    return;
  }

  const output = await build({ config: values.config, root: values.root });
  console.log(
    `@schizomatic/kit: wrote ${output.files.length} files to ${output.outDir}`,
  );
};

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
