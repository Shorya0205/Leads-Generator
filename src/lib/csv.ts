/**
 * Simple CSV parser for recipient imports.
 * Handles both CSV format (email,name,company) and plain email lists.
 */

export interface ParsedRecipient {
  email: string;
  name?: string;
  company?: string;
}

/**
 * Parse CSV text into an array of recipients.
 * Accepts:
 *   - CSV with headers: email,name,company
 *   - Plain list: one email per line
 *   - Mixed: "name,email,company" per line (no header)
 */
export function parseCSV(text: string): ParsedRecipient[] {
  if (!text || !text.trim()) return [];

  const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

  // Check if text has multiple emails in a single line or space-separated paste
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  // Expanded lines buffer: if a line contains multiple email addresses, expand them
  const expandedLines: string[] = [];
  for (const line of lines) {
    const matches = Array.from(line.matchAll(EMAIL_REGEX));
    if (matches.length > 1) {
      // Line contains multiple email addresses on one line (e.g. pasted into single input field)
      let lastIndex = 0;
      for (let i = 0; i < matches.length; i++) {
        const m = matches[i];
        const matchEnd = m.index! + m[0].length;
        // Text segment for this recipient includes leading name and email
        const segment = line.substring(lastIndex, matchEnd).trim();
        if (segment) expandedLines.push(segment);
        lastIndex = matchEnd;
      }
    } else {
      expandedLines.push(line);
    }
  }

  // Check if first line is a header row
  const firstLine = expandedLines[0].toLowerCase();
  const hasHeader =
    firstLine.includes("email") ||
    firstLine.includes("name") ||
    firstLine.includes("company");

  const dataLines = hasHeader ? expandedLines.slice(1) : expandedLines;

  let emailIdx = -1;
  let nameIdx = -1;
  let companyIdx = -1;

  if (hasHeader) {
    const headers = firstLine.split(",").map((h) => h.trim().toLowerCase());
    emailIdx = headers.indexOf("email");
    nameIdx = headers.indexOf("name");
    companyIdx = headers.indexOf("company");
  }

  const recipients: ParsedRecipient[] = [];
  const seen = new Set<string>();

  for (const line of dataLines) {
    // 1. Check for "Name <email@domain.com>" format
    const angleMatch = line.match(/^([^<]+)<([^>]+)>$/);
    if (angleMatch) {
      const name = angleMatch[1].trim().replace(/^[,;\s]+|[,;\s]+$/g, "");
      const email = angleMatch[2].trim().toLowerCase();
      if (isValidEmail(email) && !seen.has(email)) {
        seen.add(email);
        recipients.push({ email, name: name || undefined });
        continue;
      }
    }

    const parts = parseCSVLine(line);

    if (hasHeader && emailIdx !== -1) {
      const email = (parts[emailIdx] ?? "").trim().toLowerCase();
      const name = nameIdx >= 0 ? (parts[nameIdx] ?? "").trim() : undefined;
      const company = companyIdx >= 0 ? (parts[companyIdx] ?? "").trim() : undefined;

      if (isValidEmail(email) && !seen.has(email)) {
        seen.add(email);
        recipients.push({
          email,
          name: name || undefined,
          company: company || undefined,
        });
      }
      continue;
    }

    // No explicit header matching: inspect parts dynamically
    if (parts.length === 1) {
      // Could be "Rahul Sharma, rahul@example.com" (without comma if space split) or plain email
      const matches = Array.from(parts[0].matchAll(EMAIL_REGEX));
      if (matches.length > 0) {
        const email = matches[0][0].toLowerCase();
        const rawName = parts[0].replace(matches[0][0], "").replace(/^[,;\s]+|[,;\s]+$/g, "").trim();
        if (isValidEmail(email) && !seen.has(email)) {
          seen.add(email);
          recipients.push({ email, name: rawName || undefined });
        }
      }
    } else {
      const foundEmailIdx = parts.findIndex((p) => isValidEmail(p.trim()));
      if (foundEmailIdx !== -1) {
        const email = parts[foundEmailIdx].trim().toLowerCase();
        if (!seen.has(email)) {
          seen.add(email);
          const otherParts = parts.filter((_, idx) => idx !== foundEmailIdx).map((p) => p.trim());
          const name = (otherParts[0] || "").replace(/^[,;\s]+|[,;\s]+$/g, "");
          const company = (otherParts[1] || "").replace(/^[,;\s]+|[,;\s]+$/g, "");
          recipients.push({ email, name: name || undefined, company: company || undefined });
        }
      }
    }
  }

  return recipients;
}

/**
 * Parse a single CSV line, respecting quoted fields.
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
  }

  result.push(current);
  return result;
}

/**
 * Basic email validation.
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
