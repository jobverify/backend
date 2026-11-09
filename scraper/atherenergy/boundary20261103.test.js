import test from 'node:test'
import assert from 'node:assert/strict'
import {createAtherEnergyScraper} from './script.js'
test('unqualified empty-filter copy cannot produce a successful native empty inventory',async()=>{
 await assert.rejects(createAtherEnergyScraper().run({fetchPage:async url=>({url,status:200,html:url.endsWith('/jobs')?'<title>All Jobs | Careers at Ather</title><h1>All jobs</h1><p>No open jobs in this team / location right now</p>':'<title>Be the Story | Join Ather</title><a href="/jobs">Jobs</a>'})}),error=>error.failureKind==='source_inventory_unavailable'&&error.abortRetries===true&&error.inventoryEvidence.reportedTotal===null)
})
test('Ather supplied ignored reader is bounded by caller cancellation',{timeout:500},async()=>{
 const controller=new AbortController(),reason={caller:true};const pending=createAtherEnergyScraper().run({signal:controller.signal,fetchPage:()=>new Promise(()=>{})});setTimeout(()=>controller.abort(reason),5);await assert.rejects(pending,error=>error===reason)
})
test('Ather retains Retry-After from the supplied native429page',async()=>{
 await assert.rejects(createAtherEnergyScraper().run({fetchPage:async url=>({url,status:429,headers:{'retry-after':'60'},html:'Rate limited'})}),error=>error.status===429&&error.retryDelayMs===60000&&error.abortRetries===true)
})
