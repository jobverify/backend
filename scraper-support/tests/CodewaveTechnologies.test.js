import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {hydrateProviderCatalogEntry} from '../providers/index.js'
import * as codewave from '../../scraper/codewavetechnologies/script.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/codewaveDeltecs20261106/capture.json.gz',import.meta.url))))
const current=fixture.documents['https://codewave.com/careers'].body
const fetchPage=async url=>{assert.ok(fixture.documents[url],'Uncaptured URL '+url);const page=fixture.documents[url];return {status:page.status,url:page.finalUrl,headers:page.headers,body:page.body,bodyUnavailable:page.bodyUnavailable}}
const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/codewavetechnologies/catalog.js')
  } catch {
    assert.fail('Expected Codewave Technologies catalog module at ../../scraper/codewavetechnologies/catalog.js')
  }
}

test('Codewave Technologies local catalog captures the verified first-party careers contract', async () => {
  const { CODEWAVE_TECHNOLOGIES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(CODEWAVE_TECHNOLOGIES_CATALOG)

  assert.equal(defaultCatalog, CODEWAVE_TECHNOLOGIES_CATALOG)
  assert.equal(provider.source, 'codewavetechnologies')
  assert.equal(provider.companyName, 'Codewave Technologies')
  assert.equal(provider.officialBrandName, 'Codewave')
  assert.equal(provider.companyCareerPage, 'https://codewave.com/careers/')
  assert.equal(provider.companyDomain, 'codewave.com')
  assert.equal(provider.atsPlatform, 'first-party-html-job-pages')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-listing-page-plus-detail-pages')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+paginated-opening-rows+company-hosted-apply-pages',
  )
  assert.equal(provider.verifiedOn, '2026-08-01')
  assert.match(provider.verifiedSurfaceSummary, /Quality Builder: Web & Cross-Platform/i)
  assert.match(provider.verifiedSurfaceSummary, /Product Owner: Vision & Delivery/i)
  assert.match(provider.verifiedSurfaceSummary, /Infra Builder: Senior DevOps & Cloud/i)
  assert.match(provider.verifiedSurfaceSummary, /AI Builder: Models & Agents/i)
  assert.match(provider.verifiedSurfaceSummary, /cwpage=2/i)
  assert.match(provider.verifiedSurfaceSummary, /job_id=35572/i)
})


test('Codewave helpers preserve native IDs, full authored criteria and typed country without the retired whole-page regex',()=>{
 const started=performance.now(),rows=codewave.extractOpeningCards(current)
 assert.equal(rows.length,14)
 assert.equal(new Set(rows.map(row=>row.jobId)).size,14)
 assert.equal(rows.filter(row=>row.country==='India').length,12)
 assert.deepEqual(rows.filter(row=>row.country!=='India').map(row=>row.country),['Switzerland','United States'])
 assert.ok(rows.every(row=>row.requisitionId===null&&row.jobDescription.length>100))
 assert.ok(rows[0].jobDescription.includes('Peerly is Codewave’s framework'))
 assert.ok(!rows[0].sourceVisibleDescription.includes('Peerly is Codewave’s framework'))
 assert.ok(performance.now()-started<5000,'Current native extraction must finish without the legacy runaway match')
})
test('Codewave factory output limit retains complete native cohort observations and original canonical declaration',async()=>{
 const requested=[]
 const jobs=await codewave.createCodewaveTechnologiesScraper({maxJobs:1}).run({fetchPage:async url=>{requested.push(url);return fetchPage(url)},now:()=> '2026-11-06T10:30:00.000Z'})
 assert.equal(jobs.length,1)
 assert.deepEqual(requested,['https://codewave.com/careers/','https://codewave.com/careers','https://codewave.com/careers'])
 assert.equal(jobs.nativeCollectionEvidence.observedRecordCount,14)
 assert.equal(jobs.nativeCollectionEvidence.nativeIndiaCountryMatches,12)
 assert.equal(jobs.nativeCollectionEvidence.sourceExplicitLimit,1)
 assert.equal(jobs[0].applyUrl,'https://codewave.com/apply')
 assert.equal(jobs[0].sourceApplicationHandoff.activationVerified,false)
})
test('Codewave rejects changed canonical declarations and cannot substitute foreign application destinations',async()=>{
 await assert.rejects(codewave.run({fetchPage:async url=>url===codewave.CAREERS_URL
  ?{status:301,url,headers:{location:'https://unrelated.invalid/careers'},body:null,bodyUnavailable:true}:fetchPage(url)}),/redirect changed/)
 const changed=current.replace('class="job-apply" href="/apply"','class="job-apply" href="https://unrelated.invalid/apply"')
 assert.notEqual(changed,current)
 assert.throws(()=>codewave.extractOpeningCards(changed),/application post binding/)
})
