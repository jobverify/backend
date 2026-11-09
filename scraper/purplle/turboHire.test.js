import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const captured=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/turbohire-20261106.json.gz',import.meta.url))))
const rows=new Map(captured.packets.map(r=>[r.url,r]))
const now='2026-11-06T07:00:00Z'
const replay=(change=r=>r)=>async(url,init={})=>{
 let original=rows.get(url)
 if(url.endsWith('/api/token/noauth'))original={url,finalUrl:url,status:200,contentType:'application/json',body:JSON.stringify({access_token:'synthetic-public-session',token_type:'Bearer',expires_in:3600,ShouldRedirect:false})}
 assert.ok(original,'uncaptured URL '+url)
 const row=change({...original},init),response=new Response(row.body,{status:row.status,headers:{'content-type':row.contentType,...(row.location?{location:row.location}:{})}})
 Object.defineProperty(response,'url',{value:row.finalUrl});return response
}
const options={fetchImpl:replay(),now,maxJobs:2,requestIntervalMs:0,timeoutMs:60000}

test('current declared TurboHire handoff recovers two full native India details after LinkedIn access denial',async()=>{
 const jobs=await run(options)
 assert.deepEqual(jobs.map(j=>j.jobId),['0e971602-5277-4d35-aad7-a11fce3a2c06','dbb5c4fa-69fa-4bea-ad2b-ee8c86180cf7'])
 assert.ok(jobs.every(j=>j.country==='India'&&j.activeApplyVerified===false&&j.applicationPublicContextValidated&&j.sourceDetailComplete&&j.sourceDescription.length>1000&&j.lifecycleCleanupAllowed===false&&j.sourceScopeComplete===false))
 assert.equal(jobs[0].postingDate,'2026-11-04T10:17:44.542647Z')
 assert.equal(jobs[0].closingDate,'2026-11-30')
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(jobs[0].nativeSourceRecord.nativePublisher.post.numericLinkedInOrganizationCurrentlyVerified,false)
 assert.match(readInventoryEvidence(jobs).reason,/LinkedIn|bounded/i)
})

for(const [name,match,edit] of [
 ['post author','/posts/',r=>{r.body=r.body.replaceAll('"name":"Purplle.com"','"name":"Other employer"');return r}],
 ['post author slug','/posts/',r=>({...r,body:r.body.replaceAll('/company/purplle-com','/company/other-employer')})],
 ['declared short link','/posts/',r=>{r.body=r.body.replaceAll('gqG86pHt','other-link');return r}],
 ['declared tenant redirect','tinyurl.com',r=>({...r,location:'https://other.turbohire.co/careerpage/3ed17e54-f66f-4ade-90b9-ef064dc6fbd6'})],
 ['organization reciprocal website','/api/publicorganizations',r=>{const v=JSON.parse(r.body);v.OrgURL='https://unrelated.invalid/';r.body=JSON.stringify(v);return r}],
 ['organization tenant account','/api/publicorganizations',r=>{const v=JSON.parse(r.body);v.CareerPageSubdomain='other-employer';r.body=JSON.stringify(v);return r}],
 ['current client','/main.bc8',r=>({...r,body:r.body+'\nwindow.changed=true;'})],
 ['declared current client query','/careerpage/',r=>({...r,body:r.body.replace('/main.bc8f2fdf0fa9e74f4468.chunk.js','/main.bc8f2fdf0fa9e74f4468.chunk.js?deployment=unreviewed')})],
 ['unknown external native program','/careerpage/',r=>({...r,body:r.body.replace('</body>','<script src="https://unknown.example/hiring-program.js"></script></body>')})],
 ['hidden executable external program','/careerpage/',r=>({...r,body:r.body.replace('</body>','<script hidden src="https://unknown.example/hiring-program.js"></script></body>')})],
 ['hidden conflicting OG employer','/job/publicjobs/',r=>({...r,body:r.body.replace('</head>','<meta hidden property="og:site_name" content="Other employer"></head>')})],
 ['hidden second JobPosting','/job/publicjobs/',r=>({...r,body:r.body.replace('</head>','<script hidden type="application/ld+json">{"@type":"JobPosting","title":"Other role"}</script></head>')})],
 ['OG role title','/job/publicjobs/',r=>({...r,body:r.body.replace('content="[Hiring For]:','content="[Hiring For]: Unrelated role ')})],
 ['OG employer','/job/publicjobs/',r=>({...r,body:r.body.replace('property="og:site_name" content="Purplle.com"','property="og:site_name" content="Other employer"')})],
 ['OG criteria','/job/publicjobs/',r=>({...r,body:r.body.replace('property="og:description" content="','property="og:description" content="Different qualifications required. ')})],
 ['native schema country','/job/publicjobs/',r=>({...r,body:r.body.replaceAll('"addressCountry":"India"','"addressCountry":"United States"')})],
 ['native full criteria','/api/publicjobs/',r=>{const v=JSON.parse(r.body);v.JobDescriptionV2='<p>A completely different description requiring different qualifications and responsibilities.</p>';r.body=JSON.stringify(v);return r}],
 ['native public status','/api/publicjobs/',r=>{const v=JSON.parse(r.body);v.IsPublic=false;r.body=JSON.stringify(v);return r}],
 ['native publication contradiction','/api/publicjobs/',r=>{const v=JSON.parse(r.body);v.PublishedDates.CAREERPAGE='2026-11-05T00:00:00Z';r.body=JSON.stringify(v);return r}],
 ['new country carrier','/api/publicjobs/',r=>{const v=JSON.parse(r.body);v.Country='United States';r.body=JSON.stringify(v);return r}],
 ['new native expiry carrier','/api/publicjobs/',r=>{const v=JSON.parse(r.body);v.ClosingDate='2020-01-01';r.body=JSON.stringify(v);return r}],
 ['new native validThrough carrier','/api/publicjobs/',r=>{const v=JSON.parse(r.body);v.validThrough='2020-01-01';r.body=JSON.stringify(v);return r}],
 ['JSON response MIME','/api/publicjobs/',r=>({...r,contentType:'text/html'})],
 ['hidden HTML native country carrier','/job/publicjobs/',r=>({...r,body:r.body.replace('</head>','<meta hidden itemprop="addressCountry" content="United States"></head>')})],
 ['new native qualification carrier','/api/publicjobs/',r=>{const v=JSON.parse(r.body);v.Qualifications='Must have a postgraduate degree.';r.body=JSON.stringify(v);return r}],
 ['unread native description attachment','/api/publicjobs/',r=>{const v=JSON.parse(r.body);v.JobDescriptionBlobUrl='https://example.invalid/extra-criteria.pdf';r.body=JSON.stringify(v);return r}],
 ['application template','/api/publicjobs/',r=>{const v=JSON.parse(r.body);v.ApplicationEnquiryTemplateId='00000000-0000-0000-0000-000000000000';r.body=JSON.stringify(v);return r}],
]) test('TurboHire rejects changed '+name+' without publishing an empty inventory',async()=>{
 let reached=false
 await assert.rejects(run({...options,fetchImpl:replay(r=>{if(!r.url.includes(match))return r;const before=JSON.stringify(r),after=edit(r);assert.notEqual(JSON.stringify(after),before,'mutation must change genuine response');reached=true;return after})}),{code:'PURPLLE_COVERAGE_GAP'})
 assert.equal(reached,true,'negative must reach its intended native carrier')
})

test('TurboHire current fixture bodies retain their exact public response digests',()=>{
 for(const row of captured.packets)assert.equal(createHash('sha256').update(row.body).digest('hex'),row.sha256)
})

test('TurboHire cancels its native body stream and propagates exact caller abort',async()=>{
 const controller=new AbortController(),reason=Error('stop-current-Purplle'),fixture=replay();let cancelled=false
 await assert.rejects(run({...options,signal:controller.signal,fetchImpl:async(url,init)=>{
  if(url!=='https://lnkd.in/gqG86pHt')return fixture(url,init)
  const response=new Response(new ReadableStream({pull(){controller.abort(reason);return new Promise(()=>{})},cancel(){cancelled=true}}),{status:200,headers:{'content-type':'text/html'}})
  Object.defineProperty(response,'url',{value:url});return response
 }}),error=>error===reason)
 assert.equal(cancelled,true)
})

test('exact corporate HTTP247 can recover an independent current employer-declared ATS subset',async()=>{
 const fixture=replay(),jobs=await run({...options,fetchImpl:async(url,init)=>{
  if(url!=='https://www.purplle.com/careers')return fixture(url,init)
  const response=new Response('Corporate upstream unavailable',{status:247});Object.defineProperty(response,'url',{value:url});return response
 }})
 assert.equal(jobs.length,2)
 assert.deepEqual(jobs[0].nativeSourceRecord.nativePublisher.corporateUnavailable,{url:'https://www.purplle.com/careers',status:247})
 assert.equal(jobs[0].lifecycleCleanupAllowed,false)
})

test('corporate247 preserves its upstream outage classification when independent hiring identity fails',async()=>{
 const fixture=replay(r=>r.url.includes('/posts/')?{...r,body:r.body.replaceAll('/company/purplle-com','/company/unrelated')}:r)
 await assert.rejects(run({...options,fetchImpl:async(url,init)=>{
  if(url!=='https://www.purplle.com/careers')return fixture(url,init)
  const response=new Response('Unavailable',{status:247});Object.defineProperty(response,'url',{value:url});return response
 }}),error=>error.status===247&&error.failureKind==='upstream_unavailable'&&error.lifecycleCleanupAllowed===false)
})
