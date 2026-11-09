import assert from 'node:assert/strict'
import test from 'node:test'
import {getScraperCatalog} from '../scraper-support/providers/index.js'
import {readNativeDocument} from '../scraper-support/utils/activeNativeHtml.js'
import {phenomRecruitmentRole} from '../scraper-support/utils/recruitmentPageData.js'
import {createVerifiedRecruitmentScraper,recruitmentEmployerMatches,RECRUITMENT_OBSERVATIONS} from '../scraper-support/utils/verifiedRecruitment.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'

const provider=getScraperCatalog().find(row=>row.source==='airasiamove')
const roleURL='https://mycareer.airasia.com/gb/en/job/JR0034139/Executive'
const app={refNum:'AIRAGLOBAL',siteType:'external',baseDomain:'https://mycareer.airasia.com',
 baseUrl:'https://mycareer.airasia.com/gb/en/',widgetApiEndpoint:'https://mycareer.airasia.com/widgets',pageName:'job'}
const record={jobId:'JR0034139',title:'Executive, Desktop Support (India)',siteType:'external',visibilityType:'External',
 country:'India',standardisedCountry:'India',companyName:'AirAsia Technology Center India Private Limited',companyBrand:'MOVE',
 description:'<p>Manage desktop support for employees, diagnose hardware and software problems, maintain endpoint security, document incidents and coordinate reliable technical services across the office.</p>',
 uniqueValue:{jobId:'JR0034139',refNum:'AIRAGLOBAL',siteType:'external'},multi_location:[{country:'India',city:'Bangalore'}]}
const html=job=>'<script>var phApp='+JSON.stringify(app)+';phApp.ddo='+JSON.stringify({siteConfig:{status:'success',data:{refNum:'AIRAGLOBAL',urlMap:{}}},jobDetail:{status:200,hits:1,totalHits:1,data:{job}}})+';</script>'
const parse=(job=record,bindings=provider.nativePhenomBrandEmployerBindings)=>phenomRecruitmentRole(readNativeDocument(html(job)),roleURL,{brandEmployerBindings:bindings})
const run=(job=record,changes={})=>createVerifiedRecruitmentScraper({...provider,companyCareerPage:roleURL,officialHomepageUrl:null,...changes}).run({
 now:()=> '2026-11-05T00:00:00Z',fetchPage:async url=>({status:200,url,html:html(job)}),fetchJson:async()=>{throw Error('No unadvertised JSON request is permitted')},
})

test('MOVE binds only the own full native role brand, reviewed employer and current account',async()=>{
 const native=parse(),jobs=await run()
 assert.equal(jobs.length,1)
 assert.deepEqual(native.record,record)
 assert.equal(native.employer.name,record.companyName)
 assert.deepEqual(jobs[0].nativeHiringOrganization,{name:record.companyName})
 assert.deepEqual(jobs[0].nativeEmployerBinding,{method:'explicit-native-role-company-brand',field:'companyBrand',value:'MOVE',
  refNum:'AIRAGLOBAL',nativeEmployerField:'companyName',nativeEmployerName:record.companyName,surface:roleURL,legalEmployer:null})
 assert.equal(jobs[0].sourceScopeComplete,false)
 assert.equal(jobs[0].lifecycleCleanupAllowed,false)
})

for(const [label,changes]of [
 ['another group brand',{companyBrand:'AirAsia'}],['BigPay brand',{companyBrand:'BigPay'}],['missing brand',{companyBrand:null}],
 ['brand only in title',{companyBrand:null,title:'MOVE desktop support'}],['different employer',{companyName:'AirAsia Berhad'}],
 ['missing employer',{companyName:null}],['conflicting employer fields',{company:'Other group employer'}],
])test('MOVE rejects '+label+' without promoting group inventory',async()=>{
 const job={...record,...changes}
 assert.equal(parse(job).employerBinding,undefined)
 const jobs=await run(job)
 assert.equal(jobs.length,0)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
 assert.ok(jobs[RECRUITMENT_OBSERVATIONS].unresolved.includes('native-employer-mismatch'))
})

test('reviewed brand bindings do not waive a required native employer name match',async()=>{
 const jobs=await run(record,{requireNativeEmployerName:true})
 assert.equal(jobs.length,0)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
 assert.equal(parse(record,[]).employerBinding,undefined)
 assert.equal(parse(record,[{...provider.nativePhenomBrandEmployerBindings[0],refNum:'OTHER'}]).employerBinding,undefined)
 for(const employer of ['AirAsia Technology Center India Private Limited','ATC AirAsia Technology Center India Private Limited','AirAsia Berhad','BigPay'])
  assert.equal(recruitmentEmployerMatches(provider,employer),false)
})

for(const [label,changes]of [
 ['contradictory primary country',{standardisedCountry:'Malaysia'}],['foreign additional worksite',{multi_location:[{country:'India'},{country:'Malaysia'}]}],
 ['untyped additional worksite',{multi_location:[{city:'Bangalore'}]}],['changed account',{uniqueValue:{...record.uniqueValue,refNum:'OTHER'}}],
 ['internal publication',{visibilityType:'Internal'}],
])test('MOVE brand proof cannot bypass '+label,()=>assert.throws(()=>parse({...record,...changes}),/Phenom/))

test('a MOVE brand on an explicitly foreign role supplies no India opening',async()=>{
 const jobs=await run({...record,country:'Malaysia',standardisedCountry:'Malaysia',multi_location:[{country:'Malaysia'}]})
 assert.equal(jobs.length,0)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
})

test('Samsung accepts only reviewed native entity labels and still rejects other group businesses',()=>{
 const samsung=getScraperCatalog().find(row=>row.source==='samsungelectronics')
 assert.equal(recruitmentEmployerMatches(samsung,'Samsung R&D Institute India - Bangalore'),true)
 assert.equal(recruitmentEmployerMatches(samsung,'SAMSUNG INDIA ELECTRONICS PVT.LTD.'),true)
 for(const name of ['Samsung SDS','Samsung Life Insurance','Samsung Heavy Industries'])assert.equal(recruitmentEmployerMatches(samsung,name),false)
})
