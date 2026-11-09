import fs from 'node:fs'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DTICI_PARENT_ORGANIZATION_ID,
  SEARCH_API_URL,
  buildSearchRequest,
  createDaimlerTruckInnovationCenterIndiaScraper,
  normalizeJob,
} from './script.js'

test('builds the official Daimler Truck search request for the DTICI organization', () => {
  const request = buildSearchRequest()

  assert.equal(SEARCH_API_URL, 'https://global-jobboard-api-jobsearch.daimlertruck.com/search/')
  assert.equal(request.LanguageCode, 'EN')
  assert.deepEqual(request.SearchParameters, {
    FirstItem: 1,
    CountItem: 100,
    Sort: [{ Criterion: 'PublicationStartDate', Direction: 'DESC' }],
    MatchedObjectDescriptor: [
      'PositionTitle',
      'PositionURI',
      'PositionLocation',
      'PositionLocation.CountryCode',
      'PositionLocation.CountryName',
      'PositionLocation.CityName',
      'PositionFormattedDescription',
      'PositionID',
      'PublicationStartDate',
      'PositionSchedule',
      'ParentOrganization',
    ],
  })
  assert.deepEqual(request.SearchCriteria, [{
    CriterionName: 'ParentOrganization',
    CriterionValue: [DTICI_PARENT_ORGANIZATION_ID, '4068'],
  }])
})

test('normalizes a DTICI listing and rejects listings from other organizations', () => {
  const entry = {
    MatchedObjectId: '421999',
    MatchedObjectDescriptor: {
      ID: '421999',
      PositionID: 'J000421999',
      PositionTitle: 'Senior Software Engineer',
      PositionURI: 'https://jobsearch.daimlertruck.com//index.php?ac=jobad&id=421999',
      ParentOrganization: DTICI_PARENT_ORGANIZATION_ID,
      ParentOrganizationName: 'Bengaluru, Daimler Truck Innovation Center India Private Limited',
      PositionLocation: [{ CityName: 'Bengaluru', CountryName: 'Indien', CountryCode: 'IN' }],
      PositionFormattedDescription: '<p>Build connected vehicle software.</p>',
      PublicationStartDate: '2026-07-01',
      PositionSchedule: [{ Name: 'Vollzeit' }],
    },
  }

  const job = normalizeJob(entry, '2026-07-07T00:00:00.000Z')

  assert.deepEqual(job, {
    title: 'Senior Software Engineer',
    company: 'Daimler Truck Innovation Center India (DTICI)',
    department: null,
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: 'J000421999',
    requisitionId: 'J000421999',
    sourceUrl: 'https://dtici.daimlertruck.com/career/',
    applyUrl: 'https://jobsearch.daimlertruck.com//index.php?ac=jobad&id=421999',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-01',
    closingDate: null,
    jobDescription: 'Build connected vehicle software.',
    attachmentUrl: null,
    source: 'daimlertruckinnovationcenterindia',
    link: 'https://jobsearch.daimlertruck.com//index.php?ac=jobad&id=421999',
    scrapedAt: '2026-07-07T00:00:00.000Z',
  })

  assert.equal(normalizeJob({
    MatchedObjectDescriptor: {
      ParentOrganization: '1249',
      PositionTitle: 'Other Company Job',
    },
  }, '2026-07-07T00:00:00.000Z'), null)
})

const lookup=JSON.parse(fs.readFileSync(new URL('./fixtures/current-parent-organizations.json',import.meta.url),'utf8'))
const currentSearch=JSON.parse(fs.readFileSync(new URL('./fixtures/current-search.json',import.meta.url),'utf8'))
const detail=fs.readFileSync(new URL('./fixtures/current-job-detail.html',import.meta.url),'utf8')
const zero={SearchResult:{SearchResultCount:0,SearchResultCountAll:0,SearchResultItems:[],UserArea:{ExecutionError:0}}}
const fetchLookupOrSearch=payload=>async url=>url.includes('/lookup/')?lookup:payload

test('scraper uses the published GET data query and records only schema-verified empty DTICI inventory',async()=>{
 let request
 const jobs=await createDaimlerTruckInnovationCenterIndiaScraper({fetchJson:async(url,options)=>{if(url.includes('/lookup/'))return lookup;request={url,options};return zero}}).run()
 assert.deepEqual(jobs,[])
 assert.equal(request.options.method,'GET')
 assert.equal(request.options.body,undefined)
 assert.equal(new URL(request.url).origin,new URL(SEARCH_API_URL).origin)
 assert.deepEqual(JSON.parse(new URL(request.url).searchParams.get('data')),buildSearchRequest())
 assert.equal(readInventoryEvidence(jobs)?.status,'verified-empty')
})

test('current company organization is included and official detail preserves India identity and description',async()=>{
 let detailCalls=0
 const jobs=await createDaimlerTruckInnovationCenterIndiaScraper({fetchJson:fetchLookupOrSearch(currentSearch),fetchText:async url=>{detailCalls++;assert.equal(new URL(url).searchParams.get('id'),'413231');return detail}}).run()
 assert.equal(jobs.length,1);assert.equal(detailCalls,1)
 assert.equal(jobs[0].jobId,'5405');assert.equal(jobs[0].country,'India');assert.equal(jobs[0].city,'Bangalore')
 assert.match(jobs[0].jobDescription,/Snowflake performance/);assert.match(jobs[0].jobDescription,/4-5 years of experience/)
 assert.equal(jobs[0].closingDate,'2030-12-31')
 assert.equal(readInventoryEvidence(jobs)?.reportedTotal,1)
})

test('scraper rejects malformed, execution-error, foreign-employer and contradictory inventory',async()=>{
 for(const payload of [{},{...zero,SearchResult:{...zero.SearchResult,UserArea:{ExecutionError:1}}},{...zero,SearchResult:{...zero.SearchResult,SearchResultCountAll:1}}]){
  await assert.rejects(createDaimlerTruckInnovationCenterIndiaScraper({fetchJson:fetchLookupOrSearch(payload)}).run(),/inventory|payload|incomplete|error/i)
 }
 await assert.rejects(createDaimlerTruckInnovationCenterIndiaScraper({fetchJson:fetchLookupOrSearch(currentSearch),fetchText:async()=>detail.replaceAll('Daimler Truck Innovation Center India Private Limited','Different Company')}).run(),/identity|employer/i)
 const foreign=structuredClone(currentSearch);foreign.SearchResult.SearchResultItems[0].MatchedObjectDescriptor.PositionURI='https://example.com/index.php?ac=jobad&id=413231'
 await assert.rejects(createDaimlerTruckInnovationCenterIndiaScraper({fetchJson:fetchLookupOrSearch(foreign),fetchText:async()=>detail}).run(),/trusted|identity|URL/i)
})

test('scraper completes native pagination and rejects repeated records before declaring inventory complete',async()=>{
 const record=i=>({MatchedObjectId:String(1000+i),MatchedObjectDescriptor:{ParentOrganization:'4068',PositionID:'DT-'+i,PositionTitle:'Engineer '+i,PositionURI:'https://jobsearch.daimlertruck.com/index.php?ac=jobad&id='+(1000+i),PositionLocation:[{CityName:'Bangalore',CountryCode:'IN'}],PositionFormattedDescription:'Build connected vehicle software.'}})
 const pages=[]
 const fetchJson=async url=>{if(url.includes('/lookup/'))return lookup;let request=JSON.parse(new URL(url).searchParams.get('data'));pages.push(request.SearchParameters.FirstItem);let items=request.SearchParameters.FirstItem===1?Array.from({length:100},(_,i)=>record(i)):[record(100)];return {SearchResult:{SearchResultCount:items.length,SearchResultCountAll:101,SearchResultItems:items,UserArea:{ExecutionError:0}}}}
 const jobs=await createDaimlerTruckInnovationCenterIndiaScraper({fetchJson}).run()
 assert.equal(jobs.length,101);assert.deepEqual(pages,[1,101]);assert.equal(readInventoryEvidence(jobs)?.listingComplete,true)
 await assert.rejects(createDaimlerTruckInnovationCenterIndiaScraper({fetchJson:async url=>{if(url.includes('/lookup/'))return lookup;return {SearchResult:{SearchResultCount:1,SearchResultCountAll:101,SearchResultItems:[record(0)],UserArea:{ExecutionError:0}}}}}).run(),/duplicate|repeat|incomplete/i)
})
