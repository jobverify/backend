import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { types } from 'node:util'
import { createOfficialAtsRecoveryScraper } from '../../scraper-support/utils/officialAtsRecovery.js'
import { runWithCurrentProgrammeZero } from '../../scraper-support/utils/currentProgrammeZeroRecovery.js'
import { runCurrentHyperscienceProgramme } from './currentProgramme.js'
import { plainSnapshot } from './currentProgrammeRenderer.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const provider = {
  "source": "hyperscience",
  "companyName": "Hyperscience",
  "companyDomain": "hyperscience.ai",
  "companyCareerPage": "https://www.hyperscience.ai/about-us/careers/",
  "officialHomepageUrl": "https://www.hyperscience.ai/",
  "sourceScopeComplete": false
}

export const SOURCE = provider.source
export const COMPANY = provider.companyName
export const CAREERS_URL = provider.companyCareerPage
export const DISPOSITION = 'runtime-official-ats-recovery'
const nativeOptions = ['signal', 'sourceTimeoutMs', 'requestTimeoutMs', 'maxRequests',
  'maxResponseBytes', 'maxAggregateBytes', 'onAudit', 'fetchImpl', 'requestIntervalMs']
// Only trusted, privately cloned JSON reaches this local freeze.
const freezeData = value => {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeData(child)
    Object.freeze(value)
  }
  return value
}

export const run = async options => {
  let nativeJobs
  try {
    return await runWithCurrentProgrammeZero(options, {
      source: SOURCE,
      runPrimary: primaryOptions => createOfficialAtsRecoveryScraper(provider).run(primaryOptions),
      runProgramme: async programmeOptions => {
        const projected = {}
        for (const key of nativeOptions) {
          if (Object.hasOwn(programmeOptions, key)) projected[key] = programmeOptions[key]
        }
        nativeJobs = await runCurrentHyperscienceProgramme(projected)
        return nativeJobs
      },
    })
  } catch (caught) {
    const audit = nativeJobs && Object.getOwnPropertyDescriptor(nativeJobs, 'nativeCollectionEvidence')?.value
    if (!audit) throw caught
    const proxy = types.isProxy(caught)
    const objectError = caught && typeof caught === 'object' && !proxy
    const existing = objectError ? Object.getOwnPropertyDescriptor(caught, 'nativeCollectionEvidence') : undefined
    // The bridge's own mismatch audit contains BOTH original envelopes.
    if (audit.priorNativePayloadReconciled !== true && existing && Object.hasOwn(existing, 'value')) throw caught
    const evidence = plainSnapshot(audit)
    // A failed outer release cannot undo a completed inner acquisition.
    evidence.registeredReleaseCompleted = false
    evidence.registeredReleaseHeldAt = new Date().toISOString()
    evidence.registeredReleaseScope = 'Outer registered release after the native controller; inner physical facts are retained.'
    freezeData(evidence)
    const error = objectError && Object.isExtensible(caught) && (!existing || existing.configurable)
      ? caught
      : Object.assign(new Error('Hyperscience registered programme release failed', proxy ? undefined : { cause: caught }),
        { softFailure: true, abortRetries: true, failureKind: 'coverage_gap' })
    Object.defineProperty(error, 'nativeCollectionEvidence', { value: evidence, configurable: true })
    throw error
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
