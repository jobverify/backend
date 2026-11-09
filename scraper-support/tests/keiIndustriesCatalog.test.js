import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
globalThis.fetch = async () => { throw new Error('OFFLINE network tripwire') }
const { generateCompanyCoverageReport } = await import('../providers/companyCoverage.js')
const { hydrateProviderCatalogEntry, getScraperCatalog, createCatalogScraper } = await import('../providers/index.js')
const { KEI_INDUSTRIES_CATALOG } = await import('../../scraper/keiindustries/catalog.js')
const currentDir = path.dirname(fileURLToPath(import.meta.url))
test('KEI catalog delegates current hiring to the advertised employer CandidateMAX portal', async () => {
  const provider = hydrateProviderCatalogEntry(KEI_INDUSTRIES_CATALOG)
  assert.equal(provider.source, 'keiindustries')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://keihrms.myadrenalin.com/CandidateMAX/#/?CompanyID=KEIIND#new_tab')
  assert.equal(provider.homepageUrl, 'https://www.kei-ind.com/')
  assert.equal(provider.companyDomain, 'kei-ind.com')
  assert.equal(provider.atsPlatform, 'adrenalin-candidatemax')
  assert.deepEqual(provider.additionalPublicRecruitmentChannels, ['https://maxhr.myadrenalin.com/CandidateMAX/#/?CompanyID=KEIIND#new_tab'])
  assert.equal(provider.modulePath, path.resolve(currentDir,'../../scraper/keiindustries/script.js'))
  assert.equal(typeof (await import(pathToFileURL(provider.modulePath))).run, 'function')
})
test('KEI exact backlog company row still binds to the current local provider', () => {
  const report = generateCompanyCoverageReport({ csvText: 'KEI Industries\n', catalog: [hydrateProviderCatalogEntry(KEI_INDUSTRIES_CATALOG)] })
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.equal(report.matched[0].source, 'keiindustries')
})
test('KEI current provider override remains registered and runnable', () => {
  const provider = getScraperCatalog().find(p => p.source === 'keiindustries')
  assert.equal(provider.adapter,'script')
  assert.equal(provider.companyCareerPage,'https://keihrms.myadrenalin.com/CandidateMAX/#/?CompanyID=KEIIND#new_tab')
  assert.equal(typeof createCatalogScraper(provider).run,'function')
  assert.match(provider.dryRunFile,/keiindustries[\\/]jobs\.json$/)
})
