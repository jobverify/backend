import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createAgentDnaScraper,CAREERS_URL} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const original=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-public-20261103.json.gz',import.meta.url))))[0]
test('AgentDNA actual configured503 is an explicit source failure with no homepage/guessed-route fallback',async()=>{
 const calls=[];await assert.rejects(createAgentDnaScraper().run({fetchPage:async url=>{calls.push(url);return{url,status:original.status,headers:original.headers,html:original.body}}}),error=>error.status===503&&error.softFailure&&error.inventoryEvidence.reportedTotal===null)
 assert.deepEqual(calls,[CAREERS_URL])
})
test('a branded public shell is a closing-reconciled observation, never a verified native vacancy zero',async()=>{
 const html='<title>AgentDNA - Build Smarter AI Agents</title><h1>Build AI agents from composable genes</h1><p>The modular gene system for AI agents</p>'
 const calls=[];let audit
 const jobs=await createAgentDnaScraper().run({fetchPage:async url=>{calls.push(url);return{url,status:200,html}},onAudit:value=>{audit=value}})
 assert.deepEqual(calls,[CAREERS_URL,CAREERS_URL]);assert.equal(jobs.length,0)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 assert.equal(audit.observedVacancyCount,0);assert.equal(audit.lifecycleCleanupAllowed,false)
})
test('public vacancy markup never disappears into the AgentDNA branded-shell observation',async()=>{
 await assert.rejects(createAgentDnaScraper().run({fetchPage:async url=>({url,status:200,html:'<title>AgentDNA</title><h1>Open roles</h1><a href="/jobs/123">Apply now</a>'})}),/public.*job|vacancy/i)
})
