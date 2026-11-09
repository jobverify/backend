import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs/promises'
import * as livspace from '../../scraper/livspace/script.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
import {enrichJobWithPublicExperience} from '../utils/publicExperienceEnrichment.js'

const capture = JSON.parse(await fs.readFile(new URL('./fixtures/livspace-20261003-inventory.json', import.meta.url), 'utf8'))
const official = '<title>Where passion for design meets technology</title><h2>Let&#8217;s shape the future of home interiors, together</h2><a href="https://careers.livspace.com/livspace/">View open positions</a>'
const shell = '<title>Careers | Livspace</title><base href="/livspace/"><app-root></app-root><script src="main.123abc.js"></script>'
const fetchText = async (url) => url === livspace.CAREERS_URL ? official : shell
const row = (jobCode, location, extra = {}) => ({jobCode,jobTitle:'Public role',jobUrl:'role-'+jobCode,location,locAgg:location,...extra})
const page = (records, total = records.length, hasMore = false) => ({data:{data:records,totalCount:total,hasMoreData:hasMore,facetedSearchConfig:{paginationHowMuch:'9'}}})
const runFixture = (pages, details = async () => {throw new Error('HTTP 403')}, options = {}) => {
  let index = 0
  return livspace.createLivspaceScraper(options).run({fetchText,fetchJson: async (url, request) => {
    if(url === livspace.LISTING_API_URL) return pages[index++]
    assert.equal(url, livspace.DETAIL_API_URL)
    return details(request.json)
  }})
}

test('Livspace retains all 106 published IDs, including 35 countryless Indian locations', async () => {
  const jobs = await runFixture(capture.pages)
  assert.equal(jobs.length, 106)
  assert.equal(new Set(jobs.map(j=>j.jobId)).size, 106)
  assert.equal(jobs.filter(j=>j.jobId==='13079').length, 1)
  assert.equal(jobs.find(j=>j.jobId==='13079').location,'Ahmedabad,Gujarat')
  assert.equal(jobs.find(j=>j.jobId==='14784').location,'Chandigarh')
  assert.ok(jobs.every(j=>j.country==='India' && j.sourceListingComplete===false))
  assert.ok(jobs.every(j=>j.sourceDetailComplete===false && j.sourceDescriptionMissing===true))
})

test('Livspace location inference accepts only exact Indian city/state pairs and explicit India', () => {
  for(const location of ['Ahmedabad,Gujarat','Hyderabad,Telangana','Surat,Gujarat','Chennai,Tamil Nadu','Bangalore,Karnataka','Mumbai,Maharashtra','Gurgaon,Haryana','Pune,Maharashtra','Noida,Uttar Pradesh','Patna,Bihar','Bhopal,Madhya Pradesh','Chandigarh','Remote, India']) {
    assert.equal(livspace.isIndiaJob(row(1,location)),true,location)
  }
  for(const location of ['Remote','None','Bangalore','Paris','constructor','Ahmedabad,Texas','near Bangalore,Karnataka','Bangalore,Karnataka,United States','Indianapolis,Indiana','India office applicants worldwide']) {
    assert.equal(livspace.isIndiaJob(row(1,location)),false,location)
  }
  assert.equal(livspace.isIndiaJob(row(1,'Bangalore,Karnataka',{country:'United States'})),false)
  assert.equal(livspace.isIndiaJob(row(1,'Bangalore,Karnataka,India',{jobLocationRecord:[{country:'Singapore'}]})),false)
})

test('Livspace resolves unknown scope using matching public detail country before filtering', async () => {
  const jobs = await runFixture([page([row(1,'Remote')])], async () => ({companyId:15919,jobCode:1,jobUrl:'role-1',jobTitle:'Public role',location:'Remote',country:'India',longDescription:'Verified employer description'}))
  assert.equal(jobs.length,1)
  assert.equal(jobs[0].country,'India')
  assert.equal(jobs[0].sourceListingComplete,true)
})

test('Livspace preserves coverage gaps for unresolved scope instead of claiming a complete subset', async () => {
  const jobs = await runFixture([page([row(1,'Pune,Maharashtra'),row(2,'Remote')])])
  assert.equal(jobs.length,1)
  assert.equal(jobs[0].sourceListingComplete,false)
  assert.deepEqual(jobs[0].sourceLocationScopeUnresolvedIds,['2'])
  await assert.rejects(runFixture([page([row(2,'Remote')])]),/unresolved|scope/i)
})

test('Livspace validates total unique inventory before country filtering', async () => {
  await assert.rejects(runFixture([page([row(1,'Pune,Maharashtra')],2)]),/incomplete|total/i)
  await assert.rejects(runFixture([page([row(1,'Pune,Maharashtra')],2,true),page([row(1,'Pune,Maharashtra')],2)]),/duplicate|repeat/i)
  await assert.rejects(runFixture([page([],1)]),/incomplete|empty|total/i)
  await assert.rejects(runFixture([page([{jobCode:1,location:'Singapore',country:'Singapore'}])]),/identity|invalid|record/i)
})

test('Livspace does not apply mismatched or foreign public detail data to an India listing', async () => {
  await assert.rejects(runFixture([page([row(1,'Pune,Maharashtra')])],async()=>({companyId:99999,jobCode:1,jobUrl:'role-1',location:'Pune,Maharashtra'})),/identity|company/i)
  await assert.rejects(runFixture([page([row(1,'Pune,Maharashtra')])],async()=>({companyId:15919,jobCode:2,jobUrl:'role-2',location:'Pune,Maharashtra'})),/identity|job/i)
  await assert.rejects(runFixture([page([row(1,'Pune,Maharashtra')])],async()=>({companyId:15919,jobCode:1,jobUrl:'role-1',country:'Singapore',location:'Singapore'})),/conflict|scope|country/i)
})

test('Livspace rejects a wrong published tenant before India filtering and detail fallback', async () => {
  await assert.rejects(runFixture([page([row(1,'Pune,Maharashtra',{companyId:99999})])]),error=>error.softFailure===true && error.abortRetries===true && error.failureKind==='surface_drift')
})

test('Livspace rejects conflicting country tokens throughout an otherwise Indian location label', async () => {
  for(const location of ['London, United Kingdom, India','Bangalore, Singapore, India','Mumbai, India, United States']) {
    assert.equal(livspace.isIndiaJob(row(1,location)),false,location)
  }
  await assert.rejects(runFixture([page([row(1,'London, United Kingdom, India')])]),error=>error.softFailure===true && error.abortRetries===true && error.failureKind==='incomplete_location_scope')
})

test('Livspace attaches full inventory authority separately from scoped empty and coverage-gap outcomes', async () => {
  const complete = await runFixture(capture.pages)
  assert.equal(readInventoryEvidence(complete)?.status,'coverage-gap')
  assert.equal(readInventoryEvidence(complete)?.reportedTotal,106)
  assert.equal(readInventoryEvidence(complete)?.pagesFetched,12)
  const gap = await runFixture([page([row(1,'Pune,Maharashtra'),row(2,'Remote')])])
  assert.equal(readInventoryEvidence(gap)?.status,'coverage-gap')
  assert.equal(readInventoryEvidence(gap)?.listingComplete,false)
  const foreignOnly = await runFixture([page([row(3,'Singapore',{country:'Singapore'})])])
  assert.equal(foreignOnly.length,0)
  assert.equal(readInventoryEvidence(foreignOnly)?.status,'complete-inventory')
  assert.equal(readInventoryEvidence(foreignOnly)?.reportedTotal,1)
  const empty = await runFixture([page([])])
  assert.equal(readInventoryEvidence(empty)?.status,'verified-empty')
  assert.equal(readInventoryEvidence(empty)?.reportedTotal,0)
})

test('Livspace recognizes foreign country names beyond the previous small label set', () => {
  for(const location of ['Tokyo, Japan, India','Amsterdam, Netherlands, India','Kuala Lumpur, Malaysia, India','Hong Kong, India']) {
    assert.equal(livspace.isIndiaJob(row(1,location)),false,location)
    assert.equal(livspace.isIndiaJob(row(1,location,{country:'India'})),false,location+' structured conflict')
  }
})

test('Livspace does not certify an empty inventory from coercible nonnumeric totals', async () => {
  for(const totalCount of ['',false,true,[],{},'0.0']) {
    await assert.rejects(runFixture([{data:{data:[],totalCount,hasMoreData:false,facetedSearchConfig:{paginationHowMuch:'9'}}}]),error=>error.softFailure===true && error.abortRetries===true && error.failureKind==='surface_drift')
  }
})

test('Livspace preserves a short complete native detail description through shared enrichment', async () => {
  const description = 'As a Sales Lead, own the sales funnel and achieve monthly revenue targets for your assigned Experience Centre.'
  const jobs = await runFixture([page([row(1,'Pune,Maharashtra')])],async()=>({companyId:15919,jobCode:1,jobUrl:'role-1',jobTitle:'Sales Lead',location:'Pune,Maharashtra',longDescription:description}))
  let requests = 0
  const enriched = await enrichJobWithPublicExperience({...jobs[0],description:jobs[0].jobDescription},{fetchText:async()=>{requests++;return '<title>Sales Lead | Livspace</title><h1>Sales Lead</h1><p>'+description+'</p>'}})
  assert.equal(requests,0,'already verified complete native detail should not refresh its description')
  assert.equal(enriched.jobDescription,description)
  assert.equal(jobs[0].publicExperienceChecked,true)
  const fallback = await runFixture([page([row(2,'Pune,Maharashtra',{shortDescription:description})])])
  assert.notEqual(fallback[0].publicExperienceChecked,true,'blocked detail fallback is not native detail verification')
})

test('Livspace treats punctuation-only native descriptions as missing employer text', async () => {
  for(const nativeText of ['<p>..</p>','<p>.</p>','&nbsp; --','12345']) {
    const jobs = await runFixture([page([row(1,'Pune,Maharashtra')])],async()=>({companyId:15919,jobCode:1,jobUrl:'role-1',jobTitle:'Public role',location:'Pune,Maharashtra',jobConfigurationData:{'Job Description':nativeText},longDescription:nativeText,shortDescription:nativeText}))
    assert.equal(jobs[0].jobDescription,null)
    assert.equal(jobs[0].sourceDescriptionMissing,true)
    assert.equal(jobs[0].sourceDetailComplete,false)
  }
})

test('Livspace requires the published boolean pagination marker before empty authority', async () => {
  for(const hasMoreData of [undefined,null,'false',0,{}]) {
    await assert.rejects(runFixture([{data:{data:[],totalCount:0,hasMoreData,facetedSearchConfig:{paginationHowMuch:'9'}}}]),error=>error.softFailure===true && error.abortRetries===true && error.failureKind==='surface_drift')
  }
})

test('Livspace does not replace an explicit absent native JD with its listing title or summary', async () => {
  for(const nativeText of ['<p>.</p>','<p>..</p>','NA','N/A']) {
    const jobs = await runFixture([page([row(1,'Pune,Maharashtra',{shortDescription:'Public role'})])],async()=>({companyId:15919,jobCode:1,jobUrl:'role-1',jobTitle:'Public role',location:'Pune,Maharashtra',jobConfigurationData:{'Job Description':nativeText},longDescription:nativeText,shortDescription:nativeText,yrsOfExperience:'2 to 4 years'}))
    assert.equal(jobs[0].jobDescription,null,nativeText)
    assert.equal(jobs[0].sourceDescriptionMissing,true)
    assert.equal(jobs[0].publicExperienceChecked,true,'matching native experience and JD fields were inspected')
    const enriched = await enrichJobWithPublicExperience({...jobs[0],description:jobs[0].jobDescription},{fetchText:async()=>shell})
    assert.equal(enriched.jobDescription,null,'generic board shell must not recreate absent employer JD')
  }
  const summary = await runFixture([page([row(1,'Pune,Maharashtra',{shortDescription:'Listing-only short preview.'})])],async()=>({companyId:15919,jobCode:1,jobUrl:'role-1',jobTitle:'Public role',location:'Pune,Maharashtra',longDescription:'NA',shortDescription:'NA'}))
  assert.equal(summary[0].jobDescription,null,'explicit absent full JD prevails over listing-only preview')
})

test('Livspace treats unrecognized structured country values as unresolved scope', async () => {
  for(const country of ['Worldwide','Remote','Unknown Region','Unspecified']) {
    const jobs = await runFixture([page([row(1,'Pune,Maharashtra'),row(2,'Remote',{country})])])
    assert.equal(jobs.length,1)
    assert.equal(jobs[0].sourceListingComplete,false,country)
    assert.deepEqual(jobs[0].sourceLocationScopeUnresolvedIds,['2'])
    await assert.rejects(runFixture([page([row(2,'Remote',{country})])]),/unresolved|scope/i)
  }
  assert.equal(livspace.classifyJobCountry(row(3,'Remote',{country:'US'})),'foreign')
  assert.equal(livspace.classifyJobCountry(row(3,'Remote',{country:'FR'})),'foreign')
})
