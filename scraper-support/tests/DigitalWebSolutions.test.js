import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import fs from 'node:fs'
import {fileURLToPath} from 'node:url'
import {gunzipSync} from 'node:zlib'
import {generateCompanyCoverageReport} from '../providers/companyCoverage.js'
import {hydrateProviderCatalogEntry} from '../providers/index.js'
import catalog from '../../scraper/digitalwebsolutions/catalog.js'
import {run,createDigitalWebSolutionsScraper} from '../../scraper/digitalwebsolutions/script.js'

const modulePath=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../scraper/digitalwebsolutions/script.js')
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../test/test-data/recruitmentGoal20261104/digitalweb-native-quality.json.gz',import.meta.url))))

test('Digital Web Solutions local catalog retains its Global scope and current exact corporate/native account',()=>{
 const p=hydrateProviderCatalogEntry(catalog)
 assert.equal(p.source,'digitalwebsolutions');assert.equal(p.companyName,'Digital Web Solutions')
 assert.equal(p.officialBrandName,'Digital Web Solutions');assert.equal(p.adapter,'script')
 assert.equal(p.companyCareerPage,'https://www.digitalwebsolutions.com/careers/')
 assert.equal(p.officialJobsBoardUrl,'https://hirenext.io/co/digital-web-solutions/')
 assert.equal(p.companyDomain,'digitalwebsolutions.com');assert.equal(p.atsPlatform,'hirenext')
 assert.equal(p.countryFilter,'Global');assert.equal(p.verifiedOn,'2026-11-05')
 assert.equal(p.verifiedPublicJobCount,5);assert.equal(p.verifiedIndiaJobCount,1)
 assert.equal(p.modulePath,modulePath)
 assert.match(p.verifiedSurfaceSummary,/four roles retain unknown countries/i)
})
test('Digital Web Solutions exact backlog row resolves from the local catalog',()=>{
 const report=generateCompanyCoverageReport({csvText:'Digital Web Solutions\n',catalog:[hydrateProviderCatalogEntry(catalog)]})
 assert.equal(report.matchedCount,1);assert.equal(report.unmatchedCount,0)
})
test('Digital Web Solutions configured factory retains all original global roles and full current criteria',async()=>{
 const seen=new Map(),calls=[]
 const jobs=await createDigitalWebSolutionsScraper({now:()=>fixture.completedAt}).run({requestIntervalMs:0,fetchImpl:async url=>{
  const packets=fixture.requests.filter(p=>p.requestedURL===url),n=seen.get(url)||0;seen.set(url,n+1)
  assert.ok(packets[n],'Uncaptured native public read '+url);const p=packets[n];calls.push(url)
  const r=new Response(p.text,{status:p.status,headers:p.headers});Object.defineProperty(r,'url',{value:p.finalURL});return r
 }})
 assert.deepEqual(jobs.map(j=>j.jobId),['524','512','511','507','498'])
 assert.deepEqual(jobs.map(j=>j.country),[null,null,null,'India',null])
 assert.equal(calls.length,16);assert.ok(jobs.every(j=>j.sourceClosingQualified&&j.sourceDetailComplete))
 assert.match(jobs.find(j=>j.jobId==='512').jobDescription,/from an idea through execution and results\./)
 assert.equal(jobs.find(j=>j.jobId==='507').experienceRequired,'72 months')
 assert.ok(jobs.every(j=>j.requisitionId===null&&j.legalEmployer===null&&j.postingDate===null))
})
test('Digital Web Solutions rejects a missing current corporate hiring handoff',async()=>{
 await assert.rejects(run({requestIntervalMs:0,fetchText:async()=>'<title>Careers - Digital Web Solutions</title><p>No native hiring link</p>'}),/verified first-party careers page/i)
})
