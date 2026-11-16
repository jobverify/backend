import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'
import { ModelResponseError } from '../src/pipeline/processingErrors.js'

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
      let result
      try { result = JSON.parse(line) }
      catch (error) { throw new ModelResponseError('Invalid GLiClass response JSON', { cause: error }) }
      if (!result || typeof result !== 'object' || Array.isArray(result)) throw new ModelResponseError('Invalid GLiClass response')
      if (result.ready) { configuration = result; ready?.resolve(result); ready = null; return }
      if (!pending || result.id !== pending.id) throw new Error('Unexpected GLiClass response')
      const request = pending
      pending = null
      if (Object.hasOwn(result, 'error')) {
        const error = new Error(result.error || 'GLiClass inference failed without diagnostics')
        if (/host memory exceeded|out of memory|cannot allocate memory|can't allocate memory|not enough memory|std::bad_alloc/i.test(result.error || '')) error.code = 'ENOMEM'
        else if (!result.error) error.code = 'WORKER_EXECUTION_ERROR'
        request.reject(error)
      } else request.resolve(result.prediction)
    } catch (error) { rejectPending(error) }
  })
  child.on('error', error => rejectPending(Object.assign(new Error('GLiClass process failed', { cause: error }), { code: 'WORKER_EXECUTION_ERROR' })))
  child.on('exit', (code, signal) => rejectPending(Object.assign(
    new Error(`GLiClass exited (${code}${signal ? `, ${signal}` : ''}); see ${logFile}`), { code: 'WORKER_EXECUTION_ERROR' })))
  child.stdin.on('error', error => rejectPending(Object.assign(new Error('GLiClass input stream failed', { cause: error }), { code: 'WORKER_EXECUTION_ERROR' })))
  const stop = async () => {
    if (stopped) return
    stopped = true
    rejectPending(new Error('GLiClass stopped'))
    child.stdin.end()
    if (child.exitCode !== null || child.signalCode) return
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
        if (stopped) return reject(new Error('GLiClass is stopped'))
        if (child.exitCode !== null || child.signalCode) return reject(Object.assign(new Error('GLiClass exited'), { code: 'WORKER_EXECUTION_ERROR' }))
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
