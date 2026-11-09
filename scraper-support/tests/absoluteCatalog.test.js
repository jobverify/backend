import assert from 'node:assert/strict'
import test from 'node:test'
globalThis.fetch=async()=>{throw new Error('ABSOLUTE_OFFLINE_NETWORK_TRIPWIRE')}
const {generateCompanyCoverageReport}=await import('../providers/companyCoverage.js')
const {buildScrapers,getScraperCatalog}=await import('../providers/index.js')
const {provider}=await import('../../scraper/absolute/provider.js')

test('Absolute effective catalog overrides legacy India-first Jobvite extraction',()=>{
  const effective=getScraperCatalog().find(p=>p.source==='absolute')
  assert.equal(effective.adapter,'script')
  assert.match(effective.modulePath,/scraper[\\/]absolute[\\/]script\.js$/)
  assert.equal(effective.extractionStrategy,provider.extractionStrategy)
  assert.equal(effective.paginationStrategy,provider.paginationStrategy)
  assert.equal(effective.zeroResultPolicy,'evidence-required')
  assert.equal(effective.companyCareerPage,'https://www.absolute.com/company/careers/')
  assert.equal(effective.officialCareersHandoffUrl,'https://jobs.jobvite.com/absolute/')
  assert.equal(effective.officialBrandName,'Absolute Security')
  assert.equal(effective.verifiedPublicJobCount,undefined)
})
test('Absolute catalog retains company coverage and dry run routing',()=>{
  const scraper=buildScrapers().find(s=>s.name==='absolute')
  assert.ok(scraper)
  assert.match(scraper.dryRunFile,/absolute[\\/]jobs\.json$/)
  const report=generateCompanyCoverageReport({csvText:'Absolute\n',catalog:getScraperCatalog()})
  assert.equal(report.matchedCount,1)
  assert.equal(report.unmatchedCount,0)
  assert.equal(report.matched[0].source,'absolute')
})
