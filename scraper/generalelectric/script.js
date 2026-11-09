import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { run as runGeAerospace } from '../geaerospace/script.js'
import { run as runGeHealthCare } from '../gehealthcare/script.js'
import { run as runGeVernova } from '../gevernova/script.js'
import { verifyGeRecruitmentRelationship } from './nativeRelationship.js'
import { attachInventoryDelegationEvidence } from '../../scraper-support/utils/inventoryDelegationEvidence.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const GE_CAREERS_HUB_URL = 'https://www.ge.com/faq'
export const GE_SUBSIDIARY_SOURCES = ['geaerospace', 'gevernova', 'gehealthcare']

const flattenJobs = (jobLists) => jobLists.flatMap((jobs) => jobs)

export const createGeneralElectricScraper = ({
  geAerospaceRun = runGeAerospace,
  geVernovaRun = runGeVernova,
  geHealthCareRun = runGeHealthCare,
} = {}) => ({
  async run(options = {}) {
    const { fetchPage, signal, ...childOptions } = options
    signal?.throwIfAborted()
    const relationship = await verifyGeRecruitmentRelationship({ fetchPage, signal })
    signal?.throwIfAborted()
    const [aerospaceJobs, vernovaJobs, healthcareJobs] = await Promise.all([
      geAerospaceRun({ ...childOptions, signal }),
      geVernovaRun({ ...childOptions, signal }),
      geHealthCareRun({ ...childOptions, signal }),
    ])
    signal?.throwIfAborted()
    for (const [list, source, company] of [
      [aerospaceJobs, 'geaerospace', 'GE Aerospace'], [vernovaJobs, 'gevernova', 'GE Vernova'], [healthcareJobs, 'gehealthcare', 'GE HealthCare'],
    ]) {
      if (!Array.isArray(list) || list.some(job => !job || job.source !== source || job.company !== company)) {
        throw Object.assign(Error('General Electric child source/company identity mismatch'), { abortRetries: true, failureKind: 'source_identity_unverified' })
      }
    }

    const combined = flattenJobs([aerospaceJobs, vernovaJobs, healthcareJobs])
    const { maxJobs } = options
    const jobs = Number.isInteger(maxJobs) && maxJobs >= 0 ? combined.slice(0, maxJobs) : combined
    attachInventoryEvidence(jobs, { status: 'coverage-gap', surface: GE_CAREERS_HUB_URL,
      firstParty: true, listingComplete: false, pagesFetched: 0, reportedTotal: null,
      indiaFacetCount: null, verifiedAt: null,
      reason: 'independent-company-career-handoffs;child-inventories-retain-separate-source-ownership;aggregate-completeness-unverified' })
    if (relationship.observation) attachInventoryDelegationEvidence(jobs, {
      source: 'generalelectric', sources: GE_SUBSIDIARY_SOURCES,
      preservesChildSourceAndCompany: true, ...relationship.observation,
    })
    signal?.throwIfAborted()
    return jobs
  },
})

export const run = async (options = {}) => createGeneralElectricScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running General Electric scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'generalelectric')
    console.log('DB result:', result)
    process.exit(0)
  }
}
