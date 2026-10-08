type Token =
  | { kind: 'num'; value: number }
  | { kind: 'id'; value: string }
  | { kind: 'op'; value: string }
  | { kind: 'lp' }
  | { kind: 'rp' }

const FUNCTIONS = new Set(['sin', 'cos', 'tan', 'sqrt', 'abs'])

function tokenize(source: string): Token[] | null {
  const tokens: Token[] = []
  let index = 0
  while (index < source.length) {
    const char = source[index]
    if (char === ' ' || char === '\t') {
      index += 1
      continue
    }
    if (char === '(') {
      tokens.push({ kind: 'lp' })
      index += 1
      continue
    }
    if (char === ')') {
      tokens.push({ kind: 'rp' })
      index += 1
      continue
    }
    if ('+-*/^'.includes(char)) {
      tokens.push({ kind: 'op', value: char })
      index += 1
      continue
    }
    if (/[0-9.]/.test(char)) {
      let end = index + 1
      while (end < source.length && /[0-9.]/.test(source[end])) end += 1
      const value = Number(source.slice(index, end))
      if (!Number.isFinite(value)) return null
      tokens.push({ kind: 'num', value })
      index = end
      continue
    }
    if (/[a-z]/i.test(char)) {
      let end = index + 1
      while (end < source.length && /[a-z]/i.test(source[end])) end += 1
      tokens.push({ kind: 'id', value: source.slice(index, end).toLowerCase() })
      index = end
      continue
    }
    return null
  }
  return tokens
}

type Fn = (x: number) => number

export function compileExpression(source: string): Fn | null {
  const parsed = tokenize(source.trim())
  if (!parsed || parsed.length === 0) return null
  const tokens: Token[] = parsed
  let cursor = 0

  function peek(): Token | undefined {
    return tokens[cursor]
  }

  function eat(): Token | undefined {
    const token = tokens[cursor]
    cursor += 1
    return token
  }

  function parseExpression(): Fn | null {
    let left = parseTerm()
    if (!left) return null
    while (peek()?.kind === 'op' && /^[+-]$/.test((peek() as { value: string }).value)) {
      const op = (eat() as { value: string }).value
      const right = parseTerm()
      if (!right) return null
      const current: Fn = left
      left = (x) => (op === '+' ? current(x) + right(x) : current(x) - right(x))
    }
    return left
  }

  function parseTerm(): Fn | null {
    let left = parseUnary()
    if (!left) return null
    while (peek()?.kind === 'op' && /^[*/]$/.test((peek() as { value: string }).value)) {
      const op = (eat() as { value: string }).value
      const right = parseUnary()
      if (!right) return null
      const current: Fn = left
      left = (x) => (op === '*' ? current(x) * right(x) : current(x) / right(x))
    }
    return left
  }

  function parseUnary(): ((x: number) => number) | null {
    if (peek()?.kind === 'op' && (peek() as { value: string }).value === '-') {
      eat()
      const inner = parseUnary()
      if (!inner) return null
      return (x) => -inner(x)
    }
    if (peek()?.kind === 'op' && (peek() as { value: string }).value === '+') {
      eat()
      return parseUnary()
    }
    return parsePower()
  }

  function parsePower(): ((x: number) => number) | null {
    const base = parsePrimary()
    if (!base) return null
    if (peek()?.kind === 'op' && (peek() as { value: string }).value === '^') {
      eat()
      const exponent = parseUnary()
      if (!exponent) return null
      return (x) => base(x) ** exponent(x)
    }
    return base
  }

  function parsePrimary(): ((x: number) => number) | null {
    const token = peek()
    if (!token) return null
    if (token.kind === 'num') {
      eat()
      return () => token.value
    }
    if (token.kind === 'id') {
      eat()
      if (token.value === 'x') return (x) => x
      if (token.value === 'pi') return () => Math.PI
      if (FUNCTIONS.has(token.value) && peek()?.kind === 'lp') {
        eat()
        const argument = parseExpression()
        if (!argument || peek()?.kind !== 'rp') return null
        eat()
        const name = token.value
        return (x) => {
          const value = argument(x)
          if (name === 'sin') return Math.sin(value)
          if (name === 'cos') return Math.cos(value)
          if (name === 'tan') return Math.tan(value)
          if (name === 'sqrt') return Math.sqrt(value)
          return Math.abs(value)
        }
      }
      return null
    }
    if (token.kind === 'lp') {
      eat()
      const inner = parseExpression()
      if (!inner || peek()?.kind !== 'rp') return null
      eat()
      return inner
    }
    return null
  }

  const compiled = parseExpression()
  if (!compiled || cursor !== tokens.length) return null
  return compiled
}
