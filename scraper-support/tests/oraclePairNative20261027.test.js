import assert from 'node:assert/strict'
import test from 'node:test'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
globalThis.fetch=()=>{throw Error('Offline test network tripwire')}
const {createCatalogScraper,getScraperCatalog}=await import('../providers/index.js')

const module = () => import('../../scraper/arcelormittal/oracleNative.js')
const networkTripwire=async fn=>{const prior=globalThis.fetch;globalThis.fetch=()=>{throw Error('Unexpected implicit network')};try{return await fn()}finally{globalThis.fetch=prior}}
const nativeProtocol=(url)=>{
 const origin='https://efhi.fa.em3.oraclecloud.com',board=origin+'/hcmUI/CandidateExperience/en/sites/CX_1'
 if(url==='https://www.landmarkgroup.com/careers')return'<title>Landmark Group</title><script src="/_next/static/chunks/native.js"></script>'
 if(url==='https://www.landmarkgroup.com/_next/static/chunks/native.js')return'/api/page/${ ?locale=${'
 if(url==='https://www.landmarkgroup.com/api/page/careers?locale=en')return JSON.stringify({data:[{sections:[{rolesByRegionList:[{buttonLink:board}]}]}]})
 if(url===board)return'<title>LANDMARK GROUP</title><base data-sitenumber="CX_1" data-apibaseurl="'+origin+'"><script src="https://static.oracle.com/cdn/fa/oj-hcm-ce/test/js/main-minimal.js"></script>'
 if(url==='https://static.oracle.com/cdn/fa/oj-hcm-ce/test/js/main-minimal.js')return'/recruitingCEJobRequisitions?onlyData=true requisitionList.secondaryLocations finder=findReqs /recruitingCEJobRequisitionDetails finder=ById siteSettings/ /hcmRestApi/resources/latest'
 if(url===origin+'/hcmRestApi/CandidateExperience/en/siteSettings/CX_1')return JSON.stringify({app:{siteNumber:'CX_1',siteName:'LANDMARK GROUP',settings:[]}})
 return null
}
test('native Oracle HTML projection excludes nonrendering text and decodes each input once',async()=>{
 const {projectHTML}=await module()
 for(const v of ['0','00','+0','0e0','0.000','-0'])assert.equal(projectHTML(`<p>Visible &amp;amp;</p><span style="opacity:${v}">HIDDEN</span><template>INERT</template><script>CODE</script>`).text,'Visible &amp;')
 assert.equal(projectHTML('<p style="display:&#110;one">HIDDEN</p><p>Visible</p>').text,'Visible')
 for(const h of ['<p style="display&amp;colon;none">HIDDEN</p>','<style>.h{display&#58;none}</style><p class="h">HIDDEN</p>','<style>.h{display:none}</style><p class="h">HIDDEN</p>']){const r=projectHTML(h);assert.equal(r.complete,false);assert.ok(!r.text.includes('HIDDEN'))}
 const native=projectHTML('<p style="box-sizing:border-box;background:transparent;mso-bidi-font-weight:normal;--hue-web-line-height-regular:1.25;font-family:&quot;Arial&quot;;position:relative;overflow:visible">Full native criteria.</p>');assert.equal(native.complete,true);assert.equal(native.text,'Full native criteria.')
 assert.equal(projectHTML('<span style="font-size:0">HIDDEN</span><p>Visible</p>').text,'Visible')
})
test('full Oracle detail preserves native identities, publication, expiry and all public sections',async()=>{
 const {mapOracleDetail}=await module()
 const r=mapOracleDetail({Id:'7',Title:'Engineer',PrimaryLocationCountry:'IN',PrimaryLocation:'Pune',RequisitionId:7001,ExternalPostedStartDate:'2026-10-20T11:22:33+00:00',ExternalPostedEndDate:'2026-11-01T11:22:33+00:00',ExternalDescriptionStr:'<p>Full description.</p>',ExternalResponsibilitiesStr:'<p>Build services.</p>',ExternalQualificationsStr:'<p>Degree and experience.</p>',OrganizationDescriptionStr:'<p>Native brand information.</p>',CorporateDescriptionStr:'<p>Group information.</p>',JobSchedule:null,RequisitionType:'Professional',LegalEmployer:null,Organization:null,requisitionFlexFields:[]},{source:'landmarkgroup',now:'2026-10-27T00:00:00Z'})
 assert.equal(r.requisitionId,'7001');assert.equal(r.employmentType,null);assert.equal(r.legalEmployer,null);assert.equal(r.brand,null);assert.equal(r.postingDate,'2026-10-20T11:22:33+00:00');assert.equal(r.closingDate,'2026-11-01T11:22:33+00:00');assert.ok(r.sourceClosingDateIsExact)
 for(const s of ['Full description.','Build services.','Degree and experience.','Native brand information.','Group information.'])assert.ok(r.sourceDescription.includes(s))
 assert.equal(r.sourceDetailComplete,true)
})
test('role country classification never infers India from a city, filter, or headquarters',async()=>{
 const {classifyOracleCountry}=await module()
 assert.equal(classifyOracleCountry({PrimaryLocation:'Pune, India'}),'unknown')
 assert.equal(classifyOracleCountry({PrimaryLocationCountry:'AE',PrimaryLocation:'Pune, India'}),'foreign')
 assert.equal(classifyOracleCountry({PrimaryLocationCountry:'AE',secondaryLocations:[{CountryCode:'IN',Name:'Bengaluru'}]}),'india')
 assert.equal(classifyOracleCountry({PrimaryLocationCountry:'AE',secondaryLocations:[{Name:'Bengaluru'}]}),'unknown')
})
test('Oracle preserves current alphanumeric public ids independently of the numeric requisition id',async()=>{
 const {buildOracleJobUrl,buildOracleDetailApiUrl,mapOracleDetail}=await module()
 assert.match(buildOracleJobUrl('landmarkgroup','2000043T'),/\/job\/2000043T$/)
 assert.ok(buildOracleDetailApiUrl('landmarkgroup','2000043T').includes('Id=%222000043T%22'))
 const r=mapOracleDetail({Id:'2000043T',Title:'Helper',RequisitionId:3001,PrimaryLocationCountry:'AE',ExternalDescriptionStr:'<p>Full role.</p>'},{source:'landmarkgroup'})
 assert.equal(r.jobId,'2000043T');assert.equal(r.requisitionId,'3001')
})
test('registered arcelormittal stops on first current careers denial and never reaches historical Oracle',async()=>{
 const calls=[],p=getScraperCatalog().find(x=>x.source==='arcelormittal')
 await networkTripwire(()=>assert.rejects(createCatalogScraper(p).run({fetchPage:async url=>{calls.push(url);return{status:403,url,body:'<title>Just a moment...</title>'}}}),/403/))
 assert.deepEqual(calls,['https://corporate.arcelormittal.com/careers'])
})
test('registered sources reject legacy listing-only overrides before implicit network',async()=>{
 for(const source of ['arcelormittal','landmarkgroup'])await networkTripwire(()=>assert.rejects(createCatalogScraper(getScraperCatalog().find(x=>x.source===source)).run({fetchJson:async()=>({items:[]})}),/fetchPage/))
})
test('pagination uses native offsets despite foreign-only or short pages, closes full scope before maxJobs',async()=>{
 const {createOracleNativeScraper,readOracleNativeReport}=await module(),calls=[]
 const rows=Array.from({length:48},(_,i)=>({Id:String(i+1),Title:'Role'+(i+1),PrimaryLocationCountry:i===47?'IN':'AE'}))
 const stage={};let detailCalls=0
 const jobs=await createOracleNativeScraper('landmarkgroup',{maxJobs:0,maxPages:1,fetchPage:async url=>{
  calls.push(url)
  const protocol=nativeProtocol(url);if(protocol!==null)return{status:200,url,body:protocol}
  if(url.includes('JobRequisitionDetails')){detailCalls++;return{status:200,url,body:JSON.stringify({items:[{...rows[47],RequisitionId:3003,ExternalDescriptionStr:'<p>Full India role.</p>',ExternalResponsibilitiesStr:'<p>Build.</p>',ExternalQualificationsStr:'<p>Degree.</p>'}]})}}
  const offset=Number(url.match(/offset=(\d+)/)?.[1]);stage[offset]=(stage[offset]??0)+1
  return{status:200,url,body:JSON.stringify({items:[{SiteNumber:'CX_1',TotalJobsCount:49,Limit:24,Offset:offset,requisitionList:offset===0?rows.slice(0,23):offset===24?rows.slice(23,47):rows.slice(47)}]})}
 }}).run()
 assert.equal(detailCalls,1);assert.deepEqual(stage,{0:2,24:2,48:2});assert.equal(jobs.length,0)
 const report=readOracleNativeReport(jobs);assert.equal(report.oracle.observedCount,48);assert.equal(report.oracle.reportedTotal,49);assert.equal(report.oracle.complete,false);assert.equal(report.cleanupAllowed,false);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('registered source aborts pending public reads and never falls through to further requests',async()=>{
 const controller=new AbortController(),calls=[],p=getScraperCatalog().find(x=>x.source==='landmarkgroup')
 const running=createCatalogScraper(p).run({signal:controller.signal,fetchPage:async url=>{calls.push(url);controller.abort(Error('test stop'));return new Promise(()=>{})}})
 await assert.rejects(running,/test stop/);assert.equal(calls.length,1)
 const already=new AbortController();already.abort(Error('already stopped'));await assert.rejects(createCatalogScraper(p).run({signal:already.signal,fetchPage:async()=>assert.fail('No request after abort')}),/already stopped/)
})
test('HTML projection removes closed dialogs/details and does not activate inert style bodies',async()=>{
 const {projectHTML}=await module(),p=projectHTML('<template><style>.x{display:none}</style>INERT</template><dialog>CLOSED</dialog><details><summary>Summary</summary>HIDDEN</details><p>Visible</p>')
 assert.equal(p.text,'Summary Visible');assert.equal(p.complete,true)
})
test('transparent font colors and unresolved offscreen indentation cannot establish full visible criteria',async()=>{
 const {projectHTML}=await module()
 for(const color of ['transparent','rgba(0,0,0,0)','rgba(0,0,0,+0)','rgb(0 0 0 / 0%)','#0000','#ffffff00'])assert.equal(projectHTML(`<p style="color:${color}">HIDDEN</p><p>Visible</p>`).text,'Visible')
 assert.equal(projectHTML('<p style="color:rgb(0,0,0)">Visible black text.</p>').text,'Visible black text.')
 const hanging=projectHTML('<p style="margin-left:41.45pt;text-indent:-18.0pt;mso-list:l0 level1 lfo1">Native list criteria.</p>');assert.equal(hanging.complete,true);assert.equal(hanging.text,'Native list criteria.')
 const offscreen=projectHTML('<p style="text-indent:-9999px">OFFSCREEN</p><p>Visible</p>');assert.equal(offscreen.complete,false);assert.ok(!offscreen.text.includes('OFFSCREEN'))
})
test('stable India listing with a foreign full-detail country remains a native-country conflict',async()=>{
 const {createOracleNativeScraper,readOracleNativeReport}=await module(),row={Id:'1',Title:'Engineer',PrimaryLocationCountry:'IN'}
 const jobs=await createOracleNativeScraper('landmarkgroup',{fetchPage:async url=>{const body=nativeProtocol(url);if(body!==null)return{status:200,url,body};if(url.includes('JobRequisitionDetails'))return{status:200,url,body:JSON.stringify({items:[{...row,PrimaryLocationCountry:'AE',ExternalDescriptionStr:'<p>Full foreign role.</p>'}]})};return{status:200,url,body:JSON.stringify({items:[{SiteNumber:'CX_1',TotalJobsCount:1,Offset:0,Limit:24,requisitionList:[row]}]})}}}).run()
 const report=readOracleNativeReport(jobs);assert.equal(jobs.length,0);assert.equal(report.oracle.complete,false);assert.equal(report.sourceScopeComplete,false);assert.equal(report.cleanupAllowed,false);assert.ok(report.oracle.failures.some(x=>x.reason==='native-country-conflict'))
})
