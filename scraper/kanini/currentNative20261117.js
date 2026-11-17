import{readFileSync}from'node:fs'
import{isDeepStrictEqual as equal}from'node:util'
import{attachInventoryEvidence}from'../../scraper-support/utils/inventoryEvidence.js'
import{attachSourceObservationEvidence}from'../../scraper-support/utils/sourceObservationEvidence.js'
import{nativeCountryName}from'../../scraper-support/shared/nativeJobPosting.js'
import{currentKaniniTransport}from'./currentTransport20261117.js'
import{check,sha,norm,corporate,cards,detail,application}from'./currentModels20261117.js'
const profile=JSON.parse(readFileSync(new URL('./currentProfile20261117.json',import.meta.url),'utf8'))
export async function runCurrentKanini(options={}){
 options.signal?.throwIfAborted();const allowed=new Set([...profile.corporate.map(c=>c.url),profile.form.url,profile.formProgram.url,profile.formAPI])
 const io=currentKaniniTransport({...options,allowedRequest:(url,method,body)=>method==='POST'?url===profile.listingClient.endpoint&&/^search=&location=&action=get_all_jobs&page=(?:[1-9]|1\d|20)&limit=12$/.test(body):allowed.has(url)}),verifiedAt=new Date().toISOString()
 const exact=async(entry,kind)=>{const p=await io.read(entry.url,kind);check(p.bodyBytes===entry.bytes&&p.bodySHA256===entry.sha256,'whole exact native form/client original');return p}
 const round=async()=>{
  const docs=[];for(let i=0;i<profile.corporate.length;i++){const c=profile.corporate[i],p=await io.read(c.url);docs.push(corporate(p.text,c,[profile.primaryTitle,profile.careersTitle,profile.listingTitle][i]))}
  for(const doc of docs.slice(0,2)){check(doc.nodes(n=>n.tag==='a'&&n.attrs.href==='/careers/open-positions/').length>0,'active current first-party native listing handoff')}
  check(docs[0].nodes(n=>n.tag==='a'&&n.attrs.href==='/careers/').length>0,'active own Careers handoff')
  const listing=docs[2],client=listing.nodes(n=>n.tag==='script'&&!n.attrs.src&&(n.raw??'').includes('function load_ajax_post'))
  check(client.length===1&&Buffer.byteLength(client[0].raw)===profile.listingClient.bytes&&sha(client[0].raw)===profile.listingClient.sha256,'whole native ready/scroll/read-only query program')
  const forms=listing.nodes(n=>n.tag==='form'&&n.attrs.id==='search_form');check(forms.length===1&&equal(forms[0].attrs,{id:'search_form',action:'#',method:'post',onsubmit:'return false'}),'exact native search form')
  const controls=listing.nodes(n=>['input','select','textarea','button'].includes(n.tag),forms[0]);check(controls.length===2&&controls[0].tag==='input'&&controls[0].attrs.name==='search'&&!controls[0].attrs.value&&controls[1].tag==='select'&&controls[1].attrs.name==='location','whole blank Search/All Locations serialization')
  const locations=listing.nodes(n=>n.tag==='option',controls[1]);check(equal(locations.map(n=>({value:n.attrs.value,text:norm(listing.text(n)),selected:Object.hasOwn(n.attrs,'selected')})),[{value:'',text:'All Locations',selected:true},{value:'India',text:'India',selected:false},{value:'Ukraine',text:'Ukraine',selected:false},{value:'United States',text:'United States',selected:false},{value:'United Kingdom',text:'UK',selected:false},{value:'Colombia',text:'Colombia',selected:false}]),'complete explicit native location model')
  const pages=[],rows=[],ids=new Set();let terminal=false
  for(let page=1;page<=20;page++){const body=profile.listingClient.bodyPrefix+page+profile.listingClient.bodySuffix,p=await io.read(profile.listingClient.endpoint,'html',body),batch=cards(p.text);pages.push({page,body,html:p.text});for(const row of batch){check(!ids.has(row.id),'unique native role across whole pagination');ids.add(row.id);rows.push(row)}if(!batch.length){terminal=true;break}}
  check(terminal,'actual native terminal response not reached');const details=[]
  for(const row of rows){if(nativeCountryName(row.country)!=='India')continue;allowed.add(row.url);const p=await io.read(row.url);details.push(detail(p.text,row,profile))}
  await exact(profile.form,'html');await exact(profile.formProgram,'js');const form=application((await io.read(profile.formAPI,'json')).value,profile)
  return{rows,pages,details,application:form}
 }
 try{
  const opening=await round(),closing=await round();check(equal(opening,closing),'whole closing native card/criteria/application/passive-context model changed')
  const jobs=[],failures=[],exclusions=[];for(const row of opening.rows){const country=nativeCountryName(row.country)
   if(country!=='India'){(country?exclusions:failures).push({id:row.id,reason:country?'native-explicit-foreign-country':'native-country-unknown',nativeRecord:row});continue}
   const model=opening.details.find(d=>d.id===row.id);check(model,'full own India native detail');if(!model.criteriaQualified){failures.push({id:row.id,reason:'native-criteria-format-unqualified',nativeRecord:row});continue}
   jobs.push({source:'kanini',company:'KANINI SOFTWARE SOLUTIONS',title:row.title,jobId:row.id,requisitionId:row.id,sourceUrl:row.url,applyUrl:row.url,link:row.url,
    location:row.location.split('|')[0].trim()+', India',country:'India',jobDescription:model.description,sourceDescription:model.descriptionHTML,experienceRequired:row.experience,employmentType:model.employment.join(' ')||null,
    postingDate:null,nativePublicationDateProvenance:null,nativeListingRecord:row,nativeDetailModel:model,nativeApplicationModel:opening.application,nativeApplicationFormURL:profile.form.url,
    applicationVisited:false,publicEligibility:null,nativeApplicationContext:'generic-employer-candidate-form;manual-Applied_Job_ID-required;no-automatic-role-prefill-asserted',sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,
    companyCareerPage:profile.corporate[2].url,companyDomain:'kanini.com',atsPlatform:'official-site-with-zohorecruit-form',scrapedAt:verifiedAt})
  }
  attachInventoryEvidence(jobs,{status:'coverage-gap',firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,surface:profile.corporate[2].url,pagesFetched:io.receipts.length,reportedTotal:null,indiaFacetCount:null,verifiedAt,
   reason:'current-native-query-enumerated;unknown-country-and-browser-employer-application-scope-held'})
  attachSourceObservationEvidence(jobs,{source:'kanini',recordKind:'vacancy-rows',observedRecordCount:opening.rows.length,observedVacancyCount:opening.rows.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{configurable:true,value:{...jobs.nativeCollectionEvidence,source:'kanini',observedListingCount:opening.rows.length,candidateDetails:opening.details.length,
   extractedDetailJobs:jobs.length,excludedDetailJobs:exclusions.length,failures,exclusions,nativeOpeningInventory:opening,nativeClosingInventory:closing,retainedResponses:io.receipts,
   nativeCountryUnknownRows:opening.rows.filter(r=>!nativeCountryName(r.country)).length,nativeExplicitForeignRows:opening.rows.filter(r=>nativeCountryName(r.country)&&nativeCountryName(r.country)!=='India').length,
   closingFullNativeInventoryMatch:true,listingPaginationComplete:true,companyGlobalTotal:null,companyIndiaTotal:null,applicationVisited:false,publicEligibility:null,sourceScopeComplete:false,browserEquivalenceComplete:false,lifecycleCleanupAllowed:false}})
  return jobs
 }finally{io.close()}
}
