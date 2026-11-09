import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {run,createCapsitechScraper} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const{captures}=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-20261103.json.gz',import.meta.url))))
const body=key=>Buffer.from(captures[key].body,'base64').toString(),html=body('production-careers'),payload=()=>JSON.parse(body('production-listing'))
test('actual public application categories remain an explicit criteria and inventory gap, without an application CAPTCHA gate',async()=>{
 let audit;const jobs=await createCapsitechScraper().run({fetchText:async()=>html,fetchJson:async()=>payload(),onAudit:value=>{audit=value}})
 assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs)?.status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 assert.equal(audit.observedListingCount,null);assert.ok(audit.observedApplicationCategoryCount>20);assert.equal(audit.fullRoleCriteriaPublished,false);assert.equal(audit.applicationCaptchaRequiredForPublicExtraction,false)
})
test('wrong or missing current official page is an error rather than a successful zero',async()=>{
 await assert.rejects(createCapsitechScraper().run({fetchText:async()=>'<title>Capsitech</title><p>Not a careers page</p>',fetchJson:async()=>payload()}),/Capsitech.*identity|Capsitech.*careers/i)
})
test('new public criteria in the options model must not be silently discarded as categories',async()=>{
 const p=payload();p.result.domainsList[0].domains[0].jobDescription='A newly published actual native role description.'
 await assert.rejects(createCapsitechScraper().run({fetchText:async()=>html,fetchJson:async()=>p}),/criteria|contract|categories/i)
})
test('injected readonly transport and caller cancellation are forwarded through production run',async()=>{
 let calls=0;await run({fetchText:async()=>{calls++;return html},fetchJson:async()=>payload()});assert.ok(calls>=1)
 await assert.rejects(run({fetchText:async()=>html,signal:AbortSignal.abort(Error('caller stopped'))}),/caller stopped/)
})
test('read and observer cannot hold source execution indefinitely',async()=>{
 await assert.rejects(run({fetchText:()=>new Promise(()=>{}),timeoutMs:25}),/abort|timeout/i)
 await assert.rejects(run({fetchText:async()=>html,fetchJson:async()=>payload(),onAudit:()=>new Promise(()=>{}),timeoutMs:25}),/abort|timeout/i)
})
