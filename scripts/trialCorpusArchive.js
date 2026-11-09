import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { getSourceDescription } from '../src/utils/jobSourceContent.js'
import { renameFileWithRetry } from '../scraper-support/utils/runCheckpoint.js'

export function compactTrialJob(job) {
  const { description: _description, jobDescription: _jobDescription, sourceDescription: _sourceDescription, ...rest } = job
  return { ...rest, sourceDescription: getSourceDescription(job) }
}

export function writeTrialCorpus(directory, jobs, identity) {
  const file = path.join(directory, 'corpus.jsonl'), temporary = `${file}.tmp`
  const fd = fs.openSync(temporary, 'w'), digest = createHash('sha256')
  let jobCount = 0
  try {
    for (const job of jobs) {
      const line = `${JSON.stringify(compactTrialJob(job))}\n`
      fs.writeSync(fd, line)
      digest.update(line)
      jobCount++
    }
  } finally { fs.closeSync(fd) }
  renameFileWithRetry(temporary, file)
  fs.writeFileSync(path.join(directory, 'corpus-manifest.json'), JSON.stringify({
    identity, jobCount, file: 'corpus.jsonl', sha256: digest.digest('hex'),
  }, null, 2))
}

export async function* readTrialCorpusJobs(directory) {
  const file = path.join(directory, 'corpus.jsonl')
  if (!fs.existsSync(file)) {
    for (const job of JSON.parse(fs.readFileSync(path.join(directory, 'corpus.json'))).jobs) yield job
    return
  }
  const stream = fs.createReadStream(file, { encoding: 'utf8' })
  // JSON permits literal U+2028/U+2029 inside strings. Readline treats those
  // as line endings; JSONL records are separated only by the actual LF byte.
  let pending = ''
  try {
    for await (const chunk of stream) {
      pending += chunk
      let end
      while ((end = pending.indexOf('\n')) !== -1) {
        const line = pending.slice(0, end)
        pending = pending.slice(end + 1)
        if (line.trim()) yield JSON.parse(line)
      }
    }
    if (pending.trim()) yield JSON.parse(pending)
  } finally { stream.destroy() }
}

export async function* readPrioritizedTrialCorpusJobs(directory, priorityIds = []) {
  const priority = new Set(priorityIds)
  if (priority.size) {
    for await (const job of readTrialCorpusJobs(directory)) if (priority.has(job.trialId)) yield job
  }
  for await (const job of readTrialCorpusJobs(directory)) if (!priority.has(job.trialId)) yield job
}
