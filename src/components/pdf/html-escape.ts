const HTML_ESCAPE_PATTERN = /[&<>"']/g;
const LINE_BREAK_PATTERN = /\r\n|\r|\n/g;

export function escapeHtml(value: string): string {
  return value.replace(HTML_ESCAPE_PATTERN, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
}

export function escapeHtmlLines(value: string): string {
  return escapeHtml(value).replace(LINE_BREAK_PATTERN, "<br/>");
}

export function escapeHtmlAttribute(value: string): string {
  return escapeHtml(value);
}

export function escapeHtmlWithBulletLineBreaks(value: string): string {
  return escapeHtml(value).replace(LINE_BREAK_PATTERN, " &bull; ");
}

export function toSafeImageSrc(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return escapeHtmlAttribute(trimmed);
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol === "https:" || url.protocol === "http:") {
      return escapeHtmlAttribute(url.toString());
    }
  } catch {
    return null;
  }

  return null;
}
