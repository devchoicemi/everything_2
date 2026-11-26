import type { Queryable } from '../db'
import { randomInt } from 'node:crypto'

const FIRST = [
  'Birch', 'Maple', 'Cedar', 'River', 'Storm', 'Willow', 'Pine', 'Lark', 'Aspen', 'Juniper', 'Harbor', 'Meadow',
  'Ember', 'Frost', 'Amber', 'Coral', 'Ivy', 'Sage', 'Rowan', 'Clover', 'Dawn', 'Misty', 'Silver', 'Golden',
]
const SECOND = [
  'Storm', 'Dusk', 'Mist', 'Ash', 'Vale', 'Harbor', 'Dawn', 'Ember', 'Brook', 'Field', 'Light', 'Wind',
  'Shore', 'Bloom', 'Hollow', 'Ridge', 'Glow', 'Haven', 'Trail', 'Peak', 'Spark', 'Tide', 'Grove', 'Sky',
]

/** A friendly anonymous handle like "Birch_Storm" that is not already taken (case-insensitive). */
export async function uniqueUsername(q: Queryable): Promise<string> {
  for (let i = 0; i < 12; i++) {
    const a = FIRST[randomInt(FIRST.length)]
    const b = SECOND[randomInt(SECOND.length)]
    if (a === b) continue
    const name = i < 8 ? `${a}_${b}` : `${a}_${b}${randomInt(10, 100)}`
    const { rows } = await q.query('select 1 from users where lower(username) = lower($1)', [name])
    if (!rows.length) return name
  }
  return `Member_${randomInt(100000, 999999)}`
}
