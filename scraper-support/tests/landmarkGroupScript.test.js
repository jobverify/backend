import assert from 'node:assert/strict'
import test from 'node:test'
import {buildSearchUrl,buildJobDetailUrl,extractSearchResults,createLandmarkGroupScraper} from '../../scraper/landmarkgroup/script.js'
test('Landmark searches paginate all native ids before country decisions',()=>{
 assert.equal(buildSearchUrl(),'https://efhi.fa.em3.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=CX_1,facetsList=NONE,limit=24,offset=0')
 assert.match(buildSearchUrl({page:2,limit:10}),/limit=10,offset=20$/)
 assert.equal(buildJobDetailUrl('109999'),'https://efhi.fa.em3.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/109999')
})
test('Landmark preview records stay discovery-only and need role-native country',()=>{
 const jobs=extractSearchResults({items:[{requisitionList:[{Id:'109999',Title:'Engineer',PrimaryLocationCountry:'IN',PrimaryLocation:'India',PostedDate:'2026-07-10',JobType:'Professional',ShortDescriptionStr:'Preview only.',secondaryLocations:[{Name:'Bengaluru, India',CountryCode:'IN'}]},{Id:'110000',Title:'City hint only',PrimaryLocation:'Bengaluru, India'}]}]})
 assert.equal(jobs.length,1);assert.equal(jobs[0].requisitionId,null);assert.equal(jobs[0].employmentType,null);assert.equal(jobs[0].postingDate,null);assert.equal(jobs[0].sourceDetailComplete,false)
})
test('Landmark does not treat current careers or native API errors as an empty board',async()=>{
 const urls=[];await assert.rejects(createLandmarkGroupScraper({fetchPage:async url=>{urls.push(url);return{status:429,url,body:'Too many requests'}}}).run(),/HTTP 429/)
 assert.deepEqual(urls,['https://www.landmarkgroup.com/careers'])
})
