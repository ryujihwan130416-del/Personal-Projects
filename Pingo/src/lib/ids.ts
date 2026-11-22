export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@/, '').toLowerCase()
}

export function isValidUsername(name: string): boolean {
  return /^[a-z0-9._]{3,20}$/.test(name)
}

export function dmChatId(a: string, b: string): string {
  return [a, b].sort().join('_')
}

export function otherMemberId(memberIds: string[], uid: string): string | undefined {
  return memberIds.find((id) => id !== uid)
}
