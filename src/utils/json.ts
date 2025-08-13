export function extractFirstJsonObject(text: string): string | undefined {
  // Try fenced JSON
  const fenceMatch = text.match(/```\s*json\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }
  // Try any fenced block
  const anyFence = text.match(/```[\s\S]*?```/);
  if (anyFence) {
    const inner = anyFence[0].replace(/```/g, '').trim();
    if (inner.startsWith('{') && inner.endsWith('}')) return inner;
  }
  // Fallback: balance braces
  const start = text.indexOf('{');
  if (start === -1) return undefined;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }
  return undefined;
}

export function tryParseJson<T>(jsonText: string): T | undefined {
  try {
    return JSON.parse(jsonText) as T;
  } catch {
    return undefined;
  }
}