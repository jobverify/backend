import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'

import { installGracefulShutdownHandlers } from '../utils/gracefulShutdown.js'

class FakeProcess extends EventEmitter {
  exitCalls = []

  exit(code) {
    this.exitCalls.push(code)
  }
}

test('first termination signal requests a drain and the second forces exit', () => {
  const processRef = new FakeProcess()
  const messages = []
  const shutdown = installGracefulShutdownHandlers({
    processRef,
    log: (message) => messages.push(message),
  })

  processRef.emit('SIGTERM')

  assert.equal(shutdown.requested, true)
  assert.equal(shutdown.signalName, 'SIGTERM')
  assert.equal(shutdown.signal.aborted, true)
  assert.deepEqual(processRef.exitCalls, [])
  assert.match(messages[0], /finish active sources/i)

  processRef.emit('SIGTERM')

  assert.deepEqual(processRef.exitCalls, [143])
  shutdown.dispose()
})

test('supervisor IPC requests the same graceful drain path', () => {
  const processRef = new FakeProcess()
  const shutdown = installGracefulShutdownHandlers({ processRef, log: () => {} })

  processRef.emit('message', { type: 'jobverify:shutdown', signal: 'SIGINT' })

  assert.equal(shutdown.requested, true)
  assert.equal(shutdown.signalName, 'SIGINT')
  assert.deepEqual(processRef.exitCalls, [])
  shutdown.dispose()
})
