import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run,CAREERS_PAGE_URL,JOIN_US_PAGE_URL,VERIFIED_ON} from '../../scraper/anandgroup/script.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
globalThis.fetch=()=>{throw Error('Offline ANAND legacy-contract network tripwire')}
const pages=new Map(JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/anandgroup/test-data/native-20261103.json.gz',import.meta.url)))).map(row=>[row.url,row]))
test('Anand Group current public constants clear the historical no-vacancy certification',()=>{
 assert.equal(CAREERS_PAGE_URL,'https://www.anandgroupindia.com/careers-at-anand/');assert.equal(JOIN_US_PAGE_URL,'https://www.anandgroupindia.com/careers-at-anand/join-usnew/');assert.equal(VERIFIED_ON,null)
})
test('Anand Group registered run checks only the declared public hiring entry and keeps native totals unknown',async()=>{
 const calls=[];let audit;const jobs=await run({fetchPage:async url=>{calls.push(url);assert.ok(pages.has(url));return structuredClone(pages.get(url))},onAudit:value=>{audit=value}})
 assert.deepEqual(calls,[CAREERS_PAGE_URL,JOIN_US_PAGE_URL,CAREERS_PAGE_URL,JOIN_US_PAGE_URL]);assert.equal(audit.source,'anandgroup');assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.inventoryDelegationComplete,false);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('Anand Group changed publisher or first denial cannot become a successful verified empty',async()=>{
 await assert.rejects(run({fetchPage:async url=>{const page=structuredClone(pages.get(url));page.html=page.html.replace('Career at ANAND - ANAND Group','Unrelated publisher');return page}}),error=>error.code==='ANAND_PUBLIC_ENTRY_CHANGED')
 let reads=0;await assert.rejects(run({fetchPage:async url=>{reads++;return{url,status:429,html:'Denied'}}}),error=>error.status===429&&error.abortRetries&&!error.abortPipeline);assert.equal(reads,1)
})
