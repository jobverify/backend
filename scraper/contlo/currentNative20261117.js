import{readFileSync}from'node:fs'
import{isDeepStrictEqual as equal}from'node:util'
import{readNativeDocument,activeHead}from'../../scraper-support/utils/activeNativeHtml.js'
import{nativeCountryName}from'../../scraper-support/shared/nativeJobPosting.js'
import{attachInventoryEvidence}from'../../scraper-support/utils/inventoryEvidence.js'
import{attachSourceObservationEvidence}from'../../scraper-support/utils/sourceObservationEvidence.js'
import{currentTransport}from'./currentTransport20261117.js'
import{check,detailModel}from'./currentModels20261117.js'
const profile=JSON.parse(readFileSync(new URL('./currentProfile20261117.json',import.meta.url),'utf8'))
export async function runCurrentContlo(options={}){
 options.signal?.throwIfAborted();const allowed=new Set([...profile.corporate.map(p=>p.url),...profile.clients.map(p=>p.url),profile.api]),io=currentTransport({...options,label:'Contlo',allowedURL:url=>allowed.has(url)}),verifiedAt=new Date().toISOString()
 try{const acquire=async()=>{
   const corporate=[];for(const expected of profile.corporate){const p=await io.read(expected.url);check(p.bodySHA256===expected.sha256&&p.bodyBytes===expected.bytes,'whole finite current corporate deployment');const d=readNativeDocument(p.text);check(equal(activeHead(p.text).titles,[expected.title]),'effective current corporate title');corporate.push({url:p.url,fullNativeHTML:p.text})
    if(expected.url===profile.corporate[0].url)check(d.nodes(n=>n.tag==='a'&&n.attrs.href==='/careers'&&d.text(n)==='Careers').length===1,'active own Careers handoff')
    else{const carrier=d.nodes(n=>n.tag==='div'&&n.attrs['data-outrely-jobs']);check(carrier.length===1&&carrier[0].attrs['data-outrely-jobs']==='contlo'&&!carrier[0].attrs['data-department']&&!carrier[0].attrs['data-limit'],'unique active whole native workspace embed without filtering')}
   }
   for(const client of profile.clients.slice(0,2)){const p=await io.read(client.url,'js');check(p.bodySHA256===client.sha256&&p.bodyBytes===client.bytes,'whole reviewed current corporate/native embed program')}
   const native=await io.read(profile.api,'json'),payload=native.value
   check(payload&&payload.organization==='Contlo'&&payload.workspace==='contlo'&&payload.careersUrl==='https://contlo.outrely.com/careers'&&Array.isArray(payload.jobs)&&payload.jobs.length<=100&&equal(Object.keys(payload).sort(),profile.payloadKeys),'native full inventory/employer/workspace model')
   const ids=new Set(),details=[],failures=[];for(const row of payload.jobs){const match=typeof row.url==='string'&&row.url.match(/^https:\/\/contlo\.outrely\.com\/apply\/([a-f0-9]{24})$/)
    check(match&&typeof row.title==='string'&&row.title.trim()&&typeof row.location==='string'&&typeof row.department==='string'&&typeof row.type==='string'&&(row.salary===null||typeof row.salary==='string')&&typeof row.postedAt==='string'&&!Number.isNaN(Date.parse(row.postedAt))&&!ids.has(match[1]),'whole native row/unique own role identity');ids.add(match[1])
    if(!equal(Object.keys(row).sort(),profile.rowKeys)){failures.push({id:match[1],reason:'whole-native-row-has-unreviewed-field-context',nativeRecord:row});continue}
    if(nativeCountryName(row.location.split(',').at(-1).trim())!=='India'){failures.push({id:match[1],reason:'native-explicit-country-not-proven-India',nativeRecord:row});continue}
    allowed.add(row.url);const p=await io.read(row.url),model=detailModel(p.text,row,profile.detail)
    check(nativeCountryName(model.schema.jobLocation?.address?.addressCountry)==='India','full native own schema explicit country agrees')
    details.push({id:match[1],nativeListingRecord:row,...model})
   }
   if(details.length)for(const client of profile.clients.slice(2)){const p=await io.read(client.url,'js');check(p.bodySHA256===client.sha256&&p.bodyBytes===client.bytes,'whole role application program/dependency')}
   io.checkpoint();return{corporate,nativePayload:payload,details,failures}
  },opening=await acquire(),closing=await acquire();check(equal(opening,closing),'whole raw native inventory/detail/form/passive models changed at closing');io.checkpoint()
  const jobs=[],failures=[...opening.failures];for(const detail of opening.details){if(!detail.criteriaQualified){failures.push({id:detail.id,reason:'unqualified-nontext-hidden-or-unreviewed-criteria-format',nativeRecord:detail.nativeListingRecord});continue}
   const row=detail.nativeListingRecord;jobs.push({source:'contlo',company:'Contlo',title:row.title,jobId:detail.id,requisitionId:detail.id,sourceUrl:row.url,applyUrl:row.url,link:row.url,location:row.location,country:'India',jobDescription:detail.description,sourceDescription:detail.descriptionHTML,postingDate:row.postedAt,employmentType:row.type,salary:row.salary,
    nativeListingRecord:row,nativeJobPosting:detail.schema,nativeFullRoleModel:detail,nativeApplicationModel:detail.nativeApplicationForm,nativeApplicationRestrictions:{resumeRequired:true,resumeMaximumBytes:10485760,acceptedResumeTypes:['PDF','DOCX','DOC','TXT'],source:'whole exact current native client'},applicationVisited:false,publicEligibility:null,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyCareerPage:profile.corporate[1].url,companyDomain:'contlo.com',atsPlatform:'outrely',scrapedAt:verifiedAt})}
  attachInventoryEvidence(jobs,{status:'coverage-gap',firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,surface:profile.corporate[1].url,pagesFetched:io.receipts.length,reportedTotal:null,indiaFacetCount:null,verifiedAt,reason:'current-bound-native-embed-positive-observations;employer-browser-application-wide-scope-held'})
  attachSourceObservationEvidence(jobs,{source:'contlo',recordKind:'vacancy-rows',observedRecordCount:opening.nativePayload.jobs.length,observedVacancyCount:opening.nativePayload.jobs.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{configurable:true,value:{...jobs.nativeCollectionEvidence,source:'contlo',nativeOpeningModel:opening,nativeClosingModel:closing,closingFullNativeModelsMatch:true,companyIndiaTotal:null,companyGlobalTotal:null,retainedResponses:io.receipts,failures,applicationVisited:false,publicEligibility:null,browserEquivalenceComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false}});return jobs
 }finally{io.close()}
}
