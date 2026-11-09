import assert from 'node:assert/strict'
import test from 'node:test'
import {createVerifiedRecruitmentScraper} from '../scraper-support/utils/verifiedRecruitment.js'

const origin='https://careers.example.test',root=origin+'/search/'
const manager=origin+'/platform/js/j2w/min/j2w.searchManager.min.js?h=current'
const renderer=origin+'/platform/js/j2w/min/j2w.searchResultsUnify.min.js?h=current'
const endpoint=origin+'/services/recruiting/v1/jobs'
const description='Design production software, work with engineers to implement reliable services, investigate operational incidents, improve performance and maintain automated deployment systems.'
const client='j2w.SearchManager=function(){var search=function(b){jQuery.ajax({type:"POST",url:"/services/recruiting/v1/jobs",data:JSON.stringify(b)})};return {search:search}}();'
const view='j2w.SearchResultsUnify=function(){return {render:function(a){return "/job/"+a.unifiedStandardTitle+"/"+a.id+"-"+resultStyles.currentLocale}}}();'
const listing={id:'123456',unifiedStandardTitle:'Engineer',unifiedUrlTitle:'Engineer',supportedLocales:['en_US']}
const field=(label,value)=>`<div class="joblayouttoken"><div><span class="joblayouttoken-label">${label}:</span><span class="rtltextaligneligible">${value}</span></div></div>`
const role=(options={})=>`<title>Example Careers</title><div class="jobDisplayShell" itemscope itemtype="http://schema.org/JobPosting"><h1><span itemprop="title">${options.title||'Engineer'}</span></h1><div class="joblayouttoken"><span itemprop="description">${description}</span></div><div class="joblayouttoken"><span itemprop="description">Collaborate with our engineering team and maintain our production platform.</span></div>${options.fields??field('Requisition ID','123456')+field('Job Country','India')+field('Posting City','Pune')}</div>`
const search=`<title>Example Careers</title><div id="jobSearch_current"></div><script>if(typeof resultStyles === 'undefined'){var resultStyles={companyId:'EXAMPLE',currentLocale:'en_US',defaultLocale:'en_US'};}</script><script src="${manager}"></script><script src="${renderer}"></script>`
async function run({searchHTML=search,managerJS=client,rendererJS=view,detailHTML=role(),response={totalJobs:1,jobSearchResult:[{response:listing}]},protectedEmployer=false}={}){
 const requests=[];let observations
 const jobs=await createVerifiedRecruitmentScraper({source:'example',companyName:'Example',companyDomain:'example.test',officialHomepageUrl:root,companyCareerPage:root,requireCorporateIdentityMatch:true,requireNativeEmployerName:protectedEmployer,prioritizeRecruitmentSearch:true}).run({
  fetchPage:async url=>{requests.push(url);return {status:200,url,contentType:[manager,renderer].includes(url)?'application/javascript':'text/html',html:url===root?searchHTML:url===manager?managerJS:url===renderer?rendererJS:detailHTML}},
  fetchJson:async(url,init)=>{requests.push(url);assert.equal(url,endpoint);assert.equal(init.method,'POST');assert.deepEqual(JSON.parse(init.body),{keywords:'',locale:'en_US',location:'India',pageNumber:0,sortBy:'recent'});return response}
 }).catch(e=>{if(e.failureKind==='coverage_gap'){observations=e.recruitmentObservations;return []}throw e})
 return {jobs,requests,observations:observations||jobs[Symbol.for('jobverify.verified-recruitment-observations')]}
}

test('reads a current SAP public search client and verifies the complete own visible role',async()=>{
 const {jobs,requests}=await run()
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].country,'India')
 assert.equal(jobs[0].jobId,'123456')
 assert.ok(jobs[0].sourceDescription.includes(description))
 assert.ok(jobs[0].sourceDescription.includes('Collaborate with our engineering team'))
 assert.ok(requests.includes(endpoint))
 assert.equal(jobs[0].sourceScopeComplete,false)
 assert.equal(jobs[0].lifecycleCleanupAllowed,false)
})

for(const [label,options]of [
 ['foreign country',{detailHTML:role({fields:field('Requisition ID','123456')+field('Job Country','United States')})}],
 ['missing own country',{detailHTML:role({fields:field('Requisition ID','123456')+field('Posting City','Pune')})}],
 ['conflicting own countries',{detailHTML:role({fields:field('Requisition ID','123456')+field('Job Country','India')+field('Job Country','United States')})}],
 ['hidden own country',{detailHTML:role({fields:field('Requisition ID','123456')+'<div hidden>'+field('Job Country','India')+'</div>'})}],
 ['nested-scope country',{detailHTML:role({fields:field('Requisition ID','123456')+'<div itemscope>'+field('Job Country','India')+'</div>'})}],
 ['wrong detail requisition',{detailHTML:role({fields:field('Requisition ID','999999')+field('Job Country','India')})}],
 ['changed detail title',{detailHTML:role({title:'Other Engineer'})}],
 ['protected brand with no exact role employer',{protectedEmployer:true}],
 ['different explicit role employer',{detailHTML:role({fields:field('Requisition ID','123456')+field('Job Country','India')+'<div itemprop="hiringOrganization" itemscope><span itemprop="name">Other Employer</span></div>'})}],
 ['conflicting structured role country',{detailHTML:role({fields:field('Requisition ID','123456')+field('Job Country','India')+'<div itemprop="jobLocation" itemscope><div itemprop="address" itemscope><span itemprop="addressCountry">United States</span></div></div>'})}],
 ['search error envelope',{response:{status:403,error:'denied',totalJobs:0}}],
 ['missing native client declaration',{searchHTML:search.replace(`<script src="${manager}"></script>`,'')}],
 ['quoted client declaration',{managerJS:'var example='+JSON.stringify(client)}],
 ['other native endpoint',{managerJS:client.replace('/services/recruiting/v1/jobs','https://other.test/jobs')}],
 ['different explicit listing legal employer',{response:{totalJobs:1,jobSearchResult:[{response:{...listing,legalEntity_obj:['Other Employer']}}]}}],
 ['ambiguous listing legal employer',{response:{totalJobs:1,jobSearchResult:[{response:{...listing,legalEntity_obj:['Example','Other Employer']}}]}}],
 ['non-search POST',{managerJS:client.replace('type:"POST"','type:"DELETE"')}],
 ['hidden widget',{searchHTML:'<div hidden>'+search+'</div>'}],
 ['unexecuted configuration',{searchHTML:search.replace("if(typeof resultStyles === 'undefined')",'function example()')}],
 ['inactive configuration',{searchHTML:search.replace("if(typeof resultStyles === 'undefined')",'if(false)')}],
])test('SAP unified collection rejects '+label,async()=>{
 const {jobs}=await run(options)
 assert.equal(jobs.length,0)
})

test('a native zero candidate search remains an incomplete source check',async()=>{
 for(const response of [{totalJobs:0,jobSearchResult:[]},{totalJobs:0}]){
  const {jobs,observations}=await run({response})
  assert.equal(jobs.length,0)
  assert.equal(observations.nativeInventoryReads[0].reportedTotal,0)
  assert.equal(observations.sourceScopeComplete,false)
 }
})

const locationListing={...listing,jobLocationShort:['Pune, IND ']}
const canonicalRole=options=>`<link rel="canonical" href="${origin}/job/Engineer/123456-en_US">${role({fields:field('Posting City','Pune'),...options})}`
test('a native IND placement belongs to the exact listing whose detail declares its canonical role ID and title',async()=>{
 const {jobs}=await run({response:{totalJobs:1,jobSearchResult:[{response:locationListing}]},detailHTML:canonicalRole()})
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].nativeSourceRecord.nativeListingRecord.id,'123456')
 assert.equal(jobs[0].nativeSourceRecord.nativeListingLocationEvidence[0].rawValue,'Pune, IND ')
})
for(const [label,options]of [
 ['unknown city',{record:{...locationListing,jobLocationShort:['Paris, IND ']}}],
 ['ambiguous IN code',{record:{...locationListing,jobLocationShort:['Pune, IN ']}}],
 ['different canonical role',{detailHTML:canonicalRole().replace('href="'+origin+'/job/Engineer/123456','href="'+origin+'/job/Engineer/999999')}],
 ['missing canonical identity',{detailHTML:role({fields:field('Posting City','Pune')})}],
 ['own foreign country',{detailHTML:canonicalRole({fields:field('Job Country','United States')})}],
])test('a native listing placement cannot bypass '+label,async()=>{
 const {jobs}=await run({response:{totalJobs:1,jobSearchResult:[{response:options.record||locationListing}]},detailHTML:options.detailHTML||canonicalRole()})
 assert.equal(jobs.length,0)
})
