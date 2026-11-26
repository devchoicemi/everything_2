import { beforeEach, describe, expect, it } from 'vitest'
import { __resetStoreForTests, mutateTable, readTable } from './jsonStore'

function fakeLocalStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    _data: data,
  }
}

describe('standalone jsonStore', () => {
  let ls: ReturnType<typeof fakeLocalStorage>
  beforeEach(() => {
    ls = fakeLocalStorage()
    ;(globalThis as { localStorage?: unknown }).localStorage = ls
    __resetStoreForTests()
  })

  it('returns the fallback for an unknown table', () => {
    expect(readTable('t', { a: 1 })).toEqual({ a: 1 })
  })

  it('persists mutations to localStorage and survives a cache reset', async () => {
    await mutateTable<Record<string, number>>('t', {}, (t) => ({ ...t, x: 1 }))
    __resetStoreForTests()
    expect(readTable('t', {})).toEqual({ x: 1 })
  })

  it('serialises concurrent mutations so none are lost', async () => {
    await Promise.all(
      Array.from({ length: 20 }, (_, i) => mutateTable<number[]>('q', [], (t) => [...t, i])),
    )
    expect(readTable<number[]>('q', []).length).toBe(20)
  })

  it('ignores a corrupted stored entry instead of throwing', () => {
    ls.setItem('choicemi-table:bad', '{not json')
    expect(readTable('bad', { ok: true })).toEqual({ ok: true })
  })
})
