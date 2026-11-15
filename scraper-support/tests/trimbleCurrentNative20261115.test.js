import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {buildScrapers} from '../providers/index.js'
import run from '../../scraper/trimble/script.js'
import {readNativeDocument} from '../utils/activeNativeHtml.js'
import {parseBoundedProgram,parseRemoteLiteral} from '../utils/remoteScriptData.js'
const original=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../scraper/trimble/fixtures/native-20261115.json.gz',import.meta.url))))
const fixtureFetch=(packets,reads)=>async url=>{
 reads.push(String(url));const packet=packets[String(url)]
 const response=new Response(packet?.html||'Obsolete API denied',{status:packet?.status||403})
 Object.defineProperty(response,'url',{value:String(url)});return response
}
test('registered Trimble follows current corporate Paradox listings and retains the full visible role criteria',async()=>{
 const reads=[],source=buildScrapers().find(s=>s.name==='trimble')
 const jobs=await source.run({fetchImpl:fixtureFetch(original,reads),now:'2026-11-15T06:00:00Z'})
 assert.equal(jobs.length,13)
 assert.ok(jobs.every(j=>j.country==='India'&&j.source==='trimble'&&j.sourceListingComplete===false&&j.lifecycleCleanupAllowed===false))
 const sre=jobs.find(j=>j.jobId==='R56012')
 assert.match(sre.jobDescription,/How to Apply/)
 assert.match(sre.jobDescription,/Pay Rate Type/)
 assert.equal(sre.closingDate,null)
 assert.equal(sre.sourceNativePublishingEndDate,'2026-12-03')
 assert.equal(jobs.nativeCollectionEvidence.nativeRecords.length,183)
 assert.equal(jobs.nativeCollectionEvidence.sourceScopeComplete,false)
 assert.ok(!reads.some(u=>u.includes('/api/pcsx/')))
})
const roleURL='https://trimblecareers.trimble.com/site-reliablity-engineer-ii/job/R56012'
const rewritePosting=(packet,change)=>{
 const node=readNativeDocument(packet.html).nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json')
  .find(n=>JSON.parse(n.raw)['@type']==='JobPosting')
 const posting=JSON.parse(node.raw);change(posting);packet.html=packet.html.replace(node.raw,JSON.stringify(posting))
}
const rewriteState=(packet,change)=>{
 const node=readNativeDocument(packet.html).nodes(n=>n.tag==='script'&&/window\.__PRELOAD_STATE__\s*=/.test(n.raw))[0]
 const expression=parseBoundedProgram(node.raw).body[0].expression.right,state=parseRemoteLiteral(node.raw.slice(expression.start,expression.end))
 change(state)
 packet.html=packet.html.replace(node.raw,node.raw.slice(0,expression.start)+JSON.stringify(state)+node.raw.slice(expression.end))
}
for(const [name,change,reason]of[
 ['foreign typed country',p=>rewritePosting(p[roleURL],j=>{j.jobLocation[0].address.addressCountry='GB'}),/typed India country/],
 ['different schema employer',p=>rewritePosting(p[roleURL],j=>{j.hiringOrganization.name='Unrelated company'}),/employer\/title\/ID/],
 ['different schema role identity',p=>rewritePosting(p[roleURL],j=>{j.identifier.value='R99999'}),/employer\/title\/ID/],
 ['incomplete schema criteria',p=>rewritePosting(p[roleURL],j=>{j.description='<p>Short preview only</p>'}),/authored criteria/],
 ['different application requisition',p=>{p[roleURL].html=p[roleURL].html.replaceAll('_R56012','_R99999')},/application/],
 ['expired native publishing window',p=>{for(const [url,packet]of Object.entries(p))if(/\/jobs(?:\/page\/\d+)?$/.test(url))rewriteState(packet,s=>{for(const row of s.jobSearch.jobs)if(row.requisitionID==='R56012')row.customFields.find(f=>f.cfKey==='cf_end_date').value='11/14/2026'})},/publishing window expired/],
])test('Trimble withholds a native role with '+name+' and retains its unmodified native observation',async()=>{
 const packets=structuredClone(original);change(packets)
 const jobs=await run({fetchImpl:fixtureFetch(packets,[]),now:'2026-11-15T06:00:00Z'})
 assert.equal(jobs.length,12)
 assert.ok(!jobs.some(j=>j.jobId==='R56012'))
 assert.equal(jobs.nativeCollectionEvidence.nativeRecords.length,183)
 assert.match(jobs.nativeCollectionEvidence.heldRecords.find(r=>r.row.requisitionID==='R56012').reason,reason)
})
test('Trimble refuses duplicate native global vacancy identities before zero or scope qualification',async()=>{
 const packets=structuredClone(original)
 rewriteState(packets['https://trimblecareers.trimble.com/jobs'],s=>{s.jobSearch.jobs[1]=structuredClone(s.jobSearch.jobs[0])})
 await assert.rejects(run({fetchImpl:fixtureFetch(packets,[]),now:'2026-11-15T06:00:00Z'}),/duplicate native vacancy/)
})
test('a hidden corporate handoff cannot authorize the Trimble native account',async()=>{
 const packets=structuredClone(original)
 packets['https://www.trimble.com/en/careers'].html='<title>Careers | Trimble</title><div hidden><a href="https://trimblecareers.trimble.com/jobs">Search jobs</a></div>'
 await assert.rejects(run({fetchImpl:fixtureFetch(packets,[]),now:'2026-11-15T06:00:00Z'}),/corporate.*handoff/)
})

for(const [name,change,reason]of[
 ['stylesheet-hidden corporate handoff',p=>{const page=p['https://www.trimble.com/en/careers'];page.html=page.html.replace('</head>','<style>a{display:none!important}</style></head>')},/corporate.*handoff/],
 ['unreviewed corporate base',p=>{const page=p['https://www.trimble.com/en/careers'];page.html=page.html.replace('</head>','<base href="https://unrelated.invalid/"></head>')},/corporate.*base/],
 ['stylesheet-hidden native listing links',p=>{for(const [url,page]of Object.entries(p))if(/\/jobs(?:\/page\/\d+)?$/.test(url))page.html=page.html.replace('</head>','<style>a{display:none!important}</style></head>')},/visible link/],
 ...['type="application/json"','type="module"','src=""','nomodule=""'].map(attribute=>['inactive native state '+attribute,p=>{for(const [url,page]of Object.entries(p))if(url.startsWith('https://trimblecareers.trimble.com'))page.html=page.html.replace(/<script(?=\s|>)([^>]*>\s*window\.__PRELOAD_STATE__\s*=)/g,'<script '+attribute+'$1')},/state.*execution/]),
])test('Trimble refuses '+name,async()=>{
 const packets=structuredClone(original);change(packets)
 await assert.rejects(run({fetchImpl:fixtureFetch(packets,[]),now:'2026-11-15T06:00:00Z'}),reason)
})
test('Trimble closes the full visible criteria including authored additions absent from its schema',async()=>{
 let reads=0;const fetchOriginal=fixtureFetch(original,[])
 await assert.rejects(run({now:'2026-11-15T06:00:00Z',fetchImpl:async(url,init)=>{
  if(url===roleURL&&++reads===2){const packets=structuredClone(original)
   assert.match(packets[roleURL].html,/How to Apply:/)
   packets[roleURL].html=packets[roleURL].html.replace('How to Apply:','New required certification:')
   return fixtureFetch(packets,[])(url,init)
  }return fetchOriginal(url,init)
 }}),/closing native full role criteria changed/)
})
