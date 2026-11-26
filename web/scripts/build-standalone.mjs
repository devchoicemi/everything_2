// Builds the static export that gets bundled into the offline Android app.
//
// A static export can't contain API routes, but the in-app router still needs
// their handlers — so app/api is renamed to app/_api (a private folder Next
// ignores for routing) for the duration of the build, and always restored.
import { existsSync, renameSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const api = path.join(root, 'app', 'api')
const hidden = path.join(root, 'app', '_api')

if (existsSync(hidden)) {
  console.error('app/_api already exists — a previous standalone build was interrupted. Rename it back to app/api first.')
  process.exit(1)
}

renameSync(api, hidden)
let status = 1
try {
  const r = spawnSync('npx', ['next', 'build'], {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, STANDALONE: '1', NEXT_PUBLIC_STANDALONE: '1' },
  })
  status = r.status ?? 1
} finally {
  // Windows can briefly hold the folder (indexers, watchers) — retry before giving up.
  for (let i = 0; ; i++) {
    try {
      renameSync(hidden, api)
      break
    } catch (e) {
      if (i >= 20) {
        console.error('Could not restore app/api — rename app/_api back to app/api manually.')
        throw e
      }
      await new Promise((r) => setTimeout(r, 500))
    }
  }
}
process.exit(status)
