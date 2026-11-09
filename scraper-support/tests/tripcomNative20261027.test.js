import assert from 'node:assert/strict'
import test from 'node:test'
import {getScraperCatalog,createCatalogScraper} from '../providers/index.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
import {projectNativeHtml,buildDetailRequestBody,createTripcomScraper} from '../../scraper/tripcom/script.js'

const host='https://ak-s-cw.tripcdn.com/modules/hrteam/careers-trip-abroad-ares/'
const html='<script src="//ak-s-cw.tripcdn.com/modules/hrteam/careers-trip-abroad-ares/static/js/main.current.js"></script><script>i18n_base_language={"en-US":{"recruit.overseasCareers.home.documentTitle":"Careers | Trip.com Group","OverseasCareers.MokaApplyPC":"https://hire-r1.mokahr.com/apply/tripoverseas/100000877#/job/{jobId}/apply?pure=1","OverseasCareers.AvatureApply":"https://jobs.careers.trip.com/en_US/careers/ApplicationSwitch"}}</script><script>t.u=e=>"static/js/"+e+"."+{187:"detail",240:"list",995:"routes"}[e]+".chunk.js"</script>'
const clients={
 'main.current.js':'getJobList(e){const t={url:"api/oversea/getOverseaJobAd",data:e};return this.sendPost(t)}getBasisCountryInfo(e){const t={url:"api/oversea/getLocation",data:e};return this.sendPost(t)} const e={head:{language:"en-US"}}; const r={Avature:"OverseasCareers.AvatureApply",Moka_Overseas:"OverseasCareers.MokaApplyPC"}',
 '187.detail.chunk.js':'const r={condition:{fromId:[l]},atsApiType:i,pager:{index:1,size:10}};O.A.getJobList(r); const l=t.get("fromId")||t.get("jobId"),i=t.get("atsApiType")||""; dangerouslySetInnerHTML:{__html:`${e.requirements}`}',
 '240.list.chunk.js':'condition:{keyword:this.props.searchKeyWord,jobId:[],kind:this.state.selectChannelList,country:this.state.selectCountry,city:this.state.selectCity,bucode:this.state.selectBusinessList,jobFamilyGroupCode:s,jobFamilyCode:[]},pager:{index:e,size:t}; pageSizeOptions:["10","20"]; new URLSearchParams({fromId:s,atsApiType:i}); getBasisCountryInfo({countryCode:"",type:"OverseasCareersCountry"});getBasisCountryInfo({countryCode:"",citycode:"",type:"OverseasCareersWorkPlace"})',
 '995.routes.chunk.js':'path:"/joblist";path:"/job-detail"',
}
const row=(n,country='India')=>({id:String(n),fromId:'MJ'+n,jobId:'native-job-'+n,jobTitle:'Native role '+n,publishDate:'2026-10-01',city:country==='India'?'BLR':'PAR',cityName:country==='India'?'Bengaluru':'Paris',requirements:'<p>Employer: Trip.com</p><p>Responsibilities</p><ul><li>Build native search.</li></ul><p>Essential requirements</p><ul><li>5 years of Java experience.</li><li>Bachelor degree.</li></ul><p>Desirable: French.</p>',duty:null,jobFamilyGroupCode:'ENG',jobFamilyGroupName:'Engineering',buCode:'BU',buName:'International Business',user:null,hrDutyUser:null,hrUserName:null,channelId:'Regular',internalId:null,kind:'Regular',kindName:'Regular ',atsApiType:'Moka_Overseas',ynShowInterviewDate:false,nextWeekDays:[],dutyUserCode:'',category:'1'})
const data=(rows,total=rows.length)=>({retCode:'201',retValue:{total,recruitJobAdList:rows}})
function fixture({rows=[row(1)],change,brokenPage,emptyPage,duplicate,detailMismatch,detailExtra,denial,unknownCity=false,chinaContext=false}={}){
 const calls=[],details=new Map();let evidence
 return {calls,get evidence(){return evidence},options:{now:()=> '2026-10-27T00:00:00.000Z',requestIntervalMs:0,onNativeEvidence:value=>{evidence=value},fetchImpl:async(url,options={})=>{
  calls.push({url,method:options.method||'GET',body:options.body&&JSON.parse(options.body)})
  if(denial&&calls.length===denial.at)return new Response(denial.body||'',{status:denial.status||200,headers:{'content-type':'text/html'}})
  if(url==='https://careers.trip.com/')return new Response(chinaContext?html.replace('"OverseasCareers.AvatureApply":','"recruit.overseasCareers.locations.CHN.code":"https://careers.ctrip.com/index.html","OverseasCareers.AvatureApply":'):html,{headers:{'content-type':'text/html'}})
  if(url.startsWith(host)){const name=url.split('/').at(-1);return new Response(clients[name]||'',{headers:{'content-type':'application/javascript'}})}
  const body=JSON.parse(options.body)
  if(url.endsWith('getLocation')){
   const list=body.type==='OverseasCareersCountry'?[{type:body.type,code:'IND',name:'India'},{type:body.type,code:'FRA',name:'France'}]:body.countryCode==='IND'?(unknownCity?[]:[{type:body.type,code:'BLR',name:'Bengaluru'}]):body.countryCode==='FRA'?[{type:body.type,code:'PAR',name:'Paris'}]:[{type:body.type,code:'BLR',name:'Bengaluru'},{type:body.type,code:'PAR',name:'Paris'}]
   return Response.json({retCode:'201',retValue:list})
  }
  assert.equal(url,'https://careers.trip.com/api/oversea/getOverseaJobAd');assert.equal(options.method,'POST');assert.equal(body.head.language,'en-US')
  if(body.condition.fromId?.length){
   const key=body.condition.fromId[0],selected=rows.find(r=>(r.fromId||r.jobId)===key);assert.ok(selected,'detail must come from native inventory');assert.equal(body.atsApiType,selected.atsApiType);assert.deepEqual(body.pager,{index:1,size:10});const count=(details.get(key)||0)+1;details.set(key,count)
   let result={...selected};if(change&&count>1)result.requirements+='<p>New mandatory requirement.</p>';if(detailMismatch)result.jobId='another-job';if(detailExtra)result.screeningCriteria='Must speak French';return Response.json(data([result]))
  }
  const page=+body.pager.index,size=+body.pager.size;assert.deepEqual(body.condition.country,[]);assert.deepEqual(body.condition.kind,[]);assert.deepEqual(body.condition.bucode,[])
  let selected=rows.slice((page-1)*size,page*size);if(emptyPage===page)selected=[];if(duplicate&&page===2)selected=[rows[0],...selected.slice(1)];return Response.json(data(selected,brokenPage===page?rows.length+1:rows.length))
 }}}
}
const registered=()=>createCatalogScraper(getScraperCatalog().find(p=>p.source==='tripcom'))

test('Trip.com registered scraper retains all native criteria and real application context',async()=>{
 const f=fixture(),jobs=await registered().run(f.options);assert.equal(jobs.length,1);const j=jobs[0]
 assert.equal(j.company,'Trip.com');assert.equal(j.country,'India');assert.equal(j.requisitionId,null);assert.equal(j.nativeFromId,'MJ1');assert.equal(j.nativeApplicationJobId,'native-job-1')
 assert.equal(j.applyUrl,'https://hire-r1.mokahr.com/apply/tripoverseas/100000877#/job/native-job-1/apply?pure=1')
 assert.match(j.jobDescription,/5 years of Java experience/);assert.match(j.jobDescription,/Bachelor degree/);assert.match(j.jobDescription,/Desirable: French/);assert.deepEqual(j.nativeFields,row(1));assert.equal(j.postingDate,'2026-10-01');assert.equal(j.closingDate,null)
 assert.equal(j.sourceDetailComplete,true);assert.equal(j.sourceListingComplete,true);assert.equal(f.evidence.globalRecords,1);assert.equal(f.evidence.fullDetailRecords,1);assert.equal(readInventoryEvidence(jobs).listingComplete,true)
 assert.ok(f.calls.every(c=>c.method==='GET'||/\/(?:getLocation|getOverseaJobAd)$/.test(c.url)))
})
test('Trip.com reconciles every role before caller caps',async()=>{
 const f=fixture({rows:Array.from({length:23},(_,i)=>row(i+1))}),jobs=await registered().run({...f.options,maxJobs:1});assert.equal(jobs.length,1);assert.equal(f.evidence.globalRecords,23);assert.equal(f.evidence.fullDetailRecords,23);assert.equal(f.evidence.closingFullDetailRecords,23);assert.equal(f.calls.filter(c=>c.body?.condition?.fromId).length,46);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
for(const [name,settings]of [['premature empty',{emptyPage:2}],['changed total',{brokenPage:2}],['overlapping pages',{duplicate:true}]])test('Trip.com rejects '+name,async()=>{
 const f=fixture({rows:Array.from({length:21},(_,i)=>row(i+1)),...settings});await assert.rejects(registered().run(f.options),/contract|pagination|total|duplicate/i)
})
test('Trip.com excludes descriptions changed during closing reconciliation',async()=>{
 const f=fixture({change:true}),jobs=await registered().run(f.options);assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.match(f.evidence.reasons.join(';'),/changed/)
})
test('Trip.com rejects wrong detail identity and preserves unreviewed criteria as a gap',async()=>{
 for(const settings of [{detailMismatch:true},{detailExtra:true}]){const f=fixture(settings),jobs=await registered().run(f.options);assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.match(f.evidence.reasons.join(';'),/identity|unreviewed/)}
})
test('Trip.com unknown country and employer cannot certify zero',async()=>{
 const r=row(1);r.requirements='<p>Trip.com Group comprises Trip.com, Ctrip and Skyscanner.</p><p>Support India customers from the Paris office.</p>';const f=fixture({rows:[r],unknownCity:true}),jobs=await registered().run(f.options)
 assert.equal(jobs.length,0);assert.equal(f.evidence.countryUnknownRecords,1);assert.equal(f.evidence.employerUnknownRecords,1);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(f.evidence.roles[0].country,null);assert.equal(f.evidence.roles[0].company,null)
})
test('Trip.com accepts role-specific explicit work-country prose with unknown native city',async()=>{
 const r=row(1);r.requirements='<p>Employer: Trip.com</p><p>Work country: India</p><p>Build search.</p>';const f=fixture({rows:[r],unknownCity:true}),jobs=await registered().run(f.options);assert.equal(jobs.length,1);assert.equal(jobs[0].country,'India');assert.equal(jobs[0].nativeCountryEvidence.type,'native-work-country-prose')
})
test('Trip.com preserves a native unknown publication date without fabricating a date',async()=>{
 const r=row(1);r.publishDate=null;const f=fixture({rows:[r]}),jobs=await registered().run(f.options);assert.equal(jobs.length,1);assert.equal(jobs[0].postingDate,null);assert.equal(jobs[0].postedAt,null);assert.equal(jobs[0].nativePublicationRaw,null)
})
test('Trip.com never relabels a sibling employer on the shared board',async()=>{
 const r=row(1);r.requirements='<p>Employer: Skyscanner</p><p>Build travel products.</p>';const f=fixture({rows:[r]}),jobs=await registered().run(f.options);assert.equal(jobs.length,0);assert.equal(f.evidence.roles[0].company,'Skyscanner');assert.equal(f.evidence.eligibleIndiaRecords,0)
})
test('Trip.com country proof requires matching native location identity and name',async()=>{
 const r=row(1);r.cityName='Paris';const f=fixture({rows:[r]}),jobs=await registered().run(f.options);assert.equal(jobs.length,0);assert.equal(f.evidence.countryUnknownRecords,1);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('Trip.com does not certify company coverage while a public country handoff is unenumerated',async()=>{
 const f=fixture({chinaContext:true}),jobs=await registered().run(f.options);assert.equal(jobs.length,1);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.match(f.evidence.reasons.join(';'),/unenumerated.*hiring-context/)
})
test('Trip.com detail request uses native fallback and never fabricates an ATS type',()=>{
 assert.deepEqual(JSON.parse(buildDetailRequestBody({...row(1),fromId:null})),{condition:{fromId:['native-job-1']},atsApiType:'Moka_Overseas',pager:{index:1,size:10},head:{language:'en-US'}});assert.throws(()=>buildDetailRequestBody({...row(1),atsApiType:null}),/ats/i)
})
for(const status of [401,403,429])test('Trip.com stops on public HTTP '+status+' without retry',async()=>{
 const f=fixture({denial:{at:6,status}});await assert.rejects(registered().run(f.options),e=>e.status===status&&e.abortRetries===true);assert.equal(f.calls.length,6);assert.equal(f.calls.at(-1).url,'https://careers.trip.com/api/oversea/getLocation')
})
test('Trip.com stops on a successful-HTTP bot denial without retry',async()=>{
 const f=fixture({denial:{at:6,body:'Access denied: automated bot requests are blocked'}});await assert.rejects(registered().run(f.options),/denied|blocked/i);assert.equal(f.calls.length,6)
})
test('Trip.com respects cancellation before any request',async()=>{
 const f=fixture(),controller=new AbortController();controller.abort(Error('cancel native audit'));await assert.rejects(registered().run({...f.options,signal:controller.signal}),/cancel native audit/);assert.equal(f.calls.length,0)
})
test('Trip.com bounds a hung transport',async()=>{
 await assert.rejects(createTripcomScraper().run({timeoutMs:15,requestIntervalMs:0,fetchImpl:async()=>new Promise(()=>{})}),/deadline|timeout/i)
})
test('Trip.com HTML projection excludes nonrendering content and decodes text once',()=>{
 const p=projectNativeHtml('<p>Keep &lt;literal&gt; &amp; &#65;</p><!-- comment --><script>secret()</script><style>.x{}</style><template>Template</template><noscript>JS off</noscript><head><title>Title</title></head><p hidden>Hidden</p><p aria-hidden=true>ARIA hidden</p><p>Last</p>');assert.equal(p.text,'Keep <literal> & A\nLast');assert.equal(p.complete,true)
})
test('Trip.com numeric entity decoding never turns literal encoded markup into another entity',()=>{
 assert.equal(projectNativeHtml('<p>&#38;lt; &#x26;gt; &amp;lt;</p>').text,'&lt; &gt; &lt;')
})
for(const style of ['display:none','DISPLAY: /*x*/ none','visibility: hidden','opacity:0','opacity:00','opacity:+0','opacity:0e0','opacity:0E+00','opacity:&#48;','opacity:&#x30;','op/**/acity:/**/+0','opacity:0!important','content-visibility:hidden'])test('Trip.com hidden native text: '+style,()=>{
 const attribute=style.includes(' ')?'"'+style+'"':style,p=projectNativeHtml('<p>Visible</p><section style='+attribute+'><b>Hidden criterion</b></section><p>End</p>');assert.equal(p.text,'Visible\nEnd');assert.equal(p.complete,true)
})
test('Trip.com unknown CSS visibility stays unresolved',()=>{assert.equal(projectNativeHtml('<p style="transform:scale(0)">Potentially hidden</p><p>Visible</p>').complete,false)})
test('Trip.com invalid dates remain raw and unresolved',async()=>{
 const r=row(1);r.publishDate='not-a-date';const f=fixture({rows:[r]}),jobs=await registered().run(f.options);assert.equal(jobs.length,0);assert.equal(f.evidence.roles[0].postingDate,null);assert.equal(f.evidence.roles[0].nativePublicationRaw,'not-a-date');assert.equal(f.evidence.roles[0].closingDate,null);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
