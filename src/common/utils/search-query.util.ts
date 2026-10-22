const SEARCH_SYNONYM_GROUPS = [
  ['am thuc', 'an uong', 'quan an', 'mon an', 'do an', 'dung bua'],
  [
    'du lich',
    'tham quan',
    'du ngoan',
    'di choi',
    'check in',
    'checkin',
    'tour',
    'tour trai nghiem',
  ],
  ['chua', 'chua chien', 'den chua'],
  ['ubnd', 'uy ban nhan dan'],
] as const;

const MAX_SEARCH_VARIANTS = 24;

export function normalizeSearchText(value: unknown): string {
  const text = Array.isArray(value)
    ? value.map(stringifySearchValue).join(' ')
    : stringifySearchValue(value);

  return text
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Returns the original normalized query followed by semantic alternatives.
 * Replacing complete phrases (instead of appending every synonym) preserves
 * the search rule that all meaningful terms in a query must match.
 */
export function expandSearchQuery(value: string): string[] {
  const normalized = normalizeSearchText(value);
  if (!normalized) return [];

  const variants = new Set<string>([normalized]);
  for (const group of SEARCH_SYNONYM_GROUPS) {
    for (const alias of group) {
      if (!containsPhrase(normalized, alias)) continue;
      for (const alternative of group) {
        variants.add(replacePhrase(normalized, alias, alternative));
        if (variants.size >= MAX_SEARCH_VARIANTS) return [...variants];
      }
    }
  }

  return [...variants];
}

/**
 * Small-dataset matcher used by the public marker list. It supports unordered
 * prefix terms plus conservative typo tolerance, mirroring global search.
 */
export function matchesExpandedSearch(
  searchableValue: unknown,
  searchValue: string,
): boolean {
  const candidateWords = normalizeSearchText(searchableValue).split(' ');
  if (candidateWords.length === 0) return false;

  return expandSearchQuery(searchValue).some((variant) =>
    variant
      .split(' ')
      .every((term) => candidateWords.some((word) => wordMatches(term, word))),
  );
}

function containsPhrase(value: string, phrase: string): boolean {
  return ` ${value} `.includes(` ${phrase} `);
}

function replacePhrase(value: string, phrase: string, replacement: string) {
  return ` ${value} `
    .replaceAll(` ${phrase} `, ` ${replacement} `)
    .trim()
    .replace(/\s+/g, ' ');
}

function wordMatches(term: string, candidate: string): boolean {
  if (candidate.startsWith(term)) return true;
  if (term.length < 4 || candidate.length < 4) return false;

  const allowedDistance = Math.max(term.length, candidate.length) >= 7 ? 2 : 1;
  if (Math.abs(term.length - candidate.length) > allowedDistance) return false;
  return levenshteinDistance(term, candidate) <= allowedDistance;
}

function levenshteinDistance(left: string, right: string): number {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] +
          (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous = current;
  }

  return previous[right.length];
}

function stringifySearchValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}
