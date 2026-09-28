/**
 * MIME utilities for email content processing.
 * Merge tag replacement for template-based emails.
 */

interface MergeData {
  email: string;
  name?: string | null;
  company?: string | null;
}

/**
 * Replace merge tags in text with recipient data.
 * Supported tags: {{name}}, {{company}}, {{email}}
 * Missing values are replaced with empty string.
 */
export function applyMergeTags(template: string, data: MergeData): string {
  const fullName = (data.name || "").trim();
  const firstName = fullName ? fullName.split(/\s+/)[0] : "";
  const company = data.company || "";
  const email = data.email || "";

  return template
    .replace(/\{\{name\}\}/gi, fullName)
    .replace(/\{name\}/gi, fullName)
    .replace(/\{\{first_name\}\}/gi, firstName)
    .replace(/\{first_name\}/gi, firstName)
    .replace(/\{\{firstname\}\}/gi, firstName)
    .replace(/\{firstname\}/gi, firstName)
    .replace(/\{\{company\}\}/gi, company)
    .replace(/\{company\}/gi, company)
    .replace(/\{\{email\}\}/gi, email)
    .replace(/\{email\}/gi, email);
}
