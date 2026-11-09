// Source-specific Jobvite native contract. Existing active HTML helpers remain unchanged.
// balanced raw extraction below preserves complete main and description markup.
import {readNativeDocument,extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js';
import {validateURL, createNativeFetchText} from './transport.js';
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js';
import {normalizeCity} from '../../scraper-support/utils/cityNormalizer.js';
import {CANONICAL_CITIES} from '../../scraper-support/utils/cities.js';
export const HOME='https://www.gigamon.com/',CAREERS='https://www.gigamon.com/company/careers.html',BOARD='https://jobs.jobvite.com/gigamon';
const need=(ok,message)=>{if(!ok)throw Error(message);};
const norm=x=>String(x??'').replace(/\s+/g,' ').trim();
const country=x=>norm(typeof x==='object'?x?.name??x?.['@id']:x).toLowerCase();
const descendants=(n,p)=>[...(p(n)?[n]:[]),...(n.children||[]).filter(x=>typeof x!=='string'&&!x.inert).flatMap(x=>descendants(x,p))];
const one=(nodes,label)=>{need(nodes.length===1,'Expected one '+label);return nodes[0];};
const cls=(n,c)=>(n.attrs.class||'').split(/\s+/).includes(c);
const knownIndiaCities=new Set(Object.values(CANONICAL_CITIES).filter(x=>x&&x!=='None').map(x=>x.toLowerCase()));
export function rawElement(html,predicate){
 const tokens=/<!--[\s\S]*?(?:-->|$)|<![^>]*>|<\/?([a-z][a-z0-9:-]*)\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>/gi,stack=[],voids=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']),raw=new Set(['script','style','title','textarea','xmp','iframe','noembed','noframes','noscript']);let match,target=null;
 while((match=tokens.exec(html))){if(!match[1])continue;const tag=match[1].toLowerCase();if(match[0][1]==='/'){const at=stack.findLastIndex(n=>n.tag===tag);if(at>=0){if(target&&stack.slice(at).includes(target)){need(stack[at]===target,'Unbalanced content element');return html.slice(target.start,tokens.lastIndex);}stack.length=at;}continue;}
  const local=readNativeDocument(match[0]+'</'+tag+'>'),active=local.nodes(n=>n.tag===tag).length>0,node={tag,start:match.index,inert:!active||stack.some(n=>n.inert)};
  if(!target&&!node.inert&&local.nodes(predicate).length)target=node;
  if(raw.has(tag)){const end=new RegExp('</'+tag+'\\s*>','ig');end.lastIndex=tokens.lastIndex;const close=end.exec(html);need(close,'Unclosed raw text element');tokens.lastIndex=end.lastIndex;continue;}
  if(!voids.has(tag))stack.push(node);
 }
 throw Error('Incomplete raw content element');
}
export function parseDate(value,label){
 if(value===undefined||value===null||value==='')return null;
 need(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value),'Invalid '+label);
 const t=Date.parse(value),day=Date.parse(value.slice(0,10)+'T00:00:00Z');need(Number.isFinite(t)&&Number.isFinite(day)&&new Date(day).toISOString().slice(0,10)===value.slice(0,10),'Invalid '+label);return value;
}
export function verifyIdentity(home,careers){
 const h=readNativeDocument(home),c=readNativeDocument(careers);
 need(h.nodes(n=>n.tag==='title').some(n=>/Gigamon/i.test(n.raw||''))&&h.nodes(n=>n.tag==='a'&&new URL(n.attrs.href||'/',HOME).href===CAREERS).length,'Official homepage identity/handoff mismatch');
 need(c.nodes(n=>n.tag==='title').some(n=>/Careers.*Gigamon/i.test(n.raw||''))&&c.nodes(n=>n.tag==='a'&&n.attrs.href===BOARD).length,'Official careers identity/handoff mismatch');
}
export function parseBoard(html,url=BOARD){
 const d=readNativeDocument(html),body=d.nodes(n=>n.tag==='body');
 need(d.nodes(n=>n.tag==='title').some(n=>/^Gigamon Careers$/.test(n.raw||''))&&d.nodes(n=>n.tag==='a'&&n.attrs.href===HOME).length&&/Powered by Jobvite/.test(d.text(one(body,'board body'))),'Native board identity mismatch');
 const tables=d.nodes(n=>n.tag==='table'&&cls(n,'jv-job-list')),listings=[];
 for(const table of tables)for(const row of descendants(table,n=>n.tag==='tr')){
  const names=descendants(row,n=>n.tag==='td'&&cls(n,'jv-job-list-name'));if(!names.length){need(descendants(row,n=>n.tag==='th').length>0,'Unrecognized native row');continue;}
  const name=one(names,'listing name'),a=one(descendants(name,n=>n.tag==='a'),'listing link'),location=d.text(one(descendants(row,n=>n.tag==='td'&&cls(n,'jv-job-list-location')),'listing location'));
  const detailURL=validateURL(new URL(a.attrs.href,url).href),id=new URL(detailURL).pathname.match(/^\/gigamon\/job\/([A-Za-z0-9]+)\/?$/)?.[1];
  need(id&&d.text(a)&&location,'Incomplete native listing');listings.push({id,title:d.text(a),listingLocation:location,detailURL});
 }
 const advertisedIDs=[...new Set(d.nodes(n=>n.tag==='a'&&/^\/gigamon\/job\/[A-Za-z0-9]+\/?$/.test(new URL(n.attrs.href||'/',url).pathname)).map(n=>new URL(n.attrs.href,url).pathname.match(/\/job\/([A-Za-z0-9]+)/)[1]))];
 need(advertisedIDs.length===new Set(listings.map(l=>l.id)).size,'Unmapped native detail anchors');
 // Follow advertised public board destinations even when labels change. A
 // client-only continuation has no reviewed GET contract and prevents closure.
 const continuationLabel=node=>[d.text(node),node.attrs['aria-label'],node.attrs.title].filter(Boolean).join(' ');
 const continuationText=value=>/\b(?:next(?:\s+(?:page|jobs?|positions?|openings?|results?))?|(?:load|show|view|see|fetch)\s*more|more\s+(?:jobs?|positions?|openings?|results?))\b/i.test(value);
 const dynamicContinuation=node=>Object.entries(node.attrs).some(([key,value])=>{
  if(/infinite[-_:]?scroll/i.test(key))return true;
  if(!['ng-click','data-ng-click','x-ng-click','onclick','data-action'].includes(key))return false;
  const action=value.replace(/[^a-z0-9]/gi,'').toLowerCase();
  return /(?:load|fetch|show|view|see)(?:more|next)|nextpage|infinite(?:scroll)?/.test(action);
 });
 const anchors=d.nodes(n=>n.tag==='a'),next=[];
 for(const node of d.nodes(n=>n.tag!=='script')){
  need(!dynamicContinuation(node),'Unresolved native continuation');
  if(node.tag==='button'||node.attrs.role==='button')need(!continuationText(continuationLabel(node)),'Unresolved native continuation');
 }
 for(const anchor of anchors){
  let destination=null;try{destination=new URL(anchor.attrs.href,url);}catch{/* An advertised continuation without a valid URL fails below. */}
  const boardDestination=destination?.origin===new URL(BOARD).origin&&/^\/gigamon\/?$/.test(destination.pathname);
  const advertised=(anchor.attrs.rel||'').toLowerCase().split(/\s+/).includes('next')||continuationText(continuationLabel(anchor))||/^\d+$/.test(d.text(anchor))||(boardDestination&&Boolean(destination.search));
  if(!advertised)continue;
  need(anchor.attrs.href&&destination,'Unresolved native continuation');
  const approved=validateURL(destination.href),target=new URL(approved);
  need(target.origin===new URL(BOARD).origin&&/^\/gigamon\/?$/.test(target.pathname),'Invalid pagination target');
  if(!next.includes(approved))next.push(approved);
 }
 need(listings.length>0||/There are (?:currently )?no open positions|No (?:open )?(?:positions|jobs) (?:are )?(?:currently )?available/i.test(d.text(one(body,'board body'))),'Unverified empty board');
 const unique=new Map();for(const row of listings){if(unique.has(row.id))need(JSON.stringify(unique.get(row.id))===JSON.stringify(row),'Conflicting duplicate native role');else unique.set(row.id,row);}
 return {listings:[...unique.values()],next,nativePortalEmpty:listings.length===0,paginationEvidence:{tables:tables.length,rows:listings.length,uniqueRows:unique.size,nextURLs:next,unfilteredURL:url}};
}
export function parseDetail(html,listing,{now=new Date().toISOString()}={}){
 const d=readNativeDocument(html),scripts=d.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json'),models=[];
 for(const s of scripts){let x;try{x=JSON.parse(s.raw);}catch{throw Error('Invalid native JSON-LD');}const visit=v=>{if(!v||typeof v!=='object')return;if(v['@type']==='JobPosting')models.push(v);for(const z of Object.values(v))if(typeof z==='object')Array.isArray(z)?z.forEach(visit):visit(z);};visit(x);}
 const model=one(models,'JobPosting'),organization=norm(typeof model.hiringOrganization==='string'?model.hiringOrganization:model.hiringOrganization?.name),id=typeof model.identifier==='object'?model.identifier?.value:model.identifier;
 need(organization==='Gigamon'&&id===listing.id&&norm(model.title)===listing.title,'Native detail identity/model mismatch');
 need(d.nodes(n=>n.tag==='h2'&&d.text(n)===listing.title).length===1,'Visible native title mismatch');
 const main=one(d.nodes(n=>n.attrs.role==='main'),'detail main'),description=one(d.nodes(n=>cls(n,'jv-job-detail-description')),'full native description'),meta=one(d.nodes(n=>cls(n,'jv-job-detail-meta')),'native location metadata');
 const nativeDescriptionHTML=rawElement(html,n=>cls(n,'jv-job-detail-description')),mainHTML=rawElement(html,n=>n.attrs.role==='main');
 const supplements=d.nodes(n=>cls(n,'jv-disclaimer-cws-wrapper'));need(supplements.length<=1,'Ambiguous supplemental native disclaimer');
 const supplementalHTML=supplements.length?[rawElement(html,n=>cls(n,'jv-disclaimer-cws-wrapper'))]:[];
 const visibleDescription=extractActiveDescription(nativeDescriptionHTML),modelText=extractActiveDescription(model.description);
 need(visibleDescription&&modelText&&modelText.length>=120&&visibleDescription.includes(modelText),'Missing/incomplete native job description');
 const locations=Array.isArray(model.jobLocation)?model.jobLocation:[model.jobLocation];need(locations.length&&locations.every(x=>x?.address&&country(x.address.addressCountry)),'Missing typed role country');
 const india=locations.filter(x=>['india','in'].includes(country(x.address.addressCountry))),visibleLocation=d.text(meta);
 const corroboration=india.map(x=>{const a=x.address,parts=[a.addressLocality,a.addressRegion].filter(Boolean).map(norm);const visible=parts.length?parts.every(p=>visibleLocation.includes(p)):/\bIndia\b/.test(visibleLocation);const listingEvidence=(parts.length>0&&parts.every(p=>listing.listingLocation.includes(p)))||/\bIndia\b|\b\d+ Locations\b/.test(listing.listingLocation);return{address:a,visible,listing:listingEvidence};});
 need(!india.length||corroboration.every(x=>x.visible&&x.listing),'Ambiguous India role assignment');
 const posted=parseDate(model.datePosted,'datePosted'),modified=parseDate(model.dateModified,'dateModified'),validThrough=parseDate(model.validThrough,'validThrough');
 const applyURLs=[...new Set(d.nodes(n=>n.tag==='a'&&n.attrs.href&&new URL(n.attrs.href,listing.detailURL).pathname===`/gigamon/job/${listing.id}/apply`).map(n=>new URL(n.attrs.href,listing.detailURL).href))];
 need(applyURLs.length===1,'Missing/ambiguous advertised apply URL');
 const applyURL=new URL(applyURLs[0]);need(applyURL.protocol==='https:'&&applyURL.hostname==='jobs.jobvite.com'&&!applyURL.username&&!applyURL.password&&!applyURL.port,'Untrusted advertised apply origin');
 const roleAssignmentEvidence=[...visibleDescription.matchAll(/(?:^|[.!?]\s+)([^.!?]*\b(?:based in|located in|position is (?:based |located )?in|role is (?:based |located )?in)[^.!?]*[.!?])/gi)].map(m=>m[1].trim());
 const roleAssignments=roleAssignmentEvidence.filter(s=>!/\b(?:headquarters|headquartered|head office)\b/i.test(s)).map(context=>({context,assignedPlace:context.match(/\b(?:based in|located in|position is (?:based |located )?in|role is (?:based |located )?in)\s+([^,;.]+)/i)?.[1]?.trim()??null}));
 const indiaAssignment=x=>/\bIndia\b/i.test(x.assignedPlace||'')||knownIndiaCities.has(normalizeCity(x.assignedPlace)?.toLowerCase())||india.some(p=>[p.address.addressRegion,...String(p.address.addressLocality||'').split(',')].some(v=>norm(v).toLowerCase()===norm(x.assignedPlace).toLowerCase()));
 const foreignAssignments=roleAssignments.filter(x=>!indiaAssignment(x)||/\b(?:United States|United Kingdom|USA|U\.?S\.?|California|Santa Clara|Mexico|London|Australia|Sydney|Melbourne|Thailand|Singapore)\b/i.test(x.assignedPlace||''));
 const scopeDisposition=india.length?(foreignAssignments.length?'excluded-ambiguous-explicit-role-assignment':'corroborated-india'):'excluded-foreign-typed-role-country';
 const city=india.map(x=>x.address.addressLocality).filter(Boolean).map(normalizeCity)[0]||roleAssignments.filter(indiaAssignment).map(x=>normalizeCity(x.assignedPlace)).find(c=>knownIndiaCities.has(c?.toLowerCase()))||null;
 const location=india.length?india.map(x=>[x.address.addressLocality,x.address.addressRegion,'India'].filter(Boolean).join(', ')).join('; '):locations.map(x=>Object.values(x.address).filter(v=>typeof v==='string'&&v!=='PostalAddress').join(', ')).join('; ');
 const jobDescription=[visibleDescription,...supplementalHTML.map(extractActiveDescription)].filter(Boolean).join('\n\n');
 return{source:'gigamon',company:'Gigamon',jobId:listing.id,nativePublicJobId:listing.id,requisitionId:null,sourceRequisitionId:null,identifierSemantics:'Jobvite native public role identifier; requisition semantics unestablished',title:listing.title,sourceUrl:listing.detailURL,applyUrl:applyURLs[0],link:applyURLs[0],applicationVisited:false,nativeReportedHiringOrganization:organization,legalEmployer:null,originalPublicationDate:null,postingDate:posted,postedAt:posted,closingDate:validThrough,sourceReportedDatePosted:posted,sourceReportedDateModified:modified,sourceReportedValidThrough:validThrough,sourceRawDates:{datePosted:model.datePosted??null,dateModified:model.dateModified??null,validThrough:model.validThrough??null},sourceClosingDateIsExact:validThrough!==null&&validThrough.includes('T'),closingDatePrecision:validThrough===null?'unknown':validThrough.includes('T')?'timestamp':'calendar-date',dateSemantics:'Source-reported datePosted; original publication unknown; modification retained separately',country:india.length?'India':null,city,jobLocations:india.length?india:locations,nativeJobLocations:locations,location,visibleLocation,listingLocation:listing.listingLocation,locationEvidence:corroboration,roleAssignmentEvidence,roleAssignments,foreignAssignments,scopeDisposition,nativeJobPosting:model,nativeDescriptionHTML,supplementalHTML,sourceDescriptionHTML:[nativeDescriptionHTML,...supplementalHTML].join('\n'),mainHTML,rawHTML:html,modelDescriptionHTML:model.description,jobDescription,sourceDescription:jobDescription,employmentType:model.employmentType??null,department:model.industry??null,fullMainText:d.text(main),isIndia:scopeDisposition==='corroborated-india',sourceDetailComplete:true,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,scrapedAt:now};
}
export async function collect(options={}){
 const nowValue=typeof options.now==='function'?options.now():options.now??new Date().toISOString(),now=new Date(nowValue).toISOString();
 const maxPages=options.maxPages??30,packets=[],fetchText=createNativeFetchText({...options,packets});
 const jobs=[],excluded=[],failures=[],pages=[],seen=new Set(),listingMap=new Map();let firstPage=null,closureComplete=false;
 try{
  verifyIdentity(await fetchText(HOME),await fetchText(CAREERS));let queue=[BOARD];
  while(queue.length){options.signal?.throwIfAborted();const u=queue.shift();need(!seen.has(u),'Native pagination cycle');need(seen.size<maxPages,'Native pagination bound');seen.add(u);const b=parseBoard(await fetchText(u),u);if(firstPage===null)firstPage=b;pages.push(b.paginationEvidence);for(const l of b.listings){if(listingMap.has(l.id))need(JSON.stringify(listingMap.get(l.id))===JSON.stringify(l),'Conflicting duplicate native role');else listingMap.set(l.id,l);}queue.push(...b.next);}
  for(const listing of listingMap.values()){options.signal?.throwIfAborted();let rawHTML=null;try{rawHTML=await fetchText(listing.detailURL);const j=parseDetail(rawHTML,listing,{now});(j.isIndia?jobs:excluded).push(j);}catch(e){failures.push({id:listing.id,url:listing.detailURL,listing,message:e.message,rawHTML});}}
  const finalPage=parseBoard(await fetchText(BOARD));need(JSON.stringify(finalPage)===JSON.stringify(firstPage),'Native inventory changed during detail capture');closureComplete=true;
 }catch(e){failures.push({stage:'identity-pagination-or-closure',name:e.name,message:e.message});}
 const complete=failures.length===0&&pages.length>0&&closureComplete&&jobs.length+excluded.length===listingMap.size;
 return{complete,nativePortalComplete:complete,status:complete?(jobs.length?'native-portal-complete':'native-portal-empty-coverage-gap'):'partial',cleanupAllowed:false,sourceScopeComplete:false,jobs,excluded,failures,transportPackets:packets,pages,listingCount:complete?listingMap.size:null,observedListingCount:listingMap.size,checkedAt:now};
}
export async function runNative(options={}){
 const result=await collect(options);if(!result.complete){const error=new Error('Gigamon collection incomplete; cleanup forbidden');error.nativeEvidence=result;throw error;}
 const jobs=attachInventoryEvidence(result.jobs,{status:'coverage-gap',surface:BOARD,firstParty:true,listingComplete:false,pagesFetched:result.pages.length,reportedTotal:result.listingCount,indiaFacetCount:result.jobs.length,verifiedAt:result.checkedAt,reason:'native-Jobvite-public-portal-closure-only;whole-employer-and-original-publication-unknown;cleanup-forbidden'});
 Object.defineProperty(jobs,Symbol.for('jobverify.gigamon-native-evidence'),{value:result});return jobs;
}
