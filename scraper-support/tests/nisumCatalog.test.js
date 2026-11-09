import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { NISUM_CATALOG } from '../../scraper/nisum/catalog.js'
import { hydrateProviderCatalogEntry,getScraperCatalog } from '../providers/index.js'

test('Nisum catalog records the current public block without historical widget identifiers', () => {
  const provider=hydrateProviderCatalogEntry(NISUM_CATALOG)
  assert.equal(provider.source,'nisum')
  assert.equal(provider.companyName,'Nisum')
  assert.equal(provider.adapter,'script')
  assert.equal(provider.modulePath,path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../scraper/nisum/script.js'))
  assert.equal(provider.companyCareerPage,'https://www.nisum.com/careers/careers-india')
  assert.equal(provider.ceipalWidgetScriptUrl,'https://jobsapi.ceipal.com/APISource/widget.js')
  for (const key of ['ceipalWidgetUrl','ceipalJobPostingsApiBaseUrl','ceipalApiKey','ceipalCareerPortalId']) assert.equal(provider[key],null)
  assert.equal(provider.verifiedOn,'2026-10-27')
  assert.match(provider.verifiedSurfaceSummary,/HTTP 400.*bot-access denial/)
  assert.equal(provider.sourceExtractionImplemented,false)
  assert.equal(provider.nativeExtractionVerified,false)
  assert.equal(provider.fullInventoryVerified,false)
})

test('Nisum registered catalog override keeps incomplete source evidence and never declares no openings', () => {
  const provider=getScraperCatalog().find(value=>value.source==='nisum')
  assert.equal(provider.backfillMode,'discovery-only')
  assert.equal(provider.zeroResultPolicy,'evidence-required')
  assert.equal(provider.sourceExtractionImplemented,false)
  assert.equal(provider.nativeExtractionVerified,false)
  assert.equal(provider.fullInventoryVerified,false)
  assert.equal(provider.ceipalApiKey,null)
  assert.equal(provider.ceipalJobPostingsApiBaseUrl,null)
  assert.match(provider.paginationStrategy,/unverified/)
  assert.doesNotMatch(provider.verifiedSurfaceSummary,/\b(?:51 total jobs|no current openings)\b/i)
})
