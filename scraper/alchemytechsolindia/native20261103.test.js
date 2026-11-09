import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const{captures}=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-20261103.json.gz',import.meta.url))))
const body=key=>Buffer.from(captures[key].body,'base64').toString(),html=body('production-careers'),empty=()=>JSON.parse(body('production-listing'))
test('actual unfiltered Job Manager zero is reconciled on both sides and qualifies only the declared board',async()=>{
 let audit,reads=0,posts=0
 const jobs=await run({fetchText:async()=>{reads++;return html},fetchJson:async(_url,options)=>{posts++;const p=new URLSearchParams(options.body);assert.deepEqual(p.getAll('filter_job_type[]'),['freelance','full-time','internship','part-time','temporary','']);assert.equal(p.get('search_keywords'),'');assert.equal(p.get('search_location'),'');assert.equal(p.get('remote_position'),'');assert.equal(p.get('per_page'),'10');return empty()},onAudit:value=>{audit=value}})
 assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs)?.status,'verified-empty');assert.equal(reads,2);assert.equal(posts,2);assert.equal(audit.closingInventoryMatches,true);assert.equal(audit.sourceCompanyWideScopeComplete,false)
})
test('a native selected filter cannot turn a restricted zero into complete board absence',async()=>{
 await assert.rejects(run({fetchText:async()=>html.replace('name="search_location" id="search_location"','name="search_location" value="Pune" id="search_location"'),fetchJson:async()=>empty()}),/filter|native|contract/i)
})
test('unchecked native job types cannot qualify an unfiltered zero',async()=>{
 const restricted=html.replace(/(value="freelance")\s+checked='checked'/,'$1');assert.notEqual(restricted,html)
 await assert.rejects(run({fetchText:async()=>restricted,fetchJson:async()=>empty()}),/filter|native|contract/i)
})
test('unknown and contradictory empty payloads remain errors instead of verified emptiness',async()=>{
 for(const payload of [{},{...empty(),html:''},{...empty(),max_num_pages:1},{...empty(),html:empty().html+'<li class="job_listing"><h3>Engineer</h3></li>'}])await assert.rejects(run({fetchText:async()=>html,fetchJson:async()=>payload}),/dynamic listings feed/i)
})
test('changed closing native listing membership withholds empty qualification',async()=>{
 let posts=0;const jobs=await run({fetchText:async()=>html,fetchJson:async()=>++posts===1?empty():{found_jobs:true,max_num_pages:1,html:'<li class="job_listing"><a href="https://alchemytechsol.com/job/engineer/"><h3>Engineer</h3></a></li>'}})
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.notEqual(readInventoryEvidence(jobs).status,'verified-empty')
})
test('a future positive listing cannot publish city guesses, synthetic requisition IDs or a missing full JD',async()=>{
 const jobs=await run({fetchText:async()=>html,fetchJson:async()=>({found_jobs:true,max_num_pages:1,html:'<li class="post-501 job_listing"><a href="https://alchemytechsol.com/job/engineer/"><h3>Engineer</h3><div class="location">Chennai</div></a></li>'})})
 assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('caller abort and bounded audit/read work are honored',async()=>{
 await assert.rejects(run({fetchText:()=>new Promise(()=>{}),timeoutMs:25}),/abort|timeout/i)
 await assert.rejects(run({fetchText:async()=>html,fetchJson:async()=>empty(),onAudit:()=>new Promise(()=>{}),timeoutMs:25}),/abort|timeout/i)
 await assert.rejects(run({fetchText:async()=>html,signal:AbortSignal.abort(Error('caller stopped'))}),/caller stopped/)
})
