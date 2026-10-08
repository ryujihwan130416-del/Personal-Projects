export function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export function namesMatch(title: string, handle: string, query: string): boolean {
  const wanted = normalizeName(query)
  const compactWanted = wanted.replace(/ /g, '')
  if (!wanted) return false
  const names = [normalizeName(title), normalizeName(handle).replace(/^@/, '')]
  return names.some((name) => name === wanted || (compactWanted.length > 0 && name.replace(/ /g, '') === compactWanted))
}
