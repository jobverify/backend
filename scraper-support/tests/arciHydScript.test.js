import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run,createArciHydScraper,CAREERS_PAGE_URL,VACANCIES_PAGE_URL} from '../../scraper/arcihyd/script.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
const packets=JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/arcihyd/test-data/native-20261103.json.gz',import.meta.url))))
globalThis.fetch=()=>{throw Error('offline ARCI network tripwire')}
test('ARCI public current advertisement runtime exposes its seven native role types and qualified office subset',async()=>{
 const pages=new Map(packets.flatMap(row=>[[row.requestedUrl,row],[row.url,row]]));let audit
 const jobs=await createArciHydScraper({maxJobs:0}).run({fetchPage:async url=>structuredClone(pages.get(url)),onAudit:value=>{audit=value}})
 assert.equal(CAREERS_PAGE_URL,'https://arci.res.in/offerings/careers')
 assert.equal(VACANCIES_PAGE_URL,'https://arci.res.in/careers/vacancies')
 assert.equal(audit.candidatePostTypes,7)
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].sourceNativePostCode,'AA001')
 assert.equal(jobs[0].sourceNativeIndiaPositions,6)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('ARCI legacy empty Drupal shell cannot qualify an empty current advertisement inventory',async()=>{
 let calls=0
 await assert.rejects(run({fetchPage:async url=>{calls++;return{status:200,url,html:'<html><title>Careers | International Advanced Research Centre</title><a href="/careers/vacancies">Vacancies</a><a href="/organization/locations-hyderabad">Offices</a></html>'}}}),/current vacancies publisher|advertisement inventory/)
 assert.equal(calls,2)
})
test('ARCI injected transport denial preserves the failure and never starts a browser fallback',async()=>{
 let browser=0;const reason=Object.assign(Error('source timeout'),{code:'SOURCE_TIMEOUT'})
 await assert.rejects(run({fetchText:async()=>{throw reason},fetchBrowserText:()=>{browser++;return''}}),error=>error===reason)
 assert.equal(browser,0)
})
