import assert from 'node:assert/strict'
import test from 'node:test'
import {createVerifiedRecruitmentScraper} from '../scraper-support/utils/verifiedRecruitment.js'

const root='https://example.test/global/en/search-results'
const config={widgetApiEndpoint:'https://example.test/widgets',country:'global',deviceType:'desktop',locale:'en_global',refNum:'EXAMPLE1',baseUrl:'https://example.test/global/en/',baseDomain:'https://example.test',pageName:'search-results',siteType:'external'}
const siteConfig={status:'success',data:{refNum:'EXAMPLE1',urlMap:{'search-results':'search-results',job:'job/:jobId/:title'}}}
const listing={jobId:'R1',title:'Engineer',country:'India',siteType:'external',jobVisibility:['external']}
const description='<p>Design production services, review technical designs with engineers, investigate incidents, implement improvements and maintain reliable software used by customers around the world.</p>'
const role={...listing,description,companyName:'Example',uniqueValue:{jobId:'R1',refNum:'EXAMPLE1',siteType:'external'}}
const html=(settings,ddo)=>`<h1>Example Careers</h1><script>var phApp=${JSON.stringify(settings)};phApp.ddo=${JSON.stringify(ddo)}</script>`
async function run({listed={},detailed={},initialRows=[],deduplicatePhenomNativeIds=true}={}){
 const requests=[]
 const jobs=await createVerifiedRecruitmentScraper({source:'example',companyName:'Example',companyDomain:'example.test',companyCareerPage:root,requireNativeEmployerName:true,discoverLiteralRecruitmentData:true,deduplicatePhenomNativeIds}).run({
  fetchPage:async url=>{requests.push(url);return {url,status:200,html:url===root?html(config,{siteConfig,eagerLoadRefineSearch:{status:200,totalHits:1,data:{jobs:initialRows,aggregations:[{field:'country',value:{India:1}}]}}}):html({...config,pageName:'job'},{siteConfig,jobDetail:{status:200,hits:1,totalHits:1,data:{job:{...role,...detailed}}}})}},
  fetchJson:async()=>({refineSearch:{status:200,totalHits:1,data:{jobs:[{...listing,...listed}]}}})
 })
 return {jobs,requests}
}
test('Phenom public jobVisibility declarations support the current listing and native detail contract',async()=>{
 const {jobs,requests}=await run()
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].country,'India')
 assert.equal(jobs[0].sourceDescription,description)
 assert.deepEqual(jobs[0].nativeSourceRecord.jobVisibility,['external'])
 assert.ok(requests.some(url=>url.endsWith('/job/R1/Engineer')))
 assert.equal(jobs[0].sourceScopeComplete,false)
 assert.equal(jobs[0].lifecycleCleanupAllowed,false)
})
for(const phase of ['listed','detailed'])for(const [name,change]of [
 ['missing publication declarations',{jobVisibility:undefined}],['empty publication declarations',{jobVisibility:[]}],
 ['internal publication',{jobVisibility:['internal']}],['invalid publication declaration',{jobVisibility:['external',0]}],
 ['conflicting publication',{visibilityType:'Internal'}],['internal site',{siteType:'internal'}],
 ['foreign country',{country:'United States'}],['other employer',{companyName:'Other'}],
]){
 if(phase==='listed'&&name==='other employer')continue
 test(`Phenom rejects ${name} in its ${phase} record`,async()=>assert.equal((await run({[phase]:change})).jobs.length,0))
}
test('a role published to external and internal audiences remains public on the external site',async()=>{
 for(const visibilityType of [undefined,'External']){
  const declarations={jobVisibility:['external','internal'],visibilityType}
  assert.equal((await run({listed:declarations,detailed:declarations})).jobs.length,1)
 }
})
test('a reviewed Phenom source deduplicates the same native account and role exposed under public URL aliases',async()=>{
 const initialRows=[{...listing,applyUrl:'https://example.test/global/en/job/R1/engineer-canonical'}]
 assert.equal((await run({initialRows})).jobs.length,1)
 assert.equal((await run({initialRows,deduplicatePhenomNativeIds:false})).jobs.length,2)
})
