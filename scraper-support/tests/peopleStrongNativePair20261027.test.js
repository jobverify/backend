import assert from 'node:assert/strict'
import test from 'node:test'

// Install before importing registration or any scraper. Every test is offline.
globalThis.fetch=()=>{throw Error('OFFLINE_NETWORK_TRIPWIRE')}
const {readInventoryEvidence}=await import('../utils/inventoryEvidence.js')
const {scenario,registered}=await import('./peopleStrongNativePair20261027.fixtures.js')

for(const source of ['amararajaenergymobility','anthem'])test(source+' reads full current public details and preserves role identity/visible criteria',async()=>{
 const s=scenario(source),{jobs,report}=await registered(s)
 assert.equal(jobs.length,1)
 const j=jobs[0]
 assert.match(j.jobDescription,/Full native responsibilities & safety/)
 assert.doesNotMatch(j.jobDescription,/PREVIEW|HIDDEN|INERT|PRIVATE/)
 assert.deepEqual(j.qualifications,['B.Tech','Safety diploma'])
 assert.deepEqual(j.requiredSkills,['Process safety','CAD'])
 assert.deepEqual(j.nativeSkills,[{text:'Process safety',mandatory:true},{text:'CAD',mandatory:false}])
 assert.match(j.jobDescription,/Safety certificate/);assert.match(j.jobDescription,/English/)
 assert.equal(j.experienceRequired,'2 - 5 years')
 assert.equal(j.sourceAdditionalCriteria.Onsite,'Yes');assert.equal(j.sourceAdditionalCriteria.industry,'Manufacturing');assert.equal(j.sourceAdditionalCriteria.role,'Process Engineering')
 assert.equal(j.postingId,'P-9001');assert.equal(j.requisitionId,'1800001')
 assert.equal(j.legalEmployer,null);assert.equal(j.nativeRoleCompany,source==='anthem'?'Anthem Biosciences':'Amara Raja Energy & Mobility Limited')
 assert.equal(j.country,'India');assert.equal(j.sourceCountryEvidence.method,'native-role-requested-typed-country')
 assert.equal(j.postingDate,'2026-10-21');assert.equal(j.nativePublicationPrecision,'day');assert.equal(j.closingDate,'2026-11-30');assert.equal(j.sourceClosingDateIsExact,false)
 assert.equal(report.nativeInventoryComplete,true);assert.equal(report.fullNativeDetails,1);assert.equal(report.rawJobs,1)
 assert.equal(s.calls.filter(x=>x.url.includes('jobs/v1?')).length,4)
})

test('fully classified sibling employer is excluded while exactly bound target slice certifies zero',async()=>{
 const s=scenario('amararajaenergymobility',{mutate:({listing,detail,org})=>{listing.organizationUnit='Mangal Industries Limited';listing.organizationUnitComplete='Amara Raja Group>Mangal Industries Limited>Amara Raja Energy & Mobility Limited';detail.organizationUnitComplete=listing.organizationUnitComplete;org.orgUnitHierarchy.find(x=>x.orgUnitType==='Company Name').orgUnitName='Mangal Industries Limited'}})
 const{jobs,report}=await registered(s);assert.equal(jobs.length,0);assert.equal(report.excludedEmployerCount,1);assert.equal(report.fullNativeDetails,1);assert.equal(report.nativeGroupReportedTotal,1);assert.equal(report.derivedTargetRawJobs,0);assert.equal(report.rawJobs,0);assert.equal(report.verifiedZeroInventory,true);assert.equal(report.sourceScopeComplete,true);assert.equal(readInventoryEvidence(jobs).status,'verified-empty');assert.equal(readInventoryEvidence(jobs).reportedTotal,0);assert.equal(report.cleanupAllowed,false)
})
test('native role without typed country remains unknown despite India in listing and Bangalore city',async()=>{
 const s=scenario('anthem',{mutate:({org})=>{org.workSiteHierarchy=org.workSiteHierarchy.filter(x=>x.orgUnitType!=='Country')}})
 const{jobs,report}=await registered(s);assert.equal(jobs.length,0);assert.equal(report.unknownCountryCount,1);assert.equal(report.rawJobs,null);assert.equal(report.sourceScopeComplete,false)
})
test('maxJobs cap applies after terminal pages, full detail, and matching closing inventory',async()=>{
 const s=scenario(),{jobs,report}=await registered(s,{maxJobs:0});assert.equal(jobs.length,0);assert.equal(report.fullNativeDetails,1);assert.equal(report.nativeInventoryComplete,true);assert.equal(report.limited,true);assert.equal(s.calls.filter(x=>x.url.includes('jobs/v1?')).length,4);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('corporate advertised openings conflict with native zero stays partial and never certifies empty',async()=>{
 const s=scenario('anthem',{empty:true,corporateCount:5}),{jobs,report}=await registered(s);assert.equal(jobs.length,0);assert.equal(report.nativeInventoryComplete,true);assert.equal(report.advertisedCountMismatch,true);assert.equal(report.sourceScopeComplete,false);assert.equal(report.rawJobs,null);assert.equal(report.verifiedZeroInventory,false);assert.equal(readInventoryEvidence(jobs).status,'discovery-only')
})
test('denial stops before search, detail or any follow-on endpoint',async()=>{
 const s=scenario('anthem',{deny:'https://anthemhrcp.peoplestrong.com/'});await assert.rejects(registered(s),/403/);assert.equal(s.calls.at(-1).url,'https://anthemhrcp.peoplestrong.com/');assert.equal(s.calls.some(x=>x.url.includes('jobs/v1?')),false)
})
test('detail/request identity conflict cannot become a publishable role',async()=>{
 const s=scenario('anthem',{mutate:({detail})=>{detail.worksiteID='999'}}),{jobs,report}=await registered(s);assert.equal(jobs.length,0);assert.equal(report.failures.length,1);assert.equal(report.nativeInventoryComplete,false);assert.equal(report.rawJobs,null)
})
test('unverified initial native filter shape stops before search',async()=>{
 const s=scenario('anthem'),transport=s.fetchPage;s.fetchPage=async(url,init)=>{const r=await transport(url,init);return url.endsWith('/chunk-ZKMRUQJB.js')?{...r,body:'var i=class{constructor(){this.bandList=[99]}isFiltered(){return true}};export{i as a};'}:r}
 await assert.rejects(registered(s),/initial.*filter/i);assert.equal(s.calls.some(c=>c.url.includes('jobs/v1?')),false)
})
test('contradictory explicit country code cannot be overwritten by native worksite India',async()=>{
 const s=scenario('anthem',{mutate:({detail})=>{detail.CountryCode='US'}}),{jobs,report}=await registered(s);assert.equal(jobs.length,0);assert.equal(report.unknownCountryCount,1);assert.equal(report.sourceScopeComplete,false)
})
test('a short native inventory cannot be certified from the reported total alone',async()=>{
 const s=scenario('anthem'),transport=s.fetchPage;s.fetchPage=async(url,init)=>{const r=await transport(url,init);if(url.includes('jobs/v1?')){const p=JSON.parse(r.body);p.totalRecords=2;return{...r,body:JSON.stringify(p)}}return r}
 const{jobs,report}=await registered(s);assert.equal(jobs.length,1);assert.equal(report.nativeInventoryComplete,false);assert.equal(report.rawJobs,null);assert.equal(report.cleanupAllowed,false)
})
test('native inventory changing during closing traversal remains partial',async()=>{
 const s=scenario('anthem'),transport=s.fetchPage;let lists=0;s.fetchPage=async(url,init)=>{const r=await transport(url,init);if(url.includes('jobs/v1?')&&++lists===3){const p=JSON.parse(r.body);p.response[0].jobPostedDate='2026-10-22';return{...r,body:JSON.stringify(p)}}return r}
 const{report}=await registered(s);assert.equal(report.closingMatches,false);assert.equal(report.sourceScopeComplete,false);assert.equal(report.rawJobs,null)
})
test('cancellation interrupts a pending injected public transport without another endpoint',async()=>{
 const s=scenario('anthem'),controller=new AbortController();let calls=0;s.fetchPage=async()=>{calls++;queueMicrotask(()=>controller.abort(Error('cancelled-public-read')));return new Promise(()=>{})}
 await assert.rejects(registered(s,{signal:controller.signal,timeoutMs:30}),/cancelled-public-read/);assert.equal(calls,1)
})
test('native description projection excludes hidden/inert text and withholds unresolved CSS',async()=>{
 const{projectPeopleStrongHTML}=await import('../shared/peopleStrongNativePair20261027.js')
 assert.deepEqual(projectPeopleStrongHTML('<p>Visible &ndash; safety</p><span style="opacity:0">secret</span><script>private()</script><details><summary>Summary</summary>Collapsed</details>'),{text:'Visible – safety Summary',complete:true})
 assert.equal(projectPeopleStrongHTML('<p style="position:absolute;left:-9999px">unresolved</p>').complete,false)
})
test('modern RGB and HSL zero alpha hide text while opaque black remains visible',async()=>{
 const{projectPeopleStrongHTML}=await import('../shared/peopleStrongNativePair20261027.js')
 for(const color of ['rgb(0 0 0 / 0)','hsl(0 0% 0% / 0)','rgb(0 0 0 / 0%)','hsl(0 0% 0% / -0e0)'])assert.deepEqual(projectPeopleStrongHTML('<p style="color:'+color+'">Transparent criterion</p><p style="color:rgb(0 0 0)">Opaque black</p>'),{text:'Opaque black',complete:true},color)
 for(const color of ['rgb(0, 0, 0)','rgb(0 0 0 / 1)','hsl(0 0% 0% / 100%)'])assert.deepEqual(projectPeopleStrongHTML('<p style="color:'+color+'">Opaque black</p>'),{text:'Opaque black',complete:true},color)
})
test('case-insensitive exact country aliases cannot override a conflicting role-bound worksite country',async()=>{
 const{mapPeopleStrongPairRole}=await import('../shared/peopleStrongNativePair20261027.js')
 for(const field of ['CountryName','COUNTRYNAME','cOuNtRy','COUNTRYCODE','countryName'])for(const owner of ['listing','detail']){
  const s=scenario('anthem');s[owner][field]=field.toLowerCase()==='countrycode'?'PK':'Pakistan';const j=mapPeopleStrongPairRole('anthem',s.listing,s.detail,s.org);assert.equal(j.country,null,owner+'.'+field);assert.equal(j.sourceCountryEvidence,null)
 }
 const s=scenario('anthem');s.detail.CountryName='Pakistan';const{jobs,report}=await registered(s);assert.equal(jobs.length,0);assert.equal(report.unknownCountryCount,1);assert.equal(report.sourceScopeComplete,false)
})
test('reconciled corporate zero and complete native zero certify an empty exact tenant',async()=>{
 const s=scenario('anthem',{empty:true,corporateCount:0}),{jobs,report}=await registered(s);assert.equal(jobs.length,0);assert.equal(report.nativeInventoryComplete,true);assert.equal(report.advertisedCountMismatch,false);assert.equal(report.sourceScopeComplete,true);assert.equal(report.rawJobs,0);assert.equal(report.derivedTargetRawJobs,0);assert.equal(report.indiaJobs,0);assert.equal(report.eligibleJobs,0);assert.equal(report.verifiedZeroInventory,true);assert.equal(report.cleanupAllowed,false);assert.equal(readInventoryEvidence(jobs).status,'verified-empty');assert.equal(readInventoryEvidence(jobs).listingComplete,true)
})
test('shared group counts remain separate from exactly bound target employer counts',async()=>{
 const s=scenario(),transport=s.fetchPage,siblingListing={...s.listing,jobCode:'P-9002',jobDetailUrl:s.origin+'/job/detail/P-9002',organizationUnit:'Mangal Industries Limited',organizationUnitComplete:'Amara Raja Group>Mangal Industries Limited>Engineering'},siblingDetail={...s.detail,requisitionCode:'P-9002',requisitionId:'1800002',organizationUnitComplete:siblingListing.organizationUnitComplete},siblingOrg=structuredClone(s.org);siblingOrg.orgUnitHierarchy.find(n=>n.orgUnitType==='Company Name').orgUnitName='Mangal Industries Limited'
 s.fetchPage=async(url,init)=>{if(url.includes('/job/P-9002/')||url.endsWith('organizationDetails?jobCode=P-9002')){s.calls.push({url,method:init.method});return{status:200,url,body:JSON.stringify({messageCode:{code:200},response:url.includes('/v2?')?siblingDetail:siblingOrg})}}const r=await transport(url,init);if(url.includes('jobs/v1?')){const p=JSON.parse(r.body);p.totalRecords=2;if(p.response)p.response.push(siblingListing);return{...r,body:JSON.stringify(p)}}return r}
 const{jobs,report}=await registered(s);assert.equal(jobs.length,1);assert.equal(report.sourceScopeComplete,true);assert.equal(report.nativeInventoryComplete,true);assert.equal(report.nativeGroupReportedTotal,2);assert.equal(report.reportedNativeTotal,2);assert.equal(report.derivedTargetRawJobs,1);assert.equal(report.rawJobs,1);assert.equal(report.indiaJobs,1);assert.equal(report.excludedEmployerCount,1);assert.equal(readInventoryEvidence(jobs).reportedTotal,1)
})
test('known siblings cannot certify a target slice without exact current employer delegation',async()=>{
 const s=scenario('amararajaenergymobility',{exactEmployerDelegation:false,mutate:({listing,detail,org})=>{listing.organizationUnit='Mangal Industries Limited';listing.organizationUnitComplete='Amara Raja Group>Mangal Industries Limited>Engineering';detail.organizationUnitComplete=listing.organizationUnitComplete;org.orgUnitHierarchy.find(n=>n.orgUnitType==='Company Name').orgUnitName='Mangal Industries Limited'}}),{jobs,report}=await registered(s)
 assert.equal(jobs.length,0);assert.equal(report.nativeInventoryComplete,true);assert.equal(report.excludedEmployerCount,1);assert.equal(report.delegation.exactEmployerDelegation,false);assert.equal(report.sourceScopeComplete,false);assert.equal(report.rawJobs,null);assert.equal(report.derivedTargetRawJobs,null);assert.equal(report.verifiedZeroInventory,false);assert.equal(readInventoryEvidence(jobs).status,'discovery-only')
})
test('unbound conflicting employer hierarchy keeps a shared group target slice partial',async()=>{
 const s=scenario('amararajaenergymobility',{mutate:({org})=>{org.orgUnitHierarchy.find(n=>n.orgUnitType==='Company Name').orgUnitName='Mangal Industries Limited'}}),{jobs,report}=await registered(s);assert.equal(jobs.length,0);assert.equal(report.failures.length,1);assert.equal(report.nativeInventoryComplete,false);assert.equal(report.sourceScopeComplete,false);assert.equal(report.rawJobs,null);assert.equal(report.verifiedZeroInventory,false)
})
test('negative numeric and percent opacity clamp to invisible while positive opacity remains visible',async()=>{
 const{projectPeopleStrongHTML}=await import('../shared/peopleStrongNativePair20261027.js')
 for(const opacity of ['-1','-1%'])assert.deepEqual(projectPeopleStrongHTML('<p style="opacity:'+opacity+'">Invisible criterion</p><p style="opacity:0.5">Visible criterion</p>'),{text:'Visible criterion',complete:true},opacity)
 for(const opacity of ['1','10%'])assert.deepEqual(projectPeopleStrongHTML('<p style="opacity:'+opacity+'">Visible criterion</p>'),{text:'Visible criterion',complete:true},opacity)
 const s=scenario('anthem',{mutate:({detail})=>{detail.jobDescription='<p style="opacity:-1">Invisible criterion</p><p>Full visible public criterion</p>'}}),{jobs}=await registered(s);assert.equal(jobs.length,1);assert.doesNotMatch(jobs[0].jobDescription,/Invisible criterion/)
})
test('unsupported color function cannot certify transparent text as full public criteria',async()=>{
 const{projectPeopleStrongHTML}=await import('../shared/peopleStrongNativePair20261027.js'),html='<p style="color:color(srgb 0 0 0 / 0)">Transparent criterion</p><p>Visible criterion</p>'
 const p=projectPeopleStrongHTML(html);assert.equal(p.complete,false);assert.doesNotMatch(p.text,/Transparent criterion/)
 const s=scenario('anthem',{mutate:({detail})=>{detail.jobDescription=html}}),{jobs,report}=await registered(s);assert.equal(jobs.length,0);assert.deepEqual(report.partialDetailIds,['P-9001']);assert.equal(report.sourceScopeComplete,false)
})
test('visibility hidden ancestor with visible descendant requires unresolved cascade evidence',async()=>{
 const{projectPeopleStrongHTML}=await import('../shared/peopleStrongNativePair20261027.js'),html='<div style="visibility:hidden">Hidden criterion<span style="visibility:visible">Visible criterion</span></div>'
 assert.equal(projectPeopleStrongHTML(html).complete,false)
 assert.deepEqual(projectPeopleStrongHTML('<div style="visibility:visible"><span style="visibility:visible">Visible criterion</span></div>'),{text:'Visible criterion',complete:true})
 const s=scenario('anthem',{mutate:({detail})=>{detail.jobDescription=html}}),{jobs,report}=await registered(s);assert.equal(jobs.length,0);assert.deepEqual(report.partialDetailIds,['P-9001']);assert.equal(report.sourceScopeComplete,false)
})
