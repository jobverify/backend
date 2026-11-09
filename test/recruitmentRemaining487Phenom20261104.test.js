import assert from 'node:assert/strict'
import test from 'node:test'
import {createVerifiedRecruitmentScraper} from '../scraper-support/utils/verifiedRecruitment.js'

const root='https://example.test/global/en/search-results'
const config={widgetApiEndpoint:'https://example.test/widgets',country:'global',deviceType:'desktop',locale:'en_global',refNum:'EXAMPLE1',baseUrl:'https://example.test/global/en/',baseDomain:'https://example.test',pageName:'search-results',siteType:'external'}
const siteConfig={status:'success',data:{refNum:'EXAMPLE1',urlMap:{'search-results':'search-results',job:'job/:jobId/:title'}}}
const description='<p>Develop reliable production services, work with engineers on technical designs, investigate incidents and improve the performance and availability of distributed systems.</p>'
const listing={jobId:'R1',title:'Engineer',country:'IND',siteType:'external',visibilityType:'External'}
const role={...listing,companyName:'Example',description,standardisedCountry:'India',city:'Bangalore',uniqueValue:{jobId:'R1',refNum:'EXAMPLE1',siteType:'external'}}
const html=(config,ddo)=>`<h1>Example Careers</h1><script>var phApp=${JSON.stringify(config)};phApp.ddo=${JSON.stringify(ddo)}</script>`

async function run({country='IND',standardisedCountry='India',facets={IND:1,'United States':10},listedCountry='IND',record={},statement,supplemental=false,stopAfterNativeIndiaLimit=false}={}){
 const queries=[],requests=[]
 const jobs=await createVerifiedRecruitmentScraper({source:'example',companyName:'Example',nativeEmployerNames:['Example Services'],requireNativeEmployerName:true,nativeEmployerStatement:statement,stopAfterNativeIndiaLimit,companyDomain:'example.test',companyCareerPage:root,discoverLiteralRecruitmentData:true,prioritizeRecruitmentSearch:true}).run({maxDetails:supplemental?1:20,
  fetchPage:async url=>({status:200,url,html:url===root?html(config,{siteConfig,eagerLoadRefineSearch:{status:200,totalHits:11,data:{jobs:[],aggregations:[{field:'country',value:facets}]}}})+(supplemental?'<a href="https://example.wd1.myworkdayjobs.com/Careers">Other careers board</a>':''):html({...config,pageName:'job'},{siteConfig,jobDetail:{status:200,hits:1,totalHits:1,data:{job:{...role,country,standardisedCountry,...record}}}})}),
  fetchJson:async(url,init)=>{requests.push(url);queries.push(JSON.parse(init.body));if(!url.endsWith('/widgets'))throw Error('Supplementary board unavailable');return {refineSearch:{status:200,totalHits:1,data:{jobs:[{...listing,country:listedCountry}]}}}}
 }).catch(e=>{if(e.failureKind==='coverage_gap')return [];throw e})
 return {jobs,queries,requests}
}

test('Phenom reads a published ISO IND country facet and binds its own full native India role',async()=>{
 const {jobs,queries}=await run()
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].country,'India')
 assert.equal(jobs[0].nativeSourceRecord.country,'IND')
 assert.equal(jobs[0].sourceDescription,description)
 assert.deepEqual(queries[0].selected_fields,{country:['IND']})
})

for(const [label,options]of [
 ['foreign detail',{country:'US',standardisedCountry:'United States'}],
 ['unknown detail',{country:'Bangalore',standardisedCountry:undefined}],
 ['conflicting native country',{standardisedCountry:'United States'}],
 ['foreign listing',{listedCountry:'United States'}],
 ['missing published India country facet',{facets:{'United States':11}}],
 ['ambiguous published India country facets',{facets:{IND:1,India:1}}],
])test('Phenom ISO country support rejects '+label,async()=>{
 const {jobs}=await run(options)
 assert.equal(jobs.length,0)
})

const statement={name:'Example Services',prefix:'Example Services has established a global ERP Shared Line of Service'}
const declaredDescription=`<p>${statement.prefix}, bringing engineers together to build production systems.</p>${description}`
test('an exact reviewed employer declaration in the own native role can fill an absent structured employer',async()=>{
 const {jobs}=await run({statement,record:{companyName:'',description:declaredDescription}})
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].nativeHiringOrganization.name,'Example Services')
 assert.equal(jobs[0].nativeEmployerBinding.method,'explicit-native-role-employer-statement')
 assert.equal(jobs[0].sourceDescription,declaredDescription)
})
for(const [label,change]of [
 ['different explicit employer',{companyName:'Other',description:declaredDescription}],
 ['quoted declaration',{description:`<blockquote>${declaredDescription}</blockquote>${description}`}],
 ['hidden declaration',{description:`<div hidden>${declaredDescription}</div>${description}`}],
 ['template declaration',{description:`<template>${declaredDescription}</template>${description}`}],
 ['unreviewed employer phrase',{description:`<p>Example Services provides software for other employers.</p>${description}`}],
 ['held native role',{description:declaredDescription,atsStatus:'On Hold'}],
])test('native employer declaration cannot qualify a '+label,async()=>{
 const {jobs}=await run({statement,record:{companyName:'',...change}})
 assert.equal(jobs.length,0)
})

test('an opted-in source stops supplementary boards after reaching its verified native India role limit',async()=>{
 const {jobs,requests}=await run({supplemental:true,stopAfterNativeIndiaLimit:true})
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].sourceScopeComplete,false)
 assert.equal(jobs[0].lifecycleCleanupAllowed,false)
 assert.deepEqual(requests,['https://example.test/widgets'])
 const control=await run({supplemental:true})
 assert.ok(control.requests.some(url=>url.includes('myworkdayjobs.com')))
})
