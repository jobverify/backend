import{models}from'./models.js';
export const decode=s=>String(s??'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&nbsp;/g,' ').replace(/&amp;/g,'&');
export const plain=s=>decode(s).replace(/<\/?[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const country=s=>/^India$|^IN$/i.test(String(s??'').trim());
const endsIndia=s=>/(?:,\s*India|\bIN-[A-Z]{2}-[^,]+,\s*India(?:\s*\([^)]*\))?)\s*$/i.test(String(s??''));
export function locationEvidence(row){const locations=[...(Array.isArray(row.multi_location)?row.multi_location:[]),...(Array.isArray(row.multi_location_array)?row.multi_location_array:[])];const india=locations.filter(x=>typeof x==='string'?endsIndia(x):country(x?.country)||endsIndia(x?.location)||endsIndia(x?.cityStateCountry));return {primaryIndia:country(row.country),secondaryIndia:india.length>0,indiaLocations:india,raw:{country:row.country,location:row.location,cityStateCountry:row.cityStateCountry,multi_location:row.multi_location,multi_location_array:row.multi_location_array}};}
export function reconcilePages(pages,{bindingVerified=false,explicitEmptyProof=false}={}){const rows=pages.flatMap(p=>p?.data?.jobs??[]),total=pages[0]?.totalHits,ids=rows.map(r=>r.reqId),failures=[];if(!bindingVerified)failures.push('unverified-binding');if(!pages.length||pages.some(p=>p?.status!==200||!Array.isArray(p?.data?.jobs)||p.totalHits!==total||!Number.isInteger(p.hits)||p.hits!==p.data.jobs.length))failures.push('upstream-or-total');if(!Number.isInteger(total)||total<0||rows.length!==total||ids.some(x=>typeof x!=='string'||!x)||new Set(ids).size!==rows.length)failures.push('pagination-or-identity');if(total===0&&!explicitEmptyProof)failures.push('unproven-zero');return {rows,complete:failures.length===0,cleanupAllowed:failures.length===0&&rows.length>0,verifiedEmpty:failures.length===0&&total===0&&explicitEmptyProof,failures};}
export function normalizeDetail(listing,detail,{posting=null,canonical=null,now=new Date().toISOString(),inventoryComplete=false}={}){
 const provenanceFlags=[],failures=[],loc=locationEvidence(listing),dloc=locationEvidence(detail||{});if(!detail||detail.reqId!==listing.reqId||detail.jobId!==listing.jobId||detail.title!==listing.title||detail.refNum!=='ARELUS'||listing.jobSeqNo&&detail.jobSeqNo!==listing.jobSeqNo||posting&&((posting.identifier?.value??posting.identifier)!==listing.reqId||posting.title!==listing.title))failures.push('identity-mismatch');
 if(canonical){try{const u=new URL(canonical);if(u.origin!=='https://careers.arrow.com'||u.pathname.split('/job/')[1]?.split('/')[0]!==listing.reqId)failures.push('canonical-mismatch');}catch{failures.push('canonical-mismatch');}}
 const nativeCountryEvidence=reconcileNativeCountries(listing,detail,posting);if(nativeCountryEvidence.failures.length)failures.push('country-conflict');
 if(loc.primaryIndia&&detail?.ml_country&&!country(detail.ml_country))provenanceFlags.push('derived-country-disagreement');
 const html=typeof detail?.description==='string'?detail.description:null,text=plain(html);const body=html?.match(/Job Description:\s*<\/b>\s*<\/h1>([\s\S]*?)(?=<h1[^>]*>\s*<b>Location:|$)/i)?.[1];if(!text||body!=null&&!plain(body))failures.push('missing-description');
 const publicationAssertions=resolvePublicationAssertions(listing,detail,posting,{sameRoleVerified:!failures.some(f=>['identity-mismatch','canonical-mismatch'].includes(f)),now});
 const known=publicationAssertions.selectedRawValue,jsonDate=posting?.datePosted??null;
 provenanceFlags.push(...publicationAssertions.flags);
 const nativeStates=[detail?.status,detail?.jobStatus,detail?.requisitionStatus].filter(x=>typeof x==='string'&&x.trim()).map(x=>x.toUpperCase()),unique=[...new Set(nativeStates)];const lifecycle=unique.length===1&&['OPEN','CLOSED','FILLED','EXPIRED'].includes(unique[0])?unique[0]:'UNKNOWN';if(unique.length>1)failures.push('lifecycle-conflict');
 const result={source:'arrowelectronics',companyName:'Arrow Electronics',jobId:listing.jobId,requisitionId:listing.reqId,title:listing.title,nativeEmployerLabels:{companyName:detail?.companyName??null,organization:detail?.organization??null,hiringOrganization:posting?.hiringOrganization??null},legalEmployer:null,legalEmployerProvenance:'not-independently-verified',locationEvidence:loc,detailLocationEvidence:dloc,jobDescriptionHtml:html,jobDescription:text,sourceDescriptionField:'phApp.ddo.jobDetail.data.job.description',nativeDescriptionModels:{description:detail?.description??null,ml_Description:detail?.ml_Description??null,jsonLdDescription:posting?.description??null},nativeDetail:detail,nativeJobPosting:posting,publication:{firstEverPublishedAt:null,firstEverProvenance:'unknown-native-model-does-not-prove-first-publication',sourcePostedDate:known,selectedPublication:publicationAssertions,jsonLdDatePosted:jsonDate,nativeCreatedAt:detail?.dateCreated??null,nativeUpdatedAt:detail?.jobUpdatedDate??null,recruitmentStartDate:detail?.recruitmentStartDate??null,capturedAt:now},lifecycle,lifecycleProvenance:nativeStates.length?'native-explicit-status':'native-status-missing',sourceListingComplete:inventoryComplete,sourceDetailComplete:failures.length===0,failures,provenanceFlags,nativeCountryEvidence};return result;
}
export function parseDetail(listing,html,options={}){const m=models(html);if(m.ddo.jobDetail?.status!==200)throw Error('Native detail upstream failure');const result=normalizeDetail(listing,m.ddo.jobDetail?.data?.job,{...options,posting:m.posting,canonical:m.canonical});result.nativePageStateEvidence=[...html.matchAll(/<[^>]*ph-page-state[^>]*>/g)].map(x=>({offset:x.index,rawTag:x[0]}));result.lifecyclePageStateNote='Retained exists/expired page-state markup is a client display template; hidden expired content cannot establish FILLED or OPEN.';result.jsonLdPostingPresent=!!m.posting;return result;}

// Publication assertions concern only the same verified native role. A source
// assertion is not evidence of first-ever requisition publication. Creation,
// update and recruitment-start fields never participate in this selection.
export function resolvePublicationAssertions(listing,detail,posting,{sameRoleVerified,now}={}){
 const assertions=[
  {field:'listing.postedDate',semantics:'native-listing-publication-assertion',rawValue:listing?.postedDate??null},
  {field:'detail.postedDate',semantics:'native-detail-publication-assertion',rawValue:detail?.postedDate??null},
  {field:'jsonLd.datePosted',semantics:'native-JobPosting-publication-assertion',rawValue:posting?.datePosted??null},
 ].map(candidate=>{
  const raw=candidate.rawValue,m=typeof raw==='string'?raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$)/):null;
  const calendarValid=!!m&&Number(m[2])>=1&&Number(m[2])<=12&&Number(m[3])>=1&&Number(m[3])<=new Date(Date.UTC(Number(m[1]),Number(m[2]),0)).getUTCDate();
  const epoch=calendarValid?Date.parse(raw):NaN,valid=calendarValid&&Number.isFinite(epoch);
  return {...candidate,status:raw==null||raw===''?'absent':valid?'valid':'invalid-or-unsupported',parsedAt:valid?new Date(epoch).toISOString():null,isFuture:valid&&Number.isFinite(Date.parse(now))?epoch>Date.parse(now):null,sameRoleVerified:!!sameRoleVerified};
 });
 const valid=assertions.filter(a=>a.status==='valid'),distinct=new Set(valid.map(a=>a.parsedAt)),flags=[];
 if(distinct.size>1)flags.push('source-publication-disagreement');
 if(assertions.some(a=>a.status==='invalid-or-unsupported'))flags.push('invalid-or-unsupported-publication-assertion');
 if(!sameRoleVerified)flags.push('publication-role-identity-unverified');
 const ordered=sameRoleVerified?[...valid].sort((a,b)=>Date.parse(a.parsedAt)-Date.parse(b.parsedAt)):[],selected=ordered[0]??null;
 return {sameRoleVerified:!!sameRoleVerified,assertions,selectedRawValue:selected?.rawValue??null,selectedAt:selected?.parsedAt??null,selectedField:selected?.field??null,selectionRule:'oldest-valid-native-publication-assertion-on-the-same-verified-role',firstEverPublishedAt:null,firstEverProvenance:'unknown',flags};
}

// Compare native primary assertions independently. A secondary India entry
// cannot reconcile a contradictory primary placement or an all-foreign public
// address model. ML country is deliberately absent from authoritative inputs.
const nativeCountryNames=new Map();
const displayNames=new Intl.DisplayNames(['en'],{type:'region'});
for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){
 const code=String.fromCharCode(a,b),name=displayNames.of(code);
 if(name!==code&&!['ZZ','EU','EZ','UN','XA','XB','QO'].includes(code)){const canonical=new Intl.Locale('und-'+code).region;nativeCountryNames.set(name.toLowerCase(),canonical);nativeCountryNames.set(code.toLowerCase(),canonical);}
}
for(const[name,code]of Object.entries({'united states of america':'US','usa':'US','uk':'GB','great britain':'GB','korea, republic of':'KR','south korea':'KR','czech republic':'CZ','viet nam':'VN','turkey':'TR'}))nativeCountryNames.set(name,code);
const countryLabel=value=>typeof value==='string'?value:value&&typeof value==='object'&&!Array.isArray(value)?value.name??value['@id']??null:null;
const nativeCountry=value=>{const label=countryLabel(value);return typeof label==='string'?nativeCountryNames.get(label.trim().toLowerCase())??null:null;};
const countrySuffix=value=>{
 if(typeof value!=='string')return null;
 const text=value.trim().toLowerCase();
 for(const[label,code]of[...nativeCountryNames].sort((a,b)=>b[0].length-a[0].length))if(text===label||text.endsWith(', '+label)||text.endsWith(','+label))return code;
 return null;
};
export function reconcileNativeCountries(listing,detail,posting){
 const failures=[],primary=[],secondary=[],typed=[];
 for(const[model,row]of[['listing',listing],['detail',detail??{}]]){
  const rowTyped=['country','standardisedCountry'].filter(field=>row[field]!=null&&row[field]!=='').map(field=>({field:model+'.'+field,rawValue:row[field],code:nativeCountry(row[field])}));typed.push(...rowTyped);
  const rowPrimary=['location','address','cityStateCountry'].filter(field=>row[field]!=null&&row[field]!=='').map(field=>({field:model+'.'+field,rawValue:row[field],code:countrySuffix(row[field])}));primary.push(...rowPrimary);
  const localTyped=new Set(rowTyped.map(x=>x.code).filter(Boolean));
  if(localTyped.size>1)failures.push(model+'-typed-country-conflict');
  for(const p of rowPrimary)if(p.code&&localTyped.size&&![...localTyped].includes(p.code))failures.push(p.field+'-versus-primary-country');
  for(const field of['multi_location','multi_location_array'])for(const[index,entry]of(Array.isArray(row[field])?row[field]:[]).entries()){
   const items=typeof entry==='string'?[{field:model+'.'+field+'['+index+']',rawValue:entry,code:countrySuffix(entry)}]:entry&&typeof entry==='object'?[
    ...['country','standardisedCountry'].filter(k=>entry[k]!=null).map(k=>({field:model+'.'+field+'['+index+'].'+k,rawValue:entry[k],code:nativeCountry(entry[k])})),
    ...['location','address','cityStateCountry'].filter(k=>entry[k]!=null).map(k=>({field:model+'.'+field+'['+index+'].'+k,rawValue:entry[k],code:countrySuffix(entry[k])})),
   ]:[];
   if(new Set(items.map(x=>x.code).filter(Boolean)).size>1)failures.push(model+'.'+field+'['+index+']-internal-country-conflict');
   secondary.push(...items);
  }
 }
 const primaryTyped=new Set(typed.map(x=>x.code).filter(Boolean));if(primaryTyped.size>1)failures.push('listing-detail-primary-country-conflict');
 const expected=nativeCountry(listing?.country)??nativeCountry(detail?.country);
 for(const placement of primary)if(expected&&placement.code&&placement.code!==expected)failures.push(placement.field+'-versus-listing-primary-country');
 const locations=Array.isArray(posting?.jobLocation)?posting.jobLocation:posting?.jobLocation?[posting.jobLocation]:[];
 const structured=locations.map((entry,index)=>({field:'jsonLd.jobLocation['+index+'].address.addressCountry',rawValue:entry?.address?.addressCountry??null,rawAddress:entry?.address??null,code:nativeCountry(entry?.address?.addressCountry)}));
 const structuredCodes=new Set(structured.map(x=>x.code).filter(Boolean)),nativeCodes=new Set([...typed,...primary,...secondary].map(x=>x.code).filter(Boolean));
 if(expected&&structuredCodes.size&&!structuredCodes.has(expected))failures.push('structured-addresses-omit-primary-country');
 for(const code of structuredCodes)if(nativeCodes.size&&!nativeCodes.has(code))failures.push('structured-address-country-without-native-placement:'+code);
 return{failures:[...new Set(failures)],typedPrimaryCountries:typed,primaryPlacements:primary,secondaryPlacements:secondary,structuredAddresses:structured,mlContext:{country:detail?.ml_country??null,authority:'context-only'},rawListing:listing,rawDetailPlacements:{country:detail?.country??null,standardisedCountry:detail?.standardisedCountry??null,location:detail?.location??null,address:detail?.address??null,cityStateCountry:detail?.cityStateCountry??null,multi_location:detail?.multi_location??null,multi_location_array:detail?.multi_location_array??null},rawStructuredLocations:posting?.jobLocation??null};
}
