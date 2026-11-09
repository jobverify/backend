import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'

function transport(source,change=()=>{}) {
 const {packets}=JSON.parse(gunzipSync(fs.readFileSync(new URL(`../scraper/${source}/fixtures/native-20261030.json.gz`,import.meta.url))))
 const calls=[]
 return {calls,fetchImpl:async(url,init={})=>{
  url=String(url);init.signal?.throwIfAborted();const packet=packets.find(p=>p.url===url)
  assert.ok(packet,`No observed public fixture for ${url}`)
  const row=structuredClone(packet);change(row,calls);calls.push(url)
  const response=new Response(row.body,{status:row.status,headers:{'Content-Type':row.contentType||'text/html','Set-Cookie':'fixture-public=1; Path=/'}})
  Object.defineProperty(response,'url',{value:row.finalUrl||row.url});return response
 }}
}
globalThis.fetch=async()=>assert.fail('Native recovery must use the supplied observed HTTP transport')

test('Perfios retains two full native India roles and the genuine blank-JD gap from all three postings',async()=>{
 const http=transport('perfios'),audits=[];const{run}=await import('../scraper/perfios/script.js')
 const jobs=await run({...http,onAudit:a=>audits.push(a)})
 assert.deepEqual(jobs.map(j=>j.jobId).sort(),['a660a7568eaa60','a660a8d2c51b9b'])
 assert.ok(jobs.every(j=>j.country==='India'&&j.sourceDetailComplete===true&&j.sourceDescription.length>500&&j.sourceListingComplete===false&&j.lifecycleCleanupAllowed===false))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
 assert.equal(audits[0].nativeTotal,3)
 assert.equal(audits[0].excludedNativeRoles[0].detail.id,'a66d086d283bb4')
 assert.equal(audits[0].excludedNativeRoles[0].detail.jd,'&lt;p&gt;&lt;br&gt;&lt;/p&gt;')
 assert.ok(jobs.every(j=>j.sourceUnresolvedNativeRoles.some(row=>row.detail.id==='a66d086d283bb4')))
 assert.ok(http.calls.includes('https://perfios.darwinbox.in/ms/candidateapi/companyinfo'))
})

test('StanPlus retains all twenty roles and the genuine 56-versus-55 listing abbreviation without inventing address aliases',async()=>{
 const http=transport('stanplus'),audits=[];const{run}=await import('../scraper/stanplus/script.js')
 const jobs=await run({...http,onAudit:a=>audits.push(a)})
 assert.equal(jobs.length,20);assert.equal(new Set(jobs.map(j=>j.jobId)).size,20)
 assert.ok(jobs.every(j=>j.country==='India'&&j.sourceDescription.length>100&&j.sourceListingComplete===false&&j.lifecycleCleanupAllowed===false))
 assert.equal(jobs.filter(j=>j.sourceDetailComplete).length,18)
 assert.deepEqual(jobs.filter(j=>!j.sourceDetailComplete).map(j=>j.jobId).sort(),['a649991f416cb0','a65d32117b8924'])
 assert.equal(audits[0].nativeTotal,20)
 assert.deepEqual(audits[0].excludedNativeRoles,[])
 const role=jobs.find(j=>j.jobId==='a6703885386e4e')
 assert.equal(role.sourceNativeLocationIds.length,56);assert.equal(role.sourceNativeLocations.length,56)
 assert.equal(role.sourceNativeListingRecord.tool_tip_locations.length,55)
 assert.equal(role.sourceNativeDetailPayload.message.job[0].officelocations_without_area.at(-1),', Chhattisgarh\r, India')
 assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
})

for(const source of ['perfios','stanplus'])test(`${source} rejects caps and body-only overrides before HTTP`,async()=>{
 const http=transport(source),{run}=await import(`../scraper/${source}/script.js`)
 await assert.rejects(run({...http,maxJobs:1}),/caps|limits/i)
 await assert.rejects(run({...http,fetchText:async()=>''}),/metadata|body.only|unsupported/i)
 assert.equal(http.calls.length,0)
})

const isListing=row=>/\/candidateapi\/job\?page=/.test(row.url)
const isDetail=row=>/\/candidateapi\/job\/a6703885386e4e\?/.test(row.url)
const update=(row,change)=>{const value=JSON.parse(row.body);change(value);row.body=JSON.stringify(value)}
for(const [label,change]of [
 ['foreign listing-only location',row=>{if(isListing(row))update(row,j=>{if(j.message.jobs[0].id==='a6703885386e4e')j.message.jobs[0].tool_tip_locations.push('Boston, United States')})}],
 ['unmatched listing-only location ID',row=>{if(isListing(row))update(row,j=>{if(j.message.jobs[0].id==='a6703885386e4e')j.message.jobs[0].officelocation_arr=['unmatchedNativeId']})}],
 ['contradictory detail location scalar',row=>{if(isDetail(row))update(row,j=>j.message.job[0].locations='Boston, United States')}],
 ['duplicate detail location IDs',row=>{if(isDetail(row))update(row,j=>j.message.job[0].officelocation_arr[1]=j.message.job[0].officelocation_arr[0])}],
 ['unqualified additional country',row=>{if(isDetail(row))update(row,j=>j.message.job[0].officelocations_area.push('Remote'))}],
])test(`StanPlus rejects complete promotion for ${label}`,async()=>{
 const http=transport('stanplus',change),{run}=await import('../scraper/stanplus/script.js');const jobs=await run(http)
 assert.equal(jobs.length,19);assert.ok(jobs.every(j=>j.jobId!=='a6703885386e4e'))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
 assert.ok(jobs.every(j=>j.lifecycleCleanupAllowed===false))
})

for(const type of ['listing','detail'])test(`StanPlus unknown mandatory ${type} criteria revoke only the affected full-detail claim`,async()=>{
 const http=transport('stanplus',row=>{if(type==='detail'&&isDetail(row))update(row,j=>j.message.job[0].mandatoryLicense='New mandatory license');if(type==='listing'&&isListing(row))update(row,j=>{if(j.message.jobs[0].id==='a6703885386e4e')j.message.jobs[0].mandatoryLicense='New mandatory license'})}),{run}=await import('../scraper/stanplus/script.js')
 const jobs=await run(http);assert.equal(jobs.length,20);assert.equal(jobs.find(j=>j.jobId==='a6703885386e4e').sourceDetailComplete,false)
 assert.equal(jobs.filter(j=>j.sourceDetailComplete).length,17);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('StanPlus closing native criteria drift excludes only the changed role',async()=>{
 let count=0;const http=transport('stanplus',row=>{if(isDetail(row)&&++count===2)update(row,j=>j.message.job[0].jd+=' A changed mandatory qualification.')}),{run}=await import('../scraper/stanplus/script.js')
 const jobs=await run(http);assert.equal(jobs.length,19);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

for(const [label,addition]of [['shell-script','<script src="https://jobs.ashbyhq.com/other/embed.js"></script>'],['corporate-widget','<div data-hiring-url="https://custom.example/jobs"></div>']])test(`StanPlus unreviewed ${label} preserves jobs but prevents source cleanup`,async()=>{
 const http=transport('stanplus',row=>{if(label==='shell-script'&&row.url==='https://redhealth.darwinbox.in/ms/candidatev2/main'||label==='corporate-widget'&&row.url==='https://www.red.health/career')row.body+=addition}),{run}=await import('../scraper/stanplus/script.js')
 const jobs=await run(http);assert.equal(jobs.length,20);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.ok(jobs.every(j=>!j.lifecycleCleanupAllowed))
})

test('StanPlus denied native API cannot become a verified zero',async()=>{
 const http=transport('stanplus',row=>{if(isListing(row))row.status=403}),{run}=await import('../scraper/stanplus/script.js')
 await assert.rejects(run(http),/status|HTTP|denied|API/i)
})

test('Perfios only follows the current client-declared v2 transition when the legacy company explicitly enables it',async()=>{
 const http=transport('perfios',row=>{if(row.url.endsWith('/companyinfo'))update(row,j=>j.message.company.new_careers=false)}),{run}=await import('../scraper/perfios/script.js')
 await assert.rejects(run(http),/legacy|transition|configuration|careers/i)
})

test('StanPlus editor instructions are retained as original upstream content without claiming complete job criteria',async()=>{
 const http=transport('stanplus'),{run}=await import('../scraper/stanplus/script.js');const jobs=await run(http)
 const job=jobs.find(j=>j.jobId==='a649991f416cb0')
 assert.equal(job.sourceDetailComplete,false);assert.match(job.sourceDetailFailureKind,/editor-template-placeholder/)
 assert.match(job.sourceNativeDetailPayload.message.job[0].jd,/Write a compelling job description/)
})

test('StanPlus visible ordinary prose containing hidden does not masquerade as a hidden HTML criterion',async()=>{
 const http=transport('stanplus',row=>{if(/\/candidateapi\/job\/a66953fa58858a\?/.test(row.url))update(row,j=>j.message.job[0].jd+=' Required ability to discover hidden data patterns.')}),{run}=await import('../scraper/stanplus/script.js');const jobs=await run(http)
 assert.equal(jobs.find(j=>j.jobId==='a66953fa58858a').sourceDetailComplete,true)
})

for(const css of ['opacity:0','width:0;height:0;overflow:hidden','height:0;overflow:clip'])test(`StanPlus ${css} mandatory criteria cannot retain a complete-detail claim`,async()=>{
 const http=transport('stanplus',row=>{if(/\/candidateapi\/job\/a66953fa58858a\?/.test(row.url))update(row,j=>j.message.job[0].jd+=`<div style="${css}">A newly required mandatory professional license.</div>`)}),{run}=await import('../scraper/stanplus/script.js')
 const jobs=await run(http),job=jobs.find(j=>j.jobId==='a66953fa58858a')
 assert.equal(jobs.length,20);assert.equal(job.sourceDetailComplete,false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.match(job.sourceNativeDetailPayload.message.job[0].jd,/A newly required mandatory professional license/)
})
