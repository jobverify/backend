import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'

export async function startGliclassWorker({ python = process.env.GLICLASS_PYTHON || 'python',
  modelDirectory = process.env.GLICLASS_MODEL_DIRECTORY,
  logFile = '.cache/scraper-actions/gliclass-worker.log', env = process.env } = {}) {
  if (!modelDirectory) throw new Error('GLICLASS_MODEL_DIRECTORY is required')
  fs.mkdirSync(path.dirname(logFile), { recursive: true })
  const log = fs.openSync(logFile, 'a')
  const child = spawn(python, ['-u', fileURLToPath(new URL('../classification/gliclass/worker.py', import.meta.url))], {
    env: { ...env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8',
      GLICLASS_MODEL_DIRECTORY: path.resolve(modelDirectory) },
    windowsHide: true, stdio: ['pipe', 'pipe', log],
  })
  fs.closeSync(log)
  let pending, ready, configuration, queue = Promise.resolve(), stopped = false
  const rejectPending = error => { pending?.reject(error); pending = null; ready?.reject(error) }
  const lines = readline.createInterface({ input: child.stdout })
  lines.on('line', line => {
    try {
      const result = JSON.parse(line)
      if (result.ready) { configuration = result; ready?.resolve(result); ready = null; return }
      if (!pending || result.id !== pending.id) throw new Error('Unexpected GLiClass response')
      const request = pending
      pending = null
      result.error ? request.reject(new Error(result.error)) : request.resolve(result.prediction)
    } catch (error) { rejectPending(error) }
  })
  child.on('error', rejectPending)
  child.on('exit', code => rejectPending(new Error(`GLiClass exited (${code}); see ${logFile}`)))
  child.stdin.on('error', rejectPending)
  const stop = async () => {
    if (stopped) return
    stopped = true
    rejectPending(new Error('GLiClass stopped'))
    child.stdin.end()
    if (child.exitCode !== null) return
    await new Promise(resolve => {
      const timer = setTimeout(() => child.kill(), 5000)
      child.once('exit', () => { clearTimeout(timer); lines.close(); resolve() })
    })
  }
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('GLiClass startup timed out')), 180000)
      ready = { resolve: value => { clearTimeout(timer); resolve(value) }, reject: error => { clearTimeout(timer); reject(error) } }
    })
  } catch (error) { await stop(); throw error }
  return {
    pid: child.pid,
    configuration,
    classify(input) {
      const run = () => new Promise((resolve, reject) => {
        if (stopped || child.exitCode !== null) return reject(new Error('GLiClass is stopped'))
        const timer = setTimeout(() => { reject(new Error('GLiClass request timed out')); void stop() }, 300000)
        pending = { id: input.inputHash, resolve: value => { clearTimeout(timer); resolve(value) },
          reject: error => { clearTimeout(timer); reject(error) } }
        child.stdin.write(`${JSON.stringify({ ...input, id: input.inputHash })}\n`)
      })
      const result = queue.then(run)
      queue = result.catch(() => {})
      return result
    },
    stop,
  }
}
