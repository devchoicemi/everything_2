import { beforeEach, describe, expect, it } from 'vitest'
import { __resetStoreForTests, mutateTable, readTable } from './jsonStore'

beforeEach(() => {
  __resetStoreForTests()
})

describe('mutateTable concurrency', () => {
  it('serialises concurrent mutations — no lost updates', async () => {
    const N = 25
    await Promise.all(
      Array.from({ length: N }).map(() =>
        mutateTable<{ count: number }>('counter', { count: 0 }, (data) => ({ count: data.count + 1 })),
      ),
    )
    const final = readTable<{ count: number }>('counter', { count: 0 })
    expect(final.count).toBe(N)
  })

  it('applies mutations in submission order for a single caller', async () => {
    const log: number[] = []
    await mutateTable<{ v: number }>('order', { v: 0 }, (d) => {
      log.push(1)
      return { v: d.v + 1 }
    })
    await mutateTable<{ v: number }>('order', { v: 0 }, (d) => {
      log.push(2)
      return { v: d.v + 1 }
    })
    expect(log).toEqual([1, 2])
  })
})
