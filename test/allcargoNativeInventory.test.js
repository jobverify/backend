import assert from 'node:assert/strict'
import test from 'node:test'
import { run, createAllcargoLogisticsScraper } from '../scraper/allcargologistics/script.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'
const official='https://www.allcargologistics.com/about-us/careers'
const origin='https://allcargologistics.darwinbox.in'
const home=origin+'/ms/candidatev2/main/careers/home'
const seed=origin+'/ms/candidatev2/main/careers/allJobs'
const api=origin+'/ms/candidateapi/job/alljobs?companyId=main'
const html='<title>Careers At Allcargo Logistics</title><h1>Allcargo Careers</h1><a href="'+home+'">Join Our Team</a>'
const native='<title>Allcargo Logistics Ltd.</title><meta property="og:title" content="Allcargo Logistics Ltd."><body>Allcargo Logistics Ltd.</body>'
function transport({payload={status:'success',data:[],job_counts:0},officialBody=html,nativeBody=native,change=()=>{},cancel}={}){
 return async(url,init={})=>{
  cancel?.(url)
  let body,headers={'content-type':'text/html'}
  if(url===official)body=officialBody
  else if(url===home||url===seed){body=nativeBody;headers['set-cookie']='public_session=test; Path=/; Secure; HttpOnly'}
  else if(url===api){assert.equal(init.method,'POST');assert.equal(init.headers.Origin,origin);assert.equal(init.headers.Referer,seed);assert.match(init.headers.Cookie,/public_session=test/);assert.deepEqual(JSON.parse(init.body),{companyId:'main',sort_option:'new',limit:10,page:1});body=JSON.stringify(payload);headers['content-type']='application/json'}
  else throw new Error('Unexpected request '+url)
  const r=new Response(body,{status:200,headers});Object.defineProperty(r,'url',{value:url,configurable:true});change(r,url);return r
 }
}
// Catches the stale gatikwe branch and dropped injected run options; no actual network.
test('registered Allcargo run proves current native empty inventory through the official tenant',async()=>{
 const jobs=await run({fetchImpl:transport(),fetchText:async()=>html,probeListingApi:async()=>({status:500,body:'Invalid subdomain gatikwe'})})
 assert.equal(readInventoryEvidence(jobs)?.status,'verified-empty')
 assert.equal(readInventoryEvidence(jobs)?.reportedTotal,0)
 assert.equal(readInventoryEvidence(jobs)?.listingComplete,true)
})
for(const [label,payload]of Object.entries({failed:{status:'failed',data:[],job_counts:0},missingStatus:{data:[],job_counts:0},truncated:{status:'success',data:[],job_counts:1},malformed:{status:'success',data:{},job_counts:0},invalidTotal:{status:'success',data:[],job_counts:false},nextPage:{status:'success',data:[],job_counts:0,next_page:2},foreignIdentity:{status:'success',data:[],job_counts:0,companyId:'foreign'}}))test('Allcargo rejects '+label+' instead of certifying empty',async()=>{
 await assert.rejects(createAllcargoLogisticsScraper().run({fetchImpl:transport({payload})}))
})
test('missing native total remains unknown',async()=>{
 const jobs=await run({fetchImpl:transport({payload:{status:'success',data:[]}})})
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})
test('future nonempty native inventory remains unresolved until details and geography are supported',async()=>{
 const jobs=await run({fetchImpl:transport({payload:{status:'success',data:[{id:'1',title:'Engineer',locations:'Pune'}],job_counts:1}})})
 assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
for(const [label,opts]of Object.entries({foreignBoard:{nativeBody:native.replaceAll('Allcargo Logistics Ltd.','Other Employer Ltd.')},hiddenHandoff:{officialBody:'<title>Allcargo Careers</title><template>'+html+'</template>'},httpFailure:{change:(r,url)=>{if(url===api)Object.defineProperty(r,'status',{value:403})}},foreignResponse:{change:(r,url)=>{if(url===seed)Object.defineProperty(r,'url',{value:'https://other.example/careers'})}},missingResponseUrl:{change:(r)=>Object.defineProperty(r,'url',{value:''})}}))test('Allcargo prevents verified empty for '+label,async()=>{
 await assert.rejects(run({fetchImpl:transport(opts)}))
})
test('additional advertised hiring channel keeps whole-source scope unknown',async()=>{
 const jobs=await run({fetchImpl:transport({officialBody:html+'<a href="https://other.example/jobs">Apply for jobs</a>'})})
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.deepEqual(jobs.sourceAudit.additionalHiringScopes,['https://other.example/jobs'])
})
test('cancellation is propagated before any request',async()=>{
 const controller=new AbortController();controller.abort(new Error('cancelled fixture'))
 await assert.rejects(run({fetchImpl:async()=>assert.fail('request after abort'),signal:controller.signal}),/cancelled fixture/)
})
test('cancellation during native request is propagated',async()=>{
 const controller=new AbortController()
 await assert.rejects(run({fetchImpl:transport({cancel:url=>{if(url===api)controller.abort(new Error('cancelled fixture'))}}),signal:controller.signal}),/cancelled fixture/)
})
// Catches consuming the fresh public session response before the listing POST;
// the public endpoint rejects that transport sequence (fresh HTTP diagnostic).
test('public cookie seed is released without consuming its body before the native API',async()=>{
 let sessionReleased=false
 const base=transport()
 const fetchImpl=async(url,init)=>{
  if(url===api&&!sessionReleased)return new Response('session unavailable',{status:403})
  const response=await base(url,init)
  if(url===seed){sessionReleased=false;const cancel=response.body.cancel.bind(response.body);response.body.cancel=async()=>{sessionReleased=true;return cancel()}}
  return response
 }
 const jobs=await run({fetchImpl})
 assert.equal(readInventoryEvidence(jobs).status,'verified-empty')
})
for(const [label,extra]of Object.entries({nestedPagination:{pagination:{next:2}},filteredInventory:{filters:{department:'Engineering'}},errorEnvelope:{error:'native inventory unavailable'}}))test('unreviewed '+label+' cannot masquerade as whole-company empty inventory',async()=>{
 await assert.rejects(run({fetchImpl:transport({payload:{status:'success',data:[],job_counts:0,...extra}})}))
})
for(const extraUrl of ['https://boards.greenhouse.io/another-employer','https://company.teamtailor.com/','https://company.personio.de/','https://user:password@allcargologistics.darwinbox.in/ms/candidatev2/main/careers/home','https://allcargologistics.darwinbox.in:8443/ms/candidatev2/main/careers/allJobs'])test('known recruiting destination stays unresolved with a blank anchor: '+extraUrl,async()=>{
 const jobs=await run({fetchImpl:transport({officialBody:html+'<a href="'+extraUrl+'"></a>'})})
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.deepEqual(jobs.sourceAudit.additionalHiringScopes,[extraUrl])
})
for(const typed of [{ '@type':['Thing','JobPosting'],title:'Engineer'},{'@graph':[{'@type':['https://schema.org/JobPosting'],title:'Engineer'}]}])test('active JSON-LD array typed JobPosting remains additional unresolved inventory',async()=>{
 const jobs=await run({fetchImpl:transport({officialBody:html+'<script type="application/ld+json">'+JSON.stringify(typed)+'</script>'})})
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.ok(jobs.sourceAudit.additionalHiringScopes.includes('unreconciled-structured-job-posting'))
})
