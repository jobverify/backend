import assert from 'node:assert/strict'
import test from 'node:test'
import { createVerifiedRecruitmentScraper, RECRUITMENT_OBSERVATIONS } from '../scraper-support/utils/verifiedRecruitment.js'
import { recruitmentSuccessFactorsPostings } from '../scraper-support/utils/recruitmentSuccessFactors.js'
import { readNativeDocument } from '../scraper-support/utils/activeNativeHtml.js'
const source = {source:'example',companyName:'Example',companyDomain:'example.test',companyCareerPage:'https://example.test/careers',prioritizeRecruitmentSearch:true,requireCorporateIdentityMatch:true}
const roleURL = 'https://example.test/job/Bengaluru-Engineer/123456/'
const description = 'Develop reliable production software services, review technical designs, collaborate with the engineering team and investigate operational failures to improve performance and availability.'
const role = ({country='IN',employer='Example',extra='',body=description}={}) => `<title>Example Careers</title><div class="jobDisplayShell" itemscope><h1><span itemprop="title" data-careersite-propertyid="title">Software Engineer</span></h1><span itemprop="description" data-careersite-propertyid="description">${body}</span><span data-careersite-propertyid="country">${country}</span><span data-careersite-propertyid="city">Bengaluru</span>${employer===null?'':`<span data-careersite-propertyid="company">${employer}</span>`}<span data-careersite-propertyid="date">Nov 3, 2026</span><span data-careersite-propertyid="shifttype">Full time</span>${extra}</div>`
const run = (content=role(),config=source) => createVerifiedRecruitmentScraper(config).run({now:()=> '2026-11-04T00:00:00Z', fetchPage:async url=>({status:200,url,html:url===roleURL?content:`<h1>Example Careers</h1><a href="${roleURL}">Software Engineer</a>`})})

test('reads own visible native role properties when the RMK shell omits itemtype', async () => {
  const jobs=await run()
  assert.equal(jobs.length,1)
  assert.equal(jobs[0].jobId,'123456')
  assert.equal(jobs[0].nativeHiringOrganization.name,'Example')
  assert.equal(jobs[0].country,'India')
  assert.equal(jobs[0].sourceDescription,description)
  assert.equal(jobs[0].postingDate,'Nov 3, 2026')
  assert.equal(jobs[0].sourceScopeComplete,false)
  assert.equal(jobs[0].lifecycleCleanupAllowed,false)
})

test('missing employer remains null under an explicit current publisher binding', async () => {
  const jobs=await run(role({employer:null}))
  assert.equal(jobs.length,1)
  assert.equal(jobs[0].nativeHiringOrganization,null)
  assert.equal(jobs[0].nativeEmployerBinding.surface,roleURL)
  assert.equal(jobs[0].nativeEmployerBinding.legalEmployer,null)
})

for(const [name,content,config] of [
  ['protected missing employer',role({employer:null}),{...source,requireNativeEmployerName:true}],
  ['foreign employer',role({employer:'Another Company'}),source],
  ['foreign country',role({country:'US'}),source],
  ['city as country',role({country:'Bengaluru'}),source],
  ['ambiguous country',role({extra:'<span data-careersite-propertyid="country">US</span>'}),source],
  ['conflicting titles',role({extra:'<span data-careersite-propertyid="title">Other Job</span>'}),source],
  ['teaser only',role({body:'Apply now'}),source],
  ['hidden whole role','<div hidden>'+role()+'</div>',source],
  ['inert whole role','<template>'+role()+'</template>',source],
]) test('does not publish '+name,async()=>{
  try{assert.equal((await run(content,config)).length,0)}catch(error){assert.equal(error.failureKind,'coverage_gap')}
})

test('nested and hidden properties cannot donate employer or country evidence', async () => {
  const content=role({employer:null,country:'' ,extra:'<aside itemscope><span data-careersite-propertyid="country">IN</span><span data-careersite-propertyid="company">Example</span></aside><span hidden data-careersite-propertyid="country">IN</span>'})
  const jobs=await run(content)
  assert.equal(jobs.length,0)
  assert.ok(jobs[RECRUITMENT_OBSERVATIONS].unresolved.includes('native-location-scope-unresolved'))
})

test('a native schema JobPosting is left to its existing parser',()=>{
  const doc=readNativeDocument(role().replace('itemscope','itemscope itemtype="https://schema.org/JobPosting"'))
  assert.deepEqual(recruitmentSuccessFactorsPostings(doc,roleURL),[])
})

test('multiple unrelated role shells and non-role pages are not an own role contract',()=>{
  assert.deepEqual(recruitmentSuccessFactorsPostings(readNativeDocument(role()+role()),roleURL),[])
  assert.deepEqual(recruitmentSuccessFactorsPostings(readNativeDocument(role()),'https://example.test/careers'),[])
})
