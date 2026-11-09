import assert from 'node:assert/strict'
import test from 'node:test'
import {createVerifiedRecruitmentScraper,RECRUITMENT_OBSERVATIONS} from '../scraper-support/utils/verifiedRecruitment.js'
import {readJibeRecruitment} from '../scraper-support/utils/recruitmentJibe.js'

const origin='https://careers.example.test',root=origin+'/jobs'
const client='https://app.jibecdn.com/prod/search/4.11.225/main.js'
const script='class SearchService { search(params){ return this.http.get("/api/jobs",{params}); } searchJobBySlug(slug,language){return this.http.get(`api/jobs/${slug}/${language}`)} getJobDescriptionUrl(job){ return `/jobs/${job.slug}?lang=${job.language}`; }}'
const settings={path:'/jobs',locale:'en-US',numRowsPerPage:10,externalSearch:true,isLoggedIn:false,jobDescriptionAtsOverride:false,contextSettings:{currentContext:''}}
const html=(config=settings,account={cid:'example'})=>`<title>Example Careers</title><script>window._jibe=${JSON.stringify(account)};window.searchConfig=${JSON.stringify(config)};</script><script src="${client}"></script>`
const description='<p>Design production services, work with engineers on technical designs, investigate incidents and improve the reliability and performance of software used by customers.</p>'
const record={slug:'1001',req_id:'R1001',title:'Engineer',country:'India',country_code:'IN',city:'Pune',hiring_organization:'Example',description,responsibilities:'<p>Maintain the production platform.</p>',qualifications:'<p>Professional engineering experience.</p>',language:'en-us',internal:false,external:false,searchable:true,applyable:true,meta_data:{client_code:'example',icims:{jps_is_public:true}},apply_url:'https://example.icims.com/jobs/1001/login',posted_date:'2026-11-01T08:00:00+0000'}
async function run({page=html(),native=record,detail,bodyScript=script,payload,status=200,detailStatus=200,enabled=true}={}){
 const calls=[]
 const jobs=await createVerifiedRecruitmentScraper({source:'example',companyName:'Example',companyDomain:'example.test',companyCareerPage:root,officialHomepageUrl:root,
  requireCorporateIdentityMatch:true,requireNativeEmployerName:true,prioritizeRecruitmentSearch:true,discoverJibeRecruitmentData:enabled}).run({
  fetchPage:async url=>{calls.push(url);return {url,status:200,html:url===client?bodyScript:page,contentType:url===client?'application/javascript':'text/html'}},
  fetchJson:async url=>{calls.push(url);const u=new URL(url);assert.equal(u.origin,origin);if(u.pathname!=='/api/jobs'){assert.equal(u.pathname,'/api/jobs/'+native.slug+'/'+native.language);if(detailStatus!==200)throw Error('Recruitment HTTP '+detailStatus);return detail===undefined?native:detail}assert.equal(u.searchParams.get('country'),'India');assert.equal(u.searchParams.get('lang'),'en-US');if(status!==200)throw Error('Recruitment HTTP '+status);return payload||{jobs:[{data:native}],totalCount:1,count:1}}
 }).catch(error=>{if(error.failureKind==='coverage_gap')return [];throw error})
 return {jobs,calls}
}

test('an opted-in current Jibe account exposes its own public India records and complete native sections',async()=>{
 const {jobs,calls}=await run()
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].country,'India')
 assert.equal(jobs[0].jobId,'R1001')
 assert.equal(jobs[0].sourceUrl,origin+'/jobs/1001?lang=en-us')
 assert.equal(jobs[0].applyUrl,record.apply_url)
 assert.equal(jobs[0].sourceDescription,[description,record.responsibilities,record.qualifications].join('\n'))
 assert.equal(jobs[0].nativeSourceRecord.row.data.country,'India')
 assert.equal(jobs[0].nativeHiringOrganization.name,'Example')
 assert.equal(jobs[0].sourceScopeComplete,false)
 assert.equal(jobs[0].lifecycleCleanupAllowed,false)
 assert.equal(jobs[0].applicationVisited,false)
 assert.equal(calls.filter(url=>url.includes('icims.com')).length,0)
 assert.ok(calls.includes(origin+'/api/jobs/1001/en-us'))
})

for(const [label,change]of [
 ['foreign country',{country:'United States',country_code:'US'}],['conflicting own countries',{country_code:'US'}],
 ['unknown own country',{country:'Pune',country_code:undefined}],['unknown own country code',{country_code:'XX'}],
 ['other native employer',{hiring_organization:'Other Employer'}],['missing native employer',{hiring_organization:''}],
 ['internal record',{internal:true}],['not searchable',{searchable:false}],['not applyable',{applyable:false}],
 ['private posting',{meta_data:{client_code:'example',icims:{jps_is_public:false}}}],
 ['other native account',{meta_data:{client_code:'other',icims:{jps_is_public:true}}}],
 ['conflicting native accounts',{client_code:'other'}],['missing native account',{meta_data:{icims:{jps_is_public:true}}}],
 ['invalid native country type',{country_code:123}],['unsafe application origin',{apply_url:'https://127.0.0.1/jobs/1001/login'}],
 ['other application role',{apply_url:'https://example.icims.com/jobs/9999/login'}],
 ['missing description',{description:null,responsibilities:null,qualifications:null}],['teaser',{description:'Apply now',responsibilities:null,qualifications:null}],
 ['unsafe public role slug',{slug:'../apply'}],['unsupported language',{language:'en-US&other=account'}],
 ['expired publication',{posting_expiry_date:'2020-01-01'}],
])test('Jibe own native qualification rejects '+label,async()=>{assert.equal((await run({native:{...record,...change}})).jobs.length,0)})

for(const [label,options]of [
 ['unreviewed source',{enabled:false}],['hidden configuration',{page:'<div hidden>'+html()+'</div>'}],
 ['quoted client route',{bodyScript:'var sample='+JSON.stringify(script)}],
 ['different client endpoint',{bodyScript:script.replace('/api/jobs','https://other.test/api/jobs')}],
 ['different client publisher',{page:html().replace('app.jibecdn.com','app.jibecdn.com.other.test')}],
 ['internal portal',{page:html({...settings,externalSearch:false})}],['authenticated portal',{page:html({...settings,isLoggedIn:true})}],
 ['unsupported external role route',{page:html({...settings,jobDescriptionAtsOverride:true})}],
 ['error envelope',{payload:{error:'unavailable'}}],['denied search',{status:403}],
])test('Jibe discovery rejects '+label,async()=>{assert.equal((await run(options)).jobs.length,0)})

test('an empty Jibe India candidate search does not assert a complete empty company inventory',async()=>{
 const {jobs}=await run({payload:{jobs:[],count:0,totalCount:0}})
 assert.equal(jobs.length,0)
 assert.equal(jobs[RECRUITMENT_OBSERVATIONS].sourceScopeComplete,false)
})

for(const [label,change]of [
 ['different native role',{req_id:'OTHER'}],['different native slug',{slug:'9999'}],['changed native title',{title:'Other Engineer'}],
 ['other detail country',{country:'United States',country_code:'US'}],['missing detail country',{country:undefined,country_code:undefined}],
 ['changed detail employer',{hiring_organization:'Other'}],['private detail',{meta_data:{client_code:'example',icims:{jps_is_public:false}}}],
 ['inactive detail',{applyable:false}],['other detail account',{meta_data:{client_code:'other'}}],
 ['empty detail description',{description:'Apply now',responsibilities:null,qualifications:null}],
])test('Jibe listing cannot substitute for a '+label,async()=>{assert.equal((await run({detail:{...record,...change}})).jobs.length,0)})
test('a denied Jibe detail cannot yield an India role',async()=>{assert.equal((await run({detailStatus:403})).jobs.length,0)})

test('the declared Jibe client default description route works without an optional override flag',async()=>{
 const {jobDescriptionAtsOverride,...config}=settings
 assert.equal((await run({page:html(config)})).jobs.length,1)
})

async function readPages({pages,details={}}){
 const calls=[],jobs=[],issues=[],failures=[]
 await readJibeRecruitment({clientURL:client,origin,cid:'example',pageURL:root,rolePrefix:'/jobs/',pageSize:1,locale:'en-US'},{
  permit:()=>{},readRenderer:async()=>({html:script}),maxPages:4,maxDetails:4,canRead:()=>true,inventoryRead:()=>{},recordRead:()=>{},
  unresolved:v=>issues.push(v),problem:(stage,e)=>failures.push({stage,message:e.message}),addJob:j=>jobs.push(j),
  readJson:async url=>{calls.push(url);const u=new URL(url);if(u.pathname==='/api/jobs')return pages[Number(u.searchParams.get('page'))-1];const d=details[u.pathname];if(d instanceof Error)throw d;return d||record},
 })
 return {calls,jobs,issues,failures}
}
test('Jibe retains an earlier verified role and stops native detail reads after HTTP 403',async()=>{
 const second={...record,req_id:'R1002',slug:'1002'},third={...record,req_id:'R1003',slug:'1003'}
 const {calls,jobs,issues}=await readPages({pages:[{jobs:[{data:record}],totalCount:3},{jobs:[{data:second}],totalCount:3},{jobs:[{data:third}],totalCount:3}],details:{'/api/jobs/1002/en-us':Error('Recruitment HTTP 403')}})
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].id,'R1001')
 assert.ok(issues.includes('native-jibe-public-detail-unavailable'))
 assert.equal(calls.some(url=>url.includes('page=3')||url.includes('/1003/')),false)
})
test('a repeated Jibe page stops without duplicating previously verified roles',async()=>{
 const {calls,jobs,issues}=await readPages({pages:[{jobs:[{data:record}],totalCount:3},{jobs:[{data:record}],totalCount:3}]})
 assert.equal(jobs.length,1)
 assert.ok(issues.includes('native-jibe-pagination-repeated-role'))
 assert.equal(calls.some(url=>url.includes('page=3')),false)
})
test('Jibe rejects changing inventory totals',async()=>{
 await assert.rejects(readPages({pages:[{jobs:[{data:record}],totalCount:3},{jobs:[],totalCount:4}]}),/native total changed/)
})
