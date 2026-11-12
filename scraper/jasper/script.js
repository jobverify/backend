import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { types } from 'node:util'
import { createOfficialAtsRecoveryScraper } from '../../scraper-support/utils/officialAtsRecovery.js'
import { runWithCurrentProgrammeZero } from '../../scraper-support/utils/currentProgrammeZeroRecovery.js'
import { runCurrentJasperProgramme } from './currentProgramme.js'
import { copyData, freezeData } from './currentProgrammeRenderer.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const provider = {
  "source": "jasper",
  "companyName": "Jasper",
  "companyDomain": "jasper.ai",
  "companyCareerPage": "https://www.jasper.ai/careers",
  "sourceScopeComplete": false,
  "officialHomepageUrl": "https://jasper.ai/"
}

export const SOURCE = provider.source
export const COMPANY = provider.companyName
export const CAREERS_URL = provider.companyCareerPage
export const DISPOSITION = 'runtime-official-ats-recovery'
const nativeOptionKeys = ['signal', 'sourceTimeoutMs', 'requestTimeoutMs', 'maxRequests', 'maxResponseBytes', 'maxAggregateBytes', 'onAudit', 'fetchImpl', 'requestIntervalMs']
export const run = async options => {
  let nativeJobs
  try {
    return await runWithCurrentProgrammeZero(options, {
      source: SOURCE,
      runPrimary: primaryOptions => createOfficialAtsRecoveryScraper(provider).run(primaryOptions),
      runProgramme: async nativeOptions => {
        nativeJobs = await runCurrentJasperProgramme(Object.fromEntries(
          nativeOptionKeys.filter(key => Object.hasOwn(nativeOptions, key)).map(key => [key, nativeOptions[key]]),
        ))
        return nativeJobs
      },
    })
  } catch (caught) {
    const audit = nativeJobs && Object.getOwnPropertyDescriptor(nativeJobs, 'nativeCollectionEvidence')?.value
    if (!audit) throw caught
    const objectError = caught && typeof caught === 'object' && !types.isProxy(caught)
    const existing = objectError && Object.getOwnPropertyDescriptor(caught, 'nativeCollectionEvidence')
    // An earlier bridge mismatch already carries its complete prior/current
    // evidence. After reconciliation the private result owns the release audit;
    // an observer's thrown payload cannot replace those acquired originals.
    if (audit.priorNativePayloadReconciled !== true && existing && Object.hasOwn(existing, 'value')) throw caught
    const evidence = freezeData(copyData({...audit, currentTransactionQualified:false,
      currentDeclaredSourceProgramComplete:false, registeredReleaseCompleted:false, heldAt:new Date().toISOString()}))
    // Registered classification traverses causes. Keep an uninspectable Proxy
    // opaque while preserving the complete acquired audit on this ordinary Error.
    const error = objectError && Object.isExtensible(caught) && (!existing || existing.configurable)
      ? caught
      : Object.assign(new Error('Jasper registered programme release failed', types.isProxy(caught) ? undefined : {cause:caught}), {
        softFailure:true, abortRetries:true, failureKind:'coverage_gap',
      })
    Object.defineProperty(error, 'nativeCollectionEvidence', {value:evidence, configurable:true})
    throw error
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
