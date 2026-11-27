let skipGate = false;
let landOn: string | null = null;

export function markLeave(id: string): void {
  skipGate = true;
  landOn = id;
}

export function consumeLeave(): { skipGate: boolean; landOn: string | null } {
  const out = { skipGate, landOn };
  skipGate = false;
  landOn = null;
  return out;
}
