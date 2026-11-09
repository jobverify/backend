import { createHash } from 'node:crypto'
import fs from 'node:fs'
import { GLICLASS_IDENTITY } from '../src/services/postScrapeClassification.js'

export function trialNativeRuntimeHash() {
  return createHash('sha256').update([
    '../classification/gliclass/worker.py', '../classification/gliclass/runtime.py', '../classification/gliclass/model.json',
    '../classification/gliclass/requirements.txt', './gliclassWorker.js',
  ].map(file => fs.readFileSync(new URL(file, import.meta.url)).toString().replace(/\r\n/g, '\n')).join('\n')).digest('hex')
}

export function trialNativeInputHash(input, runtime = trialNativeRuntimeHash()) {
  return createHash('sha256').update(JSON.stringify([input.title, input.body,
    input.sourceEmploymentType, GLICLASS_IDENTITY.modelRevision, 'utf8-transport-v1', runtime])).digest('hex')
}
