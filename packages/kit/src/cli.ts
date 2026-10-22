import { parseArgs } from "node:util";

const HELP = `Usage: schizomatic build [options]

Builds the schema schizomatic.config.ts points at: reads the JSON Schema
documents and writes the contract, the validators, and the declarations to
the output directory.

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

  console.error("@schizomatic/kit: build is not implemented yet");
  process.exitCode = 1;
};

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
