import assert from 'node:assert/strict'
import test from 'node:test'
globalThis.fetch=()=>{throw Error('Offline test network tripwire')}
const load=()=>import('../../scraper/landmarkgroup/peopleStrongNative.js')
const listing={jobCode:'LAMG/SAM/1896692',jobTitle:'Store Admin Manager',jobDetailUrl:'https://careers-landmarkgroupindia.peoplestrong.com/job/detail/LAMG_SAM_1896692',jobPostedDate:'2026-10-26',jobClosureDate:'2026-11-09'}
const detail={requisitionId:'1896692',requisitionCode:'LAMG/SAM/1896692',jobTitle:'Store Admin Manager',entityID:'1605',hrOrgUnitID:'38062269',worksiteID:'1604142',CandidatePortalStartDate:'2026-10-26 00:00:00.0',CandidatePortalEndDate:'2026-11-09 00:00:00.0',jobDescription:'<p>Drive retail operations &amp; standards.</p><p>Maintain inventory records.</p>',internalJobDescription:'',skills:[{text:'Operations Management',mandatory:false}],qualifications:['B.Com.'],languages:['English','Kannada'],certifications:[],minimumExp:'4',maximumExp:'6',employmentType:'Regular',requisitionStatus:'OPEN',joiningLocation:'Mysore'}
const org={orgUnitHierarchy:[{orgUnitType:'Business Unit',orgUnitName:'Lifestyle'},{orgUnitType:'Company Name',orgUnitName:'Lifestyle International Private Limited'},{orgUnitType:'Group',orgUnitName:'Landmark Group'}],workSiteHierarchy:[{orgUnitType:'Work Location',orgUnitName:'Forum Centre City Mysore LS'},{orgUnitType:'Location Type',orgUnitName:'Store'},{orgUnitType:'City',orgUnitName:'Mysore'},{orgUnitType:'State',orgUnitName:'Karnataka'},{orgUnitType:'Company',orgUnitName:'Lifestyle International Private Limited'},{orgUnitType:'Group Name',orgUnitName:'Landmark Group'}]}
test('Landmark full PeopleStrong detail preserves criteria and certifies the exact job-bound city/state pair',async()=>{
 const {mapPeopleStrongRole}=await load(),r=mapPeopleStrongRole(listing,detail,org,{now:'2026-10-27T00:00:00Z'})
 assert.equal(r.jobId,'LAMG/SAM/1896692');assert.equal(r.requisitionId,'1896692');assert.equal(r.requisitionCode,listing.jobCode);assert.equal(r.applyUrl,listing.jobDetailUrl)
 assert.equal(r.brand,'Lifestyle');assert.equal(r.nativeRoleCompany,'Lifestyle International Private Limited');assert.equal(r.legalEmployer,null)
 assert.equal(r.country,'India');assert.equal(r.sourceLocationCorroborationComplete,true);assert.equal(r.sourceDetailComplete,true)
 assert.equal(r.postingDate,'2026-10-26');assert.equal(r.closingDate,'2026-11-09');assert.equal(r.sourceClosingDateIsExact,false)
 for(const text of ['Drive retail operations & standards.','Maintain inventory records.','B.Com.','Operations Management','English','Kannada'])assert.ok(r.sourceDescription.includes(text))
 assert.deepEqual(r.nativeSkills,detail.skills);assert.equal(r.employmentType,'Regular');assert.equal(r.workMode,null);assert.equal(r.experienceRequired,'4 - 6 years')
})
test('country evidence rejects missing, ambiguous and contradictory native worksite ancestry',async()=>{
 const {classifyPeopleStrongWorksite}=await load(),hierarchy=[{orgUnitType:'Work Location',orgUnitName:'Forum Centre City Mysore LS'},{orgUnitType:'Location Type',orgUnitName:'Store'},{orgUnitType:'City',orgUnitName:'Mysore'},{orgUnitType:'State',orgUnitName:'Karnataka'}]
 const classify=(nodes,d=detail)=>classifyPeopleStrongWorksite({detail:d,organizationRequestJobCode:detail.requisitionCode,workSiteHierarchy:nodes})
 assert.equal(classify(hierarchy).country,'India')
 for(const nodes of [hierarchy.filter(x=>x.orgUnitType!=='State'),[...hierarchy,{orgUnitType:'State',orgUnitName:'Punjab'}],hierarchy.map(x=>x.orgUnitType==='State'?{...x,orgUnitName:'Punjab'}:x),hierarchy.map(x=>x.orgUnitType==='State'?{...x,orgUnitName:'Punjab'}:x.orgUnitType==='City'?{...x,orgUnitName:'Lahore'}:x),[...hierarchy,{orgUnitType:'Country',orgUnitName:'Pakistan'}]])assert.equal(classify(nodes).country,null)
 assert.equal(classify(hierarchy,{...detail,worksiteID:null}).country,null)
 assert.equal(classify(hierarchy,{...detail,countryCode:'PK'}).country,null)
 assert.equal(classifyPeopleStrongWorksite({detail,organizationRequestJobCode:'OTHER/1',workSiteHierarchy:hierarchy}).country,null)
})
test('Bangalore Corporate country inference requires the observed exact corporate office guard',async()=>{
 const {classifyPeopleStrongWorksite}=await load(),base=[{orgUnitType:'Work Location',orgUnitName:'Corporate Office Easy Buy'},{orgUnitType:'Location Type',orgUnitName:'Corporate'},{orgUnitType:'City',orgUnitName:'Bangalore Corporate'},{orgUnitType:'State',orgUnitName:'Karnataka'}],classify=workSiteHierarchy=>classifyPeopleStrongWorksite({detail,organizationRequestJobCode:detail.requisitionCode,workSiteHierarchy})
 assert.equal(classify(base).country,'India')
 assert.equal(classify(base.map(x=>x.orgUnitType==='Location Type'?{...x,orgUnitName:'Store'}:x)).country,null)
 assert.equal(classify(base.map(x=>x.orgUnitType==='Work Location'?{...x,orgUnitName:'Some Office'}:x)).country,null)
})
test('PeopleStrong conflicting requisition, native date or application identity is rejected',async()=>{
 const {mapPeopleStrongRole}=await load()
 for(const change of [{requisitionCode:'OTHER/1'},{CandidatePortalStartDate:'2026-10-25 00:00:00.0'},{jobTitle:'Different role'}])assert.throws(()=>mapPeopleStrongRole(listing,{...detail,...change},org),/identity|date|publication/)
 assert.throws(()=>mapPeopleStrongRole({...listing,jobDetailUrl:'https://unrelated.example/job/1'},detail,org),/application/)
})
test('unhandled full-detail styling stays partial and raw public criteria remain preserved',async()=>{
 const {mapPeopleStrongRole}=await load(),r=mapPeopleStrongRole(listing,{...detail,jobDescription:'<style>.hidden{display&#58;none}</style><p class="hidden">SECRET</p>'},org)
 assert.equal(r.sourceDetailComplete,false);assert.ok(!r.sourceDescription.includes('SECRET'));assert.ok(r.nativePublicFields.jobDescription.includes('SECRET'))
})
