import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { watch } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parseArgs, runResilientScrape } from '../scripts/resilientLocalScrape.js'

test('external resource abort stops owned runner without a writable stop-request file', { timeout: 30000 }, async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'job-resource-stop-'))
  const controller = new AbortController()
  let observer
  try {
    const script = path.join(dir, 'fake-runner.mjs')
    await fs.writeFile(script, `
      import fs from 'node:fs'
      const hold = setInterval(() => {}, 1000)
      process.on('message', message => {
        if (message.type === 'jobverify:shutdown') {
          fs.writeFileSync(new URL('./runner-shutdown.json', import.meta.url), JSON.stringify({ pid: process.pid, message }))
          clearInterval(hold)
          process.exit(0)
        }
      })
      fs.writeFileSync(new URL('./runner-ready.json', import.meta.url), JSON.stringify({ pid: process.pid }))
    `)
    // A directory simulates an unwritable stop request without changing privileges.
    const stopPath = path.join(dir, 'stop-request.json')
    await fs.mkdir(stopPath)
    observer = watch(dir, (event, filename) => {
      if (filename === 'runner-ready.json') controller.abort(new Error('RAM limit'))
    })
    await runResilientScrape(parseArgs([
      '--run-dir', dir, '--dry-run', '--runner-script', script,
      '--max-restarts', '0', '--shutdown-grace-seconds', '1',
    ]), {
      signal: AbortSignal.any([controller.signal, t.signal]),
      prepareLaya: async ({ env }) => ({ env, stop: async () => {} }),
    })
    const ready = JSON.parse(await fs.readFile(path.join(dir, 'runner-ready.json'), 'utf8'))
    const shutdown = JSON.parse(await fs.readFile(path.join(dir, 'runner-shutdown.json'), 'utf8'))
    const ownerPid = Number(await fs.readFile(path.join(dir, 'runner.pid'), 'utf8'))
    assert.equal(ready.pid, ownerPid)
    assert.equal(shutdown.pid, ownerPid)
    assert.deepEqual(shutdown.message, { type: 'jobverify:shutdown', signal: 'SIGTERM' })
    const state = JSON.parse(await fs.readFile(path.join(dir, 'run-exit.json'), 'utf8'))
    assert.equal(state.stopRequested, true)
    assert.equal(state.code, 0)
    assert.equal(state.signal, null)
    assert.equal((await fs.stat(stopPath)).isDirectory(), true)
  } finally {
    observer?.close()
    controller.abort()
    assert.ok(path.basename(dir).startsWith('job-resource-stop-'))
    await fs.rm(dir, { recursive: true, force: true })
  }
})
