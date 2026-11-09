import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {createBrihaspathiScraper,extractJobsFromPayload,hasOfficialCareersSignal,hasZeroVacanciesSignal,CAREERS_URL,JOBS_API_URL} from '../../scraper/brihaspathi/script.js'
import {CLIENT_URL} from '../../scraper/brihaspathi/native.js'
import {createCatalogScraper,getScraperCatalog} from '../providers/index.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
const fixture=name=>readFileSync(new URL('../../scraper/brihaspathi/fixtures/'+name,import.meta.url),'utf8')
const inputs=new Map([[CAREERS_URL,fixture('careers.html')],[CLIENT_URL,fixture('careers-client.js')],[JOBS_API_URL,fixture('jobs.json')]])
const fetchPage=async url=>({status:200,url:url===CAREERS_URL?'https://brihaspathi.com/careers':url,headers:new Headers(),text:async()=>inputs.get(url)})
test('native parser does not promote Hyderabad or a CMS date into India job evidence',()=>{
 assert.deepEqual(extractJobsFromPayload(JSON.parse(fixture('jobs.json'))),[])
 assert.equal(hasOfficialCareersSignal(fixture('careers.html'),fixture('careers-client.js')),true)
 assert.equal(hasZeroVacanciesSignal('Vacancies 0'),false)
})
test('registered factory retains the native unknown-country candidate and partial inventory',async()=>{
 const provider=getScraperCatalog().find(p=>p.source==='brihaspathi')
 let native
 const jobs=await createCatalogScraper(provider).run({fetchPage,requestIntervalMs:0,onNativeEvidence:value=>{native=value}})
 assert.equal(jobs.length,0)
 assert.equal(native.records[0].jobId,'33')
 assert.equal(native.records[0].sourceDetailComplete,false)
 assert.equal(native.unknownCountryRecords,1)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
})
test('source factory merges defaults with caller options without persistence',async()=>{
 const jobs=await createBrihaspathiScraper({fetchPage,requestIntervalMs:0}).run({maxJobs:0})
 assert.equal(jobs.length,0)
 assert.equal(jobs.nativeInventoryEvidence.receipts.length,6)
})
