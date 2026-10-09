import { describe, expect, it } from 'vitest'
import { compileExpression } from './graph'

describe('graph expressions', () => {
  it('evaluates arithmetic and x', () => {
    const square = compileExpression('x^2')
    expect(square?.(3)).toBe(9)
    expect(compileExpression('(2+3)*4')?.(0)).toBe(20)
    expect(compileExpression('2^3')?.(0)).toBe(8)
  })

  it('evaluates functions', () => {
    expect(compileExpression('sin(0)')?.(1)).toBe(0)
    expect(compileExpression('sqrt(4)')?.(0)).toBe(2)
    expect(compileExpression('abs(x)')?.(-3)).toBe(3)
  })

  it('rejects unknown input', () => {
    expect(compileExpression('nope')).toBeNull()
    expect(compileExpression('sin(')).toBeNull()
    expect(compileExpression('')).toBeNull()
  })
})
