/**
 * Sanitize filing save payloads: remove preview-only blobs, keep business fields
 * (including camelCase + snake_case duplicates used by different API layers).
 */

const INTERNAL_PROPERTY_KEYS = new Set(['__propertyRowKey', '__propertyRowId']);

/** URLs that must not be POSTed on save (re-fetch Notice 9 / use /api/files/download for attachments). */
export function isEphemeralFilingUrl(url: string | null | undefined): boolean {
  const v = String(url ?? '').trim();
  if (!v) return false;
  const lower = v.toLowerCase();
  if (lower.startsWith('data:') || lower.startsWith('blob:')) return true;
  // Inline base64 without data: prefix (legacy)
  if (v.length > 8_000 && /^[A-Za-z0-9+/=\s]+$/.test(v.replace(/\s/g, ''))) return true;
  return false;
}

/** Persist only real file references (http(s), storage keys); drop session preview blobs. */
export function sanitizeUrlForFilingPersist(url: unknown): string | null {
  const v = String(url ?? '').trim();
  if (!v || isEphemeralFilingUrl(v)) return null;
  return v;
}

export function sanitizeMutationDetailsForFilingPersist(
  details: unknown
): Record<string, unknown> | null {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return null;
  const src = details as Record<string, unknown>;
  const out: Record<string, unknown> = { ...src };
  const notice9 = sanitizeUrlForFilingPersist(
    pickStr(out, 'notice9Url', 'notice9_url')
  );
  const attach = sanitizeUrlForFilingPersist(
    pickStr(out, 'attachFileUrl', 'attach_file_url', 'fileUrl', 'file_url')
  );
  if (notice9) {
    out['notice9Url'] = notice9;
    delete out['notice9_url'];
  } else {
    delete out['notice9Url'];
    delete out['notice9_url'];
  }
  if (attach) {
    out['attachFileUrl'] = attach;
  } else {
    delete out['attachFileUrl'];
    delete out['attach_file_url'];
  }
  return out;
}

export function sanitizeNotice9ResolvedForFilingPersist(
  resolved: unknown
): Record<string, unknown> | null {
  if (!resolved || typeof resolved !== 'object' || Array.isArray(resolved)) return null;
  const src = resolved as Record<string, unknown>;
  const url = sanitizeUrlForFilingPersist(src['url']);
  return {
    available: src['available'] ?? false,
    sourceKind: src['sourceKind'] ?? src['source_kind'] ?? null,
    previewKind: src['previewKind'] ?? src['preview_kind'] ?? 'none',
    ...(url ? { url } : {})
  };
}

/** Drop UI-only keys from property card rows; keep API fields and area duplicates. */
export function sanitizePropertyDetailForFilingPersist(
  detail: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(detail)) {
    if (INTERNAL_PROPERTY_KEYS.has(key)) continue;
    out[key] = value;
  }
  return out;
}

function pickStr(obj: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return '';
}
