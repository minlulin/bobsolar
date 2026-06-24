export interface KnowledgeDocumentDefaults {
  brand?: string;
  model?: string;
  capacity?: string;
}

export interface ParsedKnowledgeChunk {
  content: string;
  brand: string | null;
  model: string | null;
  capacity: string | null;
  errorCode: string | null;
  dangerLevel: string | null;
  category: string;
}

const cleanCell = (value: string): string =>
  value
    .replace(/\*\*/g, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\\&/g, "&")
    .trim();

const cleanHeading = (value: string): string =>
  cleanCell(value)
    .replace(/^#+\s*/, "")
    .replace(/^\d+(?:\.\d+)*\.?\s*/, "")
    .replace(/\s+[—-]\s+.*$/, "")
    .trim();

const splitRow = (line: string): string[] => line.split("|").slice(1, -1).map(cleanCell);

const isSeparatorRow = (cells: string[]): boolean =>
  cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));

const findValue = (row: Record<string, string>, names: string[]): string | null => {
  for (const name of names) {
    const value = row[name];
    if (value && value !== "—" && value !== "-") return value;
  }
  return null;
};

export function parseKnowledgeMarkdown(
  content: string,
  defaults: KnowledgeDocumentDefaults = {},
): ParsedKnowledgeChunk[] {
  const chunks: ParsedKnowledgeChunk[] = [];
  const lines = content.split(/\r?\n/);
  let category = "General";

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]?.trim() ?? "";

    if (/^#{2,3}\s/.test(line)) {
      category = cleanHeading(line);
      continue;
    }

    if (!line.startsWith("|")) continue;

    const headers = splitRow(line).map((header) => header.toLowerCase());
    const separator = splitRow(lines[index + 1]?.trim() ?? "");
    if (!isSeparatorRow(separator) || headers.length === 0) continue;

    index += 2;
    while (index < lines.length) {
      const rowLine = lines[index]?.trim() ?? "";
      if (!rowLine.startsWith("|")) {
        index--;
        break;
      }

      const cells = splitRow(rowLine);
      const row: Record<string, string> = {};
      for (let cellIndex = 0; cellIndex < Math.min(headers.length, cells.length); cellIndex++) {
        const header = headers[cellIndex];
        if (header) row[header] = cells[cellIndex] ?? "";
      }

      const brand = findValue(row, ["brand & series", "brand"]) ?? defaults.brand?.trim() ?? null;
      const model = findValue(row, ["model"]) ?? defaults.model?.trim() ?? null;
      const capacity =
        findValue(row, ["rated power", "capacity", "power"]) ?? defaults.capacity?.trim() ?? null;
      const errorCode =
        findValue(row, ["code & description", "code", "fault code", "warning code"]) ?? null;
      const dangerLevel = findValue(row, ["danger level & source", "danger level"]);

      const contentParts = [
        brand && `Brand: ${brand}`,
        model && `Model: ${model}`,
        capacity && `Capacity: ${capacity}`,
        `Category: ${category}`,
        ...headers.map((header) => {
          const value = row[header];
          return value && value !== "—" ? `${header}: ${value}` : null;
        }),
      ].filter((part): part is string => Boolean(part));

      const chunkContent = contentParts.join("\n");
      if (chunkContent.length > 20) {
        chunks.push({
          content: chunkContent,
          brand,
          model,
          capacity,
          errorCode,
          dangerLevel,
          category,
        });
      }

      index++;
    }
  }

  return chunks;
}
