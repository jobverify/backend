import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run} from './script.js'
import * as contract from './publicationsContract20261121.js'
import {HOME,CAREER,CLIENT} from './nativeTransport20261121.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const current=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/contact-openings-20261125.json.gz',import.meta.url))))
const historical=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/contact-originals-20261121.json.gz',import.meta.url))))
const profile=JSON.parse(fs.readFileSync(new URL('./reviewedPublications20261121.json',import.meta.url)))
const text=p=>Buffer.from(p.bodyBase64,'base64').toString(),hash=v=>createHash('sha256').update(v).digest('hex')
const pages=new Map(current.responses.map(p=>{assert.equal(hash(Buffer.from(p.bodyBase64,'base64')),p.bodySHA256);return[p.requestedURL,p]}))
// These tests isolate changed contact representations in the actual current
// documents. The separate UI interpreter receives a historical reviewed client;
// this fixture deliberately makes no fresh current-client acquisition claim.
pages.set(CLIENT,historical.responses.find(p=>p.requestedURL===CLIENT))
assert.equal(current.currentClientAcquired,false)
const career=text(pages.get(CAREER)),cipher=career.match(/data-cfemail="([a-f0-9]{44})"/)[1]
const recode=value=>{const bytes=Buffer.from(value,'hex'),next=bytes[0]^0x7f;return Buffer.from([next,...bytes.subarray(1).map(byte=>byte^bytes[0]^next)]).toString('hex')}
const rotated=recode(cipher)
function replay(edit=(body)=>body){const calls=[],seen=new Map();return{calls,fetchImpl:async(url,init)=>{
 const packet=pages.get(url);assert.ok(packet,'Only the exact two native documents and historical UI interpreter input: '+url)
 const count=(seen.get(url)??0)+1;seen.set(url,count);calls.push(url)
 assert.equal(init.method??'GET','GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
 return Object.defineProperty(new Response(edit(text(packet),url,count),{status:packet.status,headers:packet.headers}),'url',{value:packet.finalURL})
}}}
const collect=io=>run({fetchImpl:io.fetchImpl,requestIntervalMs:0})
test('Lemonade current career protected-contact representation preserves the exact authored empty cohort and unknown company counts',async()=>{
 const io=replay(),jobs=await collect(io),audit=jobs.nativeCollectionEvidence,evidence=readInventoryEvidence(jobs)
 assert.equal(jobs.length,0);assert.equal(io.calls.length,6);assert.equal(evidence.status,'discovery-only')
 assert.equal(evidence.listingComplete,false);assert.equal(evidence.reportedTotal,null);assert.equal(evidence.indiaFacetCount,null);assert.equal(evidence.lifecycleCleanupAllowed,false)
 assert.equal(audit.configuredPublicCohortEmpty,true);assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.companyIndiaTotal,null)
 assert.equal(audit.originalModels.opening.career.text,career);assert.equal(audit.careerContactRepresentations.opening.actualEncodedRepresentationRetainedInOriginalModel,true)
 assert.equal(audit.careerContactRepresentations.opening.decoderFetchedOrExecuted,false)
})
test('Lemonade current career closing contact can rotate while whole raw inequality remains explicit',async()=>{
 const io=replay((body,url,count)=>url===CAREER&&count===2?body.replace(cipher,rotated):body),jobs=await collect(io),audit=jobs.nativeCollectionEvidence
 assert.equal(audit.rawWholeEntitiesEqual,false);assert.equal(audit.wholeModelClosingEqual,false);assert.equal(audit.contactProjectionClosingEqual,true)
 assert.notEqual(audit.originalModels.opening.career.text,audit.originalModels.closing.career.text)
 assert.equal(audit.careerContactRepresentations.opening.decodedSHA256,audit.careerContactRepresentations.closing.decodedSHA256)
})
for(const[label,edit]of[
 ['different decoded contact',body=>body.replace(cipher,cipher.slice(0,-2)+(cipher.endsWith('00')?'01':'00'))],
 ['new native criterion',body=>body.replace('</body>','<p>Applicants must hold a licence.</p></body>')],
 ['new authored role',body=>body.replace('no open roles at the moment','Engineer India Apply now')],
 ['different footer ownership',body=>body.replace('<footer','<aside').replace('</footer>','</aside>')],
 ['duplicate contact',body=>body.replace('data-cfemail="'+cipher+'"','data-cfemail="'+cipher+'" data-cfemail="'+cipher+'"')],
 ['changed decoder source',body=>body.replace('/cloudflare-static/email-decode.min.js','/cloudflare-static/other-decoder.js')],
 ['new hidden datum',body=>body.replace('data-cfemail="'+cipher+'"','data-country="India" data-cfemail="'+cipher+'"')],
])test('Lemonade current career contact keeps '+label+' held before client admission',async()=>{
 const changed=edit(career);assert.notEqual(changed,career)
 const io=replay((body,url)=>url===CAREER?changed:body)
 await assert.rejects(collect(io),error=>error.failureKind==='parser_or_contract_error');assert.equal(io.calls.length,2)
})
test('Lemonade career and home contact witnesses cannot cross page-owned models',()=>{
 const homeModel=contract.nativeHTMLModel(text(pages.get(HOME)),HOME),careerModel=contract.nativeHTMLModel(career,CAREER)
 assert.throws(()=>contract.qualifyProtectedHomeContact(career,careerModel,profile.career),error=>error.failureKind==='parser_or_contract_error')
 assert.throws(()=>contract.qualifyProtectedCareerContact(text(pages.get(HOME)),homeModel,profile.home),error=>error.failureKind==='parser_or_contract_error')
})
test('Lemonade current career contact projection cannot conceal another closing raw byte',async()=>{
 const io=replay((body,url,count)=>url===CAREER&&count===2?body.replace(cipher,rotated)+'\n':body)
 await assert.rejects(collect(io),/whole current public publication\/client closing model changed/)
})
