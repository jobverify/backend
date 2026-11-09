import test from 'node:test'
import assert from 'node:assert/strict'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
import {getScraperCatalog,createCatalogScraper} from '../providers/index.js'
import {readFile} from 'node:fs/promises'

const configs=[['acciojob','https://acciojob.com/','https://acciojob.keka.com/careers','7d86eeef-8f44-46cd-bc3a-2155e3ff042c','ACCIOJOB PRIVATE LIMITED'],['openfinancialtechnologies','https://open.money/company/careers','https://openfinancial.keka.com/careers/','161570d3-d2be-4e8c-b233-d006f70cd371','Open Financial Technologies']]
for(const [source,official,shell,identifier,employer] of configs) {
  test(source+' rejects unproven first-party delegation before any inventory request',async()=>{
    const calls=[]
    const provider=getScraperCatalog().find(row=>row.source===source)
    const module=await import('../../scraper/'+source+'/script.js')
    const factory=source==='acciojob'?module.createAcciojobScraper:module.createOpenFinancialTechnologiesScraper
    await assert.rejects(factory().run({requestIntervalMs:0,fetchImpl:async url=>{calls.push(url);const response=new Response('<a href="https://unrelated.keka.com/careers/">Jobs</a>',{status:200,headers:{'content-type':'text/html'}});Object.defineProperty(response,'url',{value:url});return response}}),/delegation|handoff|corporate/i)
    assert.deepEqual(calls,[official])
  })
  test(source+' stops on first public access denial without retry or private requests',async()=>{
    let calls=0
    await assert.rejects(createCatalogScraper(getScraperCatalog().find(row=>row.source===source)).run({requestIntervalMs:0,fetchImpl:async()=>{calls++;return new Response('',{status:403})}}),error=>error.status===403&&error.abortRetries===true)
    assert.equal(calls,1)
  })
}
test('native projection excludes unknown geography and never manufactures a requisition, posting date or on-site status',async()=>{
  const {projectNativeRole}=await import('../../scraper/acciojob/nativeKeka.js')
  const c={source:'acciojob',officialUrl:configs[0][1],root:'https://acciojob.keka.com/careers/',companyName:'AccioJob',employer:configs[0][4]}
  const row={id:123,title:'Engineer',description:'<p>Requirements: JavaScript. Responsibilities: build APIs.</p>',departmentName:'Engineering',jobLocations:[{id:1,name:'Bengaluru',city:'Bengaluru'}],jobType:2,experience:'2 to 4 years',salaryRangeFormat:'INR 100000',publishedOn:null,skillNames:['JavaScript']}
  const detail='<html><body><header>ACCIOJOB PRIVATE LIMITED</header><h1>Engineer</h1><div class="job-description-container"><p>Requirements: JavaScript. Responsibilities: build APIs.</p></div><div class="social-links" selectedJobId="123" selectedJobTitle="Engineer"></div><button id="apply-job">Apply for this job</button><script src="https://cdn.keka.com/careers/v/2026/scripts/app/app.min.js"></script></body></html>'
  const info={jobListingSetting:{jobFields:['location','experience','jobType','salaryRange','jobNumber']}}
  const role=projectNativeRole(row,detail,c,info,'2026-10-27T00:00:00.000Z')
  assert.equal(role.country,null);assert.equal(role.job.requisitionId,null);assert.equal(role.job.postingDate,null);assert.equal(role.job.remoteStatus,null)
  assert.match(role.job.jobDescription,/Requirements: JavaScript/);assert.match(role.job.sourceDescription,/Responsibilities: build APIs/)
  assert.equal(role.job.applyUrl,'https://acciojob.keka.com/careers/applyjob/123')
  const explicit=projectNativeRole({...row,jobLocations:[{id:1,name:'Bengaluru',city:'Bengaluru',countryCode:'IN',countryName:'India'}]},detail,c,info,'2026-10-27T00:00:00.000Z')
  assert.equal(explicit.country,'India');assert.equal(explicit.job.country,'India')
  assert.equal(projectNativeRole({...row,salaryRange:{currency:'INR',minimum:0,maximum:0}},detail,c,info,'2026-10-27T00:00:00.000Z').job.compensation,null)
  const hiddenFields=projectNativeRole({...row,publishedOn:'2026-10-26T00:00:00Z',jobNumber:'REQ123'},detail,c,{jobListingSetting:{jobFields:[]}},'2026-10-27T00:00:00.000Z')
  assert.equal(hiddenFields.country,null);assert.equal(hiddenFields.job.nativePublicationDate,null);assert.equal(hiddenFields.job.requisitionId,null);assert.deepEqual(hiddenFields.job.nativeCountryEvidence,[])
  assert.throws(()=>projectNativeRole({...row,jobLocations:[{id:1,name:'India',city:'Bengaluru',countryCode:'US',countryName:'India'}]},detail,c,info,'2026-10-27T00:00:00.000Z'),/country/i)
  assert.throws(()=>projectNativeRole(row,detail.replace('Requirements: JavaScript. Responsibilities: build APIs.','Only a teaser.'),c,info,'2026-10-27T00:00:00.000Z'),/description|criteria/i)
  assert.throws(()=>projectNativeRole(row,detail.replace('<p>Requirements:','<p hidden>Requirements:'),c,info,'2026-10-27T00:00:00.000Z'),/hidden|visibility/i)
  for(const attribute of ['style=opacity:0','style="opaci&#116;y:0"','style="op/*comment*/acity:0"','style="op\\61 city:0"','class=hidden','hidden="false"','style="font-size:0"'])assert.throws(()=>projectNativeRole(row,detail.replace('<p>Requirements:','<p '+attribute+'>Requirements:'),c,info,'2026-10-27T00:00:00.000Z'),/hidden|visibility/i)
  assert.throws(()=>projectNativeRole(row,detail.replace('<header>ACCIOJOB PRIVATE LIMITED</header>','<title>ACCIOJOB PRIVATE LIMITED</title>'),c,info,'2026-10-27T00:00:00.000Z'),/employer/i)
  assert.throws(()=>projectNativeRole(row,detail.replace('</body>','<h2>Qualifications</h2><p>Additional mandatory license.</p></body>'),c,info,'2026-10-27T00:00:00.000Z'),/criteria/i)
  assert.throws(()=>projectNativeRole({...row,eligibilityRequirements:'Never omit this'},detail,c,info,'2026-10-27T00:00:00.000Z'),/field|criteria/i)
})

// Preserve unit coverage of the exported legacy adapter separately from the
// registered current protocol, whose real captured regressions live in current.test.js.
async function legacyScraper(source){
 const config=(await import('../../scraper/'+source+'/nativeConfig.js')).default
 const {runNativeKeka}=await import('../../scraper/acciojob/nativeKeka.js')
 return {run:options=>runNativeKeka(config,options)}
}
async function transportFixture(source,{rows,closingRows=rows,changeDetail=false,infoChange=false,groupLinked=false}={}) {
  const config=(await import('../../scraper/'+source+'/nativeConfig.js')).default
  const portal=await readFile(new URL('../../scraper/'+source+'/test-fixtures/reviewed-portal.html',import.meta.url),'utf8')
  const client=await readFile(new URL('../../scraper/acciojob/test-fixtures/reviewed-embed-client.txt',import.meta.url),'utf8')
  const detailClient=await readFile(new URL('../../scraper/acciojob/test-fixtures/reviewed-detail-client.txt',import.meta.url),'utf8')
  const styles=new Map(await Promise.all(config.styles.map(async([url])=>[url,await readFile(new URL('../../scraper/'+source+'/test-fixtures/'+(url.includes('/0.0.8/')?'reviewed-embed-layout.css':'reviewed-layout.css'),import.meta.url),'utf8')])))
  const calls=[],seen=new Map(),requestedDetails=[]
  const fetchImpl=async(url,options)=>{
    calls.push({url,method:options.method});assert.equal(options.method,'GET');assert.equal(options.body,undefined)
    const count=(seen.get(url)||0)+1;seen.set(url,count)
    let body,mime='text/html'
    if(url===config.officialUrl)body='<a href="'+config.shellUrl+'">Careers</a>'
    else if(url===config.shellUrl)body='<script>fetch("'+new URL(config.documentUrl).pathname+'")</script>'
    else if(url===config.documentUrl)body=portal
    else if(url===config.root+'api/embedjobs/js/'+config.identifier){body=client;mime='text/js'}
    else if(styles.has(url)){body=styles.get(url);mime='text/css'}
    else if(url.endsWith('/careerportalinfo')){body=JSON.stringify({name:config.employer,shortName:config.employer,careersPortalDomain:new URL(config.root).hostname,jobListingSetting:{jobFields:['location','experience','jobType','jobNumber','salaryRange','dateOfPosting']},...(infoChange&&count===2?{fontFamily:'changed'}:{})});mime='application/json'}
    else if(url.includes('/grouplinkstatus/')){body=JSON.stringify({isGroupLinked:groupLinked});mime='application/json'}
    else if(url.includes('/active/')){body=JSON.stringify(count===1?rows:closingRows);mime='application/json'}
    else if(url.endsWith('/scripts/app/app.min.js')){body=detailClient;mime='application/javascript'}
    else if(url.startsWith(config.root+'jobdetails/')) {
      const id=url.split('/').at(-1),row=(count===1?rows:closingRows).find(r=>String(r.id)===id);assert.ok(row);requestedDetails.push(id)
      body='<html><body><header>'+config.employer+'</header><h1>'+row.title+'</h1><div class="job-description-container">'+(changeDetail&&count===2?'<p>Changed criteria</p>':row.description)+'</div><div selectedJobId="'+id+'"></div><button id="apply-job">Apply for this job</button><script src="https://cdn.keka.com/careers/v/2026/scripts/app/app.min.js"></script></body></html>'
    }else throw Error('Unexpected public request '+url)
    return new Response(body,{status:200,headers:{'content-type':mime}})
  }
  return {fetchImpl,calls,requestedDetails}
}
const syntheticRow=(id,countryCode='IN',countryName='India')=>({id,title:'Engineer '+id,description:'<h2>Requirements</h2><p>Build APIs with JavaScript. Bachelor qualification or equivalent experience.</p><h2>Responsibilities</h2><ul><li>Own services</li></ul>',departmentName:'Engineering',jobLocations:[{id:1,name:'Bengaluru',city:'Bengaluru',countryCode,countryName}],jobType:2,experience:'2 to 4 years',salaryRangeFormat:'INR 100000',publishedOn:'2026-10-26T00:00:00Z',skillNames:['JavaScript']})
for(const [source] of configs) {
  test(source+' legacy adapter empty current-native receipt leaves whole-company cleanup disabled',async()=>{
    const t=await transportFixture(source,{rows:[]}),jobs=await (await legacyScraper(source)).run({...t,requestIntervalMs:0,now:'2026-10-27T00:00:00Z'})
    assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).listingComplete,false)
    assert.equal(t.calls.filter(c=>c.url.includes('/active/')).length,2);assert.equal(t.calls.filter(c=>c.url.includes('/grouplinkstatus/')).length,2)
  })
  test(source+' legacy adapter reconciles all India and foreign details before caller cap',async()=>{
    const t=await transportFixture(source,{rows:[syntheticRow(1),syntheticRow(2),syntheticRow(3,'US','United States')]}),jobs=await (await legacyScraper(source)).run({...t,maxJobs:1,requestIntervalMs:0,now:'2026-10-27T00:00:00Z'})
    assert.deepEqual(t.requestedDetails,['1','2','3','1','2','3']);assert.equal(jobs.length,1)
    assert.equal(jobs[0].sourceObservedGlobalJobCount,3);assert.equal(jobs[0].sourceObservedIndiaJobCount,2);assert.equal(jobs[0].sourceListingComplete,false);assert.equal(jobs[0].lifecycleCleanupAllowed,false)
    assert.equal(jobs[0].postingDate,'2026-10-26T00:00:00Z');assert.equal(jobs[0].closingDate,null);assert.equal(jobs[0].requisitionId,null);assert.equal(jobs[0].remoteStatus,null)
    assert.match(jobs[0].jobDescription,/Bachelor qualification/);assert.match(jobs[0].sourceDescription,/Own services/)
    assert.equal(jobs[0].nativeCollectionEvidence.confirmedForeignRecords,1)
  })
  test(source+' legacy adapter retains healthy India records while unknown country and detail drift keep inventory partial',async()=>{
    const unknown=syntheticRow(2);delete unknown.jobLocations[0].countryCode;delete unknown.jobLocations[0].countryName
    const t=await transportFixture(source,{rows:[syntheticRow(1),unknown]}),jobs=await (await legacyScraper(source)).run({...t,requestIntervalMs:0,now:'2026-10-27T00:00:00Z'})
    assert.equal(jobs.length,1);assert.equal(jobs[0].nativeCollectionEvidence.countryUnknownRecords,1);assert.equal(jobs[0].sourceScopeComplete,false)
    const changed=await transportFixture(source,{rows:[syntheticRow(1)],changeDetail:true}),drift=await (await legacyScraper(source)).run({...changed,requestIntervalMs:0,now:'2026-10-27T00:00:00Z'})
    assert.equal(drift.length,0);assert.equal(readInventoryEvidence(drift).listingComplete,false)
  })
  test(source+' legacy adapter group-linked client change fails closed before unrelated organization queries',async()=>{
    const t=await transportFixture(source,{rows:[syntheticRow(1)],groupLinked:true})
    await assert.rejects((await legacyScraper(source)).run({...t,requestIntervalMs:0}),/all-groups/)
    assert.equal(t.calls.some(c=>c.url.includes('/active/')),false)
  })
}
