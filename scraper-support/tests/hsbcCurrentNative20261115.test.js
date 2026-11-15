import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {buildScrapers} from '../providers/index.js'
import run from '../../scraper/hsbctechnologyindia/script.js'
import {eightfoldDocument} from '../utils/recruitmentEightfoldData.js'
const original=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../scraper/hsbctechnologyindia/fixtures/native-20261115.json.gz',import.meta.url))))
const fixtureFetch=(packets,reads)=>async url=>{
 reads.push(String(url));const p=packets[String(url)]
 const response=new Response(p?.html||'Obsolete tenant denied',{status:p?.status||403,headers:p?.headers})
 Object.defineProperty(response,'url',{value:String(url)});return response
}
test('registered HSBC Technology India follows the current employer portal and retains full native roles and real deadlines',async()=>{
 const reads=[],source=buildScrapers().find(s=>s.name==='hsbctechnologyindia')
 const jobs=await source.run({fetchImpl:fixtureFetch(original,reads),now:'2026-11-15T06:00:00Z'})
 assert.equal(jobs.length,1)
 assert.ok(jobs.every(j=>j.country==='India'&&j.source==='hsbctechnologyindia'&&j.sourceListingComplete===false))
 const specialist=jobs.find(j=>j.jobId==='563774612463364')
 assert.match(specialist.jobDescription,/Issued by – HSBC Software Development India/)
 assert.match(specialist.jobDescription,/Apply By/)
 assert.equal(specialist.closingDate,'2026-11-16')
 assert.equal(specialist.lifecycleCleanupAllowed,false)
 assert.ok(reads.includes('https://www.hsbc.com/careers/find-a-job'))
 assert.ok(!reads.some(u=>new URL(u).hostname==='hsbc.eightfold.ai'))
})
test('own current carrier handles the observed nonbreaking-space slug and scalar Place without changing role authority',async()=>{
 const reads=[],jobs=await run({fetchImpl:fixtureFetch(original,reads),now:'2026-11-15T06:00:00Z'})
 assert.equal(jobs.length,1)
 assert.deepEqual(jobs.nativeCollectionEvidence.heldRecords.map(r=>r.id),[563774612448161,563774612540929,563774612589718])
 assert.match(jobs.nativeCollectionEvidence.heldRecords.find(r=>r.id===563774612540929).reason,/full authored criteria disagree/)
 assert.equal(jobs.nativeCollectionEvidence.nativeRecords.length,4)
 assert.equal(jobs.nativeCollectionEvidence.reportedSelectedTotal,4)
})
const positiveIds=['563774612463364']
for(const [name,mutate]of [
 ['wrong legal employer',p=>{for(const id of positiveIds){const u='https://portal.careers.hsbc.com/api/apply/v2/jobs/'+id+'?domain=hsbc.com';const j=JSON.parse(p[u].html);j.job_description=j.job_description.replace('HSBC Software Development India','Other HSBC Bank');p[u].html=JSON.stringify(j)}}],
 ['expired native Apply By despite future SEO expiry',p=>{for(const id of positiveIds){const u='https://portal.careers.hsbc.com/api/apply/v2/jobs/'+id+'?domain=hsbc.com';const j=JSON.parse(p[u].html);j.custom_JD.data_fields.postingEndDate=['14 November 2026'];p[u].html=JSON.stringify(j)}}],
 ['wrong own API role',p=>{for(const id of positiveIds){const u='https://portal.careers.hsbc.com/api/apply/v2/jobs/'+id+'?domain=hsbc.com';const j=JSON.parse(p[u].html);j.id=12345;p[u].html=JSON.stringify(j)}}],
 ['additional undisplayed native application criteria',p=>{for(const id of positiveIds){const u='https://portal.careers.hsbc.com/api/apply/v2/jobs/'+id+'?domain=hsbc.com';const j=JSON.parse(p[u].html);j.custom_JD.data_fields.extraQualification=['Must hold current certification'];p[u].html=JSON.stringify(j)}}],
 ['changed authored native criteria',p=>{for(const id of positiveIds){const u='https://portal.careers.hsbc.com/api/apply/v2/jobs/'+id+'?domain=hsbc.com';const j=JSON.parse(p[u].html);j.job_description=j.job_description.replace('HSBC is one','HSBC is two');p[u].html=JSON.stringify(j)}}],
 ['contradictory schema city with the same typed country',p=>{const packet=p['https://portal.careers.hsbc.com/careers/job/563774612463364'];const node=eightfoldDocument(packet.html).document.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json')[0];const j=JSON.parse(node.raw);j.jobLocation[0].address.addressLocality='London';packet.html=packet.html.replace(node.raw,JSON.stringify(j))}],
 ['inactive classic renderer mode',p=>{const packet=p['https://portal.careers.hsbc.com/careers/job/563774612463364'];const m=/<script\b[^>]*\bsrc=(["'])([^"']*smartApply\.[^"']+)\1[^>]*>/i.exec(packet.html);assert.ok(m);packet.html=packet.html.replace(m[0],'<script type="application/json" src="'+m[2]+'">')}],
 ['changed renderer',p=>{const u=Object.keys(p).find(u=>u.includes('/smartApply.'));p[u].html+=';/* changed */'}],
 ['missing current corporate handoff',p=>{p['https://www.hsbc.com/careers/find-a-job'].html='<title>Find a job | HSBC Holdings plc</title><a href="https://unrelated.invalid/careers">Search jobs</a>'}],
 ['stylesheet-hidden corporate handoff',p=>{const packet=p['https://www.hsbc.com/careers/find-a-job'];packet.html=packet.html.replace('</head>','<style>a{display:none!important}</style></head>')}],
 ['unreviewed corporate base',p=>{const packet=p['https://www.hsbc.com/careers/find-a-job'];packet.html=packet.html.replace('</head>','<base href="https://unrelated.invalid/"></head>')}],
 ['changed corporate antiClickjack remover',p=>{const packet=p['https://www.hsbc.com/careers/find-a-job'];const node=eightfoldDocument(packet.html).document.nodes(n=>n.tag==='script'&&/var allowedURIs/.test(n.raw||''))[0];assert.ok(node);packet.html=packet.html.replace(node.raw,node.raw+';/*changed*/')}],
])test('HSBC holds '+name,async()=>{
 const packets=structuredClone(original),reads=[];mutate(packets)
 await assert.rejects(run({fetchImpl:fixtureFetch(packets,reads),now:'2026-11-15T06:00:00Z'}),/coverage-gap|renderer|handoff/)
})
test('HSBC refuses closing native membership drift',async()=>{
 let selectedReads=0;const read=fixtureFetch(original,[])
 await assert.rejects(run({now:'2026-11-15T06:00:00Z',fetchImpl:async(url,init)=>{
  if(String(url).includes('department=Technology')&&++selectedReads===2){const p=structuredClone(original);p[String(url)].html=p[String(url)].html.replaceAll('Avaloq Developer / SENIOR CONSULTANT SPECIALIST','Different native title');return fixtureFetch(p,[])(url,init)}
  return read(url,init)
 }}),/closing selected native membership/)
})
