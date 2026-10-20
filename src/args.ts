/** Minimal, dependency-free flag parser for the coordinator CLI. */
export interface ParsedArgs {
  command: string;
  /** Last value per flag; repeated flags keep the latest (see {@link list}). */
  flags: Record<string, string | boolean>;
  /** Every value seen per flag, in order (for repeatable flags). */
  lists: Record<string, string[]>;
  positionals: string[];
}

/**
 * Parse `--flag value`, `--flag=value`, `--bool`, and positionals.
 * Unknown flags are kept; the caller decides what is required.
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const [command = "", ...rest] = argv;
  const flags: Record<string, string | boolean> = {};
  const lists: Record<string, string[]> = {};
  const positionals: string[] = [];

  const record = (key: string, value: string | boolean) => {
    flags[key] = value;
    if (typeof value === "string") (lists[key] ??= []).push(value);
  };

  for (let i = 0; i < rest.length; i++) {
    const token = rest[i]!;
    if (token.startsWith("--")) {
      const body = token.slice(2);
      const eq = body.indexOf("=");
      if (eq !== -1) {
        record(body.slice(0, eq), body.slice(eq + 1));
        continue;
      }
      const next = rest[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        record(body, next);
        i++;
      } else {
        record(body, true);
      }
      continue;
    }
    positionals.push(token);
  }

  return { command, flags, lists, positionals };
}

/** Read a flag as a trimmed string, or `undefined`. Booleans yield `""`. */
export function str(flags: Record<string, string | boolean>, key: string): string | undefined {
  const value = flags[key];
  if (typeof value !== "string") return value === true ? "" : undefined;
  return value.trim();
}

/** All values for a repeatable flag, trimmed and non-empty. */
export function list(lists: Record<string, string[]>, key: string): string[] {
  return (lists[key] ?? []).map((v) => v.trim()).filter(Boolean);
}
