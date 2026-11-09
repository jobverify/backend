import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run,createAmiScraper,LINKEDIN_COMPANY_PAGE_URL,LINKEDIN_INDIA_JOBS_URL} from '../../scraper/ami/script.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
globalThis.fetch=()=>{throw Error('Offline AMI legacy-contract network tripwire')}
const packets=JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/ami/test-data/native-20261103.json.gz',import.meta.url)))),pages=new Map(packets.map(packet=>[packet.requestedUrl,packet]))
test('AMI factory preserves actual configured filter observations without inventing complete employer inventory',async()=>{
 let audit;const jobs=await createAmiScraper({maxJobs:0}).run({fetchPage:async url=>{assert.ok(pages.has(url));return structuredClone(pages.get(url))},onAudit:value=>{audit=value}})
 assert.equal(jobs.length,0);assert.deepEqual(audit.opening.search.nativeKeywords,['Jobs']);assert.equal(audit.opening.profile.nativeOrganizationUrn,'urn:li:organization:635771');assert.equal(audit.observedCandidates.length,0);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})
test('AMI public run forwards reader options and original cancellation instead of starting a default request',async()=>{
 const requested=[];await run({fetchPage:async url=>{requested.push(url);return structuredClone(pages.get(url))}});assert.deepEqual(requested,[LINKEDIN_COMPANY_PAGE_URL,LINKEDIN_INDIA_JOBS_URL,LINKEDIN_COMPANY_PAGE_URL,LINKEDIN_INDIA_JOBS_URL])
 const caller=new AbortController(),reason=Object.freeze({caller:'legacy-before'});caller.abort(reason);await assert.rejects(run({signal:caller.signal,fetchPage:()=>{throw Error('no read after abort')}}),error=>error===reason)
})
