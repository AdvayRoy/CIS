// OWNER: worker F (w/i18n).
export type MessageTree = { [key: string]: string | MessageTree };

const isTree = (v: unknown): v is MessageTree => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * English is the shape. A translated value is used only where English has a string
 * at the same path and the translation is a non-empty string; everything else stays English.
 */
export function mergeOverEnglish(english: MessageTree, translated: unknown): MessageTree {
  const out: MessageTree = {};
  const t = isTree(translated) ? translated : {};
  for (const [key, base] of Object.entries(english)) {
    const candidate = t[key];
    if (isTree(base)) out[key] = mergeOverEnglish(base, candidate);
    else out[key] = typeof candidate === "string" && candidate.trim() !== "" ? candidate : base;
  }
  return out;
}

export function flattenKeys(tree: unknown, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  if (!isTree(tree)) return out;
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isTree(value)) Object.assign(out, flattenKeys(value, path));
    else out[path] = value as string;
  }
  return out;
}
