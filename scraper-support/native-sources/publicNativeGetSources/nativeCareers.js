import fs from 'node:fs';import {createPublicWorkableSource,publicWorkableMetadata} from '../publicWorkableSources/nativeCareers.js';import {createDeclaredJobFeedScraper} from '../declaredJobFeeds/nativeCareers.js';
import {readVisibleNativeDocument} from '../../utils/visibleNativeHtml.js';import {attachInventoryEvidence} from '../../utils/inventoryEvidence.js';import {attachSourceObservationEvidence} from '../../utils/sourceObservationEvidence.js';
import {createPublicPageReader} from './safeTransport.js';import {readPublicSmartRecruiters} from './smartRecruiters.js';
export const PUBLIC_NATIVE_GET_PROFILES=JSON.parse(fs.readFileSync(new URL('./profiles.json',import.meta.url)));
const requireInput=(v,m)=>{if(!v)throw Error('Public native GET: '+m)},equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export const nativeGetMetadata=(source,previous={})=>{
 const p=PUBLIC_NATIVE_GET_PROFILES[source];requireInput(p,'unknown source');const metadata=p.platform==='workable'?publicWorkableMetadata(p,previous):{...previous};
 for(const key of Object.keys(metadata))if(/^verified/i.test(key)&&key!=='verifiedFirstPartyUrls')metadata[key]=null;
 return {...metadata,source,companyName:p.displayName||p.companyName,officialBrandName:previous.officialBrandName||p.displayName||p.companyName,companyCareerPage:previous.companyCareerPage||p.primaryURL||p.primaryURLs[0],companyDomain:p.domain||'joinodin.com',countryFilter:p.countryFilter,atsPlatform:p.platform==='workable'?'workable-public-get':p.platform,verifiedOn:null,verifiedAt:null,verifiedPublicJobCount:null,verifiedIndiaJobCount:null,verifiedInventoryStatus:'unverified',sourceScopeComplete:false,lifecycleCleanupAllowed:false,zeroResultPolicy:'coverage-gap',backfillMode:'discovery-only',boardIdentityVerified:false,officialBindingVerifiedAt:null,bindingEvidence:null,runtimeInventoryVerification:false,verificationDisposition:'discovery-only-public-native-observations',paginationStrategy:'public-get-original-native-opening-closing-before-country-and-caps',extractionStrategy:'current-company-binding+original-all-country-native-own-records',verifiedSurfaceSummary:'Original public GET discovery observations only. Native empty feeds, missing/private/HTTP-only company pages and changed career handoffs remain coverage gaps. No employer/India-zero, browser/application activation, persistence or publication proof.'};
};
const visibleChain=(p,audit)=>{
 const pages=audit.rawPages||[],groups=new Map();for(const page of pages){if(!groups.has(page.url))groups.set(page.url,[]);groups.get(page.url).push(page)}
 for(const [i,url]of p.primaryPages.entries()){
  const rows=groups.get(url)||[];if(rows.length!==2)return false;
  for(const page of rows){if(!page.usable||!page.transportQualified||!page.originalText)return false;const d=readVisibleNativeDocument(page.originalText,{strict:true}),next=p.primaryPages[i+1]||p.boardURL;
   if(!d.nodes(n=>n.tag==='a'&&n.attrs.href).some(n=>{try{return new URL(n.attrs.href,url).href===next}catch{return false}}))return false}
 }return true;
};
export const createNativeGetSource=(source,defaults={})=>({name:source,async run(passed={}){
 const p=PUBLIC_NATIVE_GET_PROFILES[source];requireInput(p,'unknown source');const merged={...defaults,...passed};
 requireInput(!(merged.fetchJson||merged.fetchText)||merged.fetchPage||merged.fetchImpl,'original HTTP provenance required');
 const max=merged.maxJobs===Infinity?null:merged.maxJobs??null;requireInput(max===null||Number.isSafeInteger(max)&&max>=0,'maxJobs must be null or nonnegative safe integer');
 const timeoutMs=merged.timeoutMs??600000;requireInput(Number.isSafeInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=600000,'timeoutMs must be a positive safe integer at most600000');const signal=AbortSignal.any([AbortSignal.timeout(timeoutMs),...(merged.signal?[merged.signal]:[])]);signal.throwIfAborted();const value=typeof merged.now==='function'?merged.now():merged.now??new Date().toISOString(),observedAt=value instanceof Date?value.toISOString():value;requireInput(typeof observedAt==='string'&&Number.isFinite(Date.parse(observedAt)),'invalid observation clock');
 const io=createPublicPageReader({...merged,signal}),options={...merged,signal,now:()=>observedAt,fetchPage:io.read};delete options.fetchText;delete options.fetchJson;
 const onAudit=merged.onAudit||(()=>{}),onRecords=merged.onRecords||(()=>{});
 if(p.platform==='workable')return createPublicWorkableSource(p).run({...options,maxJobs:max,onAudit:async a=>{a.transportSafety=structuredClone(io.events);await onAudit(structuredClone(a))},onRecords:async r=>{await onRecords(structuredClone(r))}});
 let audit;
 if(p.platform==='ashby'){
  await createDeclaredJobFeedScraper(p).run({...options,maxJobs:null,onAudit:a=>{audit=a},onRecords:()=>{}});
  audit.employerBindingQualified=Boolean(audit.opening?.publisherQualified&&audit.closing?.publisherQualified&&visibleChain(p,audit));
  for(const row of audit.observations){const h=audit.observationHistory.find(h=>h.id===row.jobId),changed=h&&!equal([h.earlier.sourceNativeListingRecord,h.earlier.sourceNativePosting,h.earlier.sourceNativeJobPosting],[h.current.sourceNativeListingRecord,h.current.sourceNativePosting,h.current.sourceNativeJobPosting]);
   row.companyDomain=new URL(p.websiteOrigin).hostname.replace(/^www\./,'');row.stableAcrossPhases=!changed;row.sourceCurrentNativePostingIdentityQualified&&=audit.employerBindingQualified&&!changed;row.sourceCurrentNativeRoleQualified&&=audit.employerBindingQualified&&!changed;
   if(changed)row.sourceNativeIssues.push('original native criteria/compensation/location/date changed between phases');row.requisitionId=null;
  }
 }else audit=await readPublicSmartRecruiters(p,{...options,observedAt});
 signal.throwIfAborted();const eligible=p.platform==='ashby'?audit.observations.filter(r=>r.sourceBrandScopeQualified&&r.sourceNativeDetailQualified&&r.sourceCurrentNativePostingIdentityQualified&&r.stableAcrossPhases):[];
 const jobs=(max===null?eligible:eligible.slice(0,max)).map(r=>({...r,scrapedAt:observedAt}));Object.assign(audit,{observedAt,candidateCount:eligible.length,returnedCount:jobs.length,transportSafety:structuredClone(io.events),sourceScopeComplete:false,lifecycleCleanupAllowed:false,websiteJavaScriptExecuted:false,applicationActivationQualified:false,persistenceQualified:false});
 await onAudit(structuredClone(audit));signal.throwIfAborted();await onRecords(structuredClone(audit.observations));signal.throwIfAborted();
 attachSourceObservationEvidence(jobs,{source,recordKind:'vacancy-rows',observedRecordCount:audit.observations.length,observedVacancyCount:audit.observations.length,sourceScopeComplete:false});
 return attachInventoryEvidence(jobs,{status:jobs.length?'discovery-only':'coverage-gap',firstParty:audit.employerBindingQualified,surface:p.boardURL,listingComplete:false,pagesFetched:audit.rawPages.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:null,reason:'original native observations only; whole-employer/country scope and activation/persistence unqualified'});
}});
