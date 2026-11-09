import assert from 'node:assert/strict'
import test from 'node:test'
import {buildSearchUrl,buildJobDetailUrl,extractSearchResults,createArcelorMittalScraper} from '../../scraper/arcelormittal/script.js'
test('Arcelor searches paginate unfiltered native ids',()=>{
 assert.equal(buildSearchUrl(),'https://emfg.fa.em4.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=CX_4001,facetsList=NONE,limit=24,offset=0')
 assert.match(buildSearchUrl({page:2,limit:10}),/limit=10,offset=20$/)
 assert.equal(buildJobDetailUrl('33845'),'https://emfg.fa.em4.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_4001/job/33845')
})
test('Arcelor listing discovery cannot invent requisition, contract, publication or full-detail facts',()=>{
 const jobs=extractSearchResults({items:[{requisitionList:[{Id:'33845',Title:'Automation Engineer',PrimaryLocationCountry:'IN',PrimaryLocation:'Pune, Maharashtra, India',PostedDate:'2026-07-01',StudyLevel:'Bachelor degree',ShortDescriptionStr:'Preview only.'},{Id:'33846',Title:'US Role',PrimaryLocationCountry:'US',PrimaryLocation:'Chicago'}]}]})
 assert.equal(jobs.length,1);assert.equal(jobs[0].requisitionId,null);assert.equal(jobs[0].employmentType,null);assert.equal(jobs[0].postingDate,null);assert.equal(jobs[0].sourceDetailComplete,false);assert.equal(jobs[0].sourceListingComplete,false)
})
test('Arcelor denial is an error, never an empty India result',async()=>{
 const urls=[];await assert.rejects(createArcelorMittalScraper({fetchPage:async url=>{urls.push(url);return{status:403,url,body:'<title>Just a moment...</title>'}}}).run(),/HTTP 403/)
 assert.deepEqual(urls,['https://corporate.arcelormittal.com/careers'])
})
