import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createPhenomScraper } from '../../scraper-support/phenom/engine.js'
import { reviewedPhenomTitleBindingsForSource } from '../../scraper-support/phenom/reviewedTitleBindings20261108.js'
import {attachInventoryEvidence,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const scraper = createPhenomScraper({
  companyName: 'BCG',
  source: 'bcg',
  baseUrl: 'https://careers.bcg.com',
  searchPath: '/global/en/search-results',
  scraperDir: currentDir,
  nativeBoundModelTitlePreference: true,
  nativeReviewedTitleBindings: reviewedPhenomTitleBindingsForSource('bcg'),
  defaultDetailConcurrency:4,
  defaultDetailEnrichmentBudgetMs:180000,
})

export const {
  buildSearchResultsPageUrl,
  buildJobDetailUrl,
  extractSearchPayload,
  extractSearchResults,
  extractJobDetail,
} = scraper

export const run=async(options={})=>{
  const jobs=await scraper.run(options)
  options.signal?.throwIfAborted()
  const closing=await scraper.run({...options,detailEnrichmentBudgetMs:0})
  options.signal?.throwIfAborted()
  const openingEvidence=readInventoryEvidence(jobs),closingEvidence=readInventoryEvidence(closing)
  const identities=rows=>JSON.stringify(rows.map(job=>[job.jobId,job.requisitionId,job.title,job.sourceUrl]).sort((a,b)=>a[0].localeCompare(b[0])))
  const reconciled=openingEvidence?.listingComplete===true&&closingEvidence?.listingComplete===true
    &&openingEvidence.reportedTotal===closingEvidence.reportedTotal&&openingEvidence.indiaFacetCount===closingEvidence.indiaFacetCount
    &&new Set(jobs.map(job=>job.jobId)).size===jobs.length&&identities(jobs)===identities(closing)
  if(!reconciled)for(const job of jobs)job.sourceListingComplete=false
  return attachInventoryEvidence(jobs,{...openingEvidence,status:reconciled?'complete-inventory':'coverage-gap',listingComplete:reconciled,
    pagesFetched:(openingEvidence?.pagesFetched||0)+(closingEvidence?.pagesFetched||0),verifiedAt:new Date().toISOString(),
    reason:reconciled?'BCG native India total, country cohort and opening/closing unique role identities reconciled; full native detail health assessed separately'
      :'BCG native opening/closing identities or target-country inventory remain incomplete'})
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, 'bcg')
  }
}
