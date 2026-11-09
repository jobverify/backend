import {isDeepStrictEqual} from 'node:util'
import {readNativeDocument,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {document as rawDocument} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {failure} from './runtime20261108.js'
export const PRIMARY='https://www.sigmasolve.com/who-we-are/openings',ORIGIN='https://www.sigmasolve.com'
export const need=(ok,message)=>{if(!ok)throw failure('Sigma Solve native: '+message,'SIGMASOLVE_NATIVE_PROOF')}
const one=(values,label)=>{need(values.length===1,'missing/ambiguous '+label);return values[0]}
const cls=(n,c)=>(n.attrs.class||'').split(/\s+/).includes(c)
const children=n=>n.children.filter(v=>typeof v==='object')
const parents=doc=>{const result=new Map();const visit=n=>{for(const child of children(n)){result.set(child,n);visit(child)}};visit(doc.nodes(n=>n.tag==='root')[0]);return result}
const up=(node,predicate,map)=>{for(let n=node;n;n=map.get(n))if(predicate(n))return n;return null}
export const roleURL=value=>{let u;try{u=new URL(value,PRIMARY)}catch{need(false,'invalid role URI')};need(u.origin===ORIGIN&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash&&/^\/who-we-are\/open-position\/[a-z0-9-]+$/.test(u.pathname),'unqualified native role URI');return u.href}
const all=(doc,node,predicate)=>{const map=parents(doc);return doc.nodes(n=>predicate(n)&&up(n,v=>v===node,map))}
const strictJSON=value=>{try{readLiteralModel(value);return JSON.parse(value)}catch{need(false,'invalid or duplicate native schema JSON')}}
function head(doc){
 const title=one(doc.nodes(n=>n.tag==='title'),'head title'),canonical=one(doc.nodes(n=>n.tag==='link'&&(n.attrs.rel||'').split(/\s+/).includes('canonical')),'canonical')
 return {title:decodeNativeEntities(title.raw).replace(/\s+/g,' ').trim(),canonical:canonical.attrs.href,metas:doc.nodes(n=>n.tag==='meta').map(n=>({...n.attrs})),schemas:doc.nodes(n=>n.tag==='script'&&(n.attrs.type||'').split(';')[0].trim().toLowerCase()==='application/ld+json').map(n=>strictJSON(n.raw))}
}
const hasPosting=value=>{if(!value||typeof value!=='object')return false;const type=value['@type'];return (Array.isArray(type)?type:[type]).includes('JobPosting')||Object.values(value).some(hasPosting)}
const hasUnreviewedDates=head=>head.metas.some(v=>['dateposted','validthrough','article:published_time','article:expiration_time','job:valid_through'].includes((v.name||v.property||'').toLowerCase()))
function publisher(model,url,title){need(model.canonical===url&&model.title===title,'head publisher or canonical role identity conflict');need(!model.schemas.some(hasPosting),'additional unreviewed JobPosting schema');need(model.schemas.some(v=>v?.['@type']==='Organization'&&v.name==='Sigma Solve'&&[ORIGIN,ORIGIN+'/'].includes(v.url)),'current native publisher identity missing')}
export function listing(html,onRecord){
 const doc=readVisibleNativeDocument(html,{strict:true}),native=readNativeDocument(html),raw=rawDocument(html),map=parents(doc),header=head(native)
 publisher(header,PRIMARY,'Open Positions | Sigma Solve');need(!doc.nodes(n=>n.tag==='base').length,'unreviewed native base URI');need(doc.nodes(n=>n.tag==='h2'&&doc.text(n)==='Career Opportunities at Sigma Solve').length===1,'current openings heading')
 const links=doc.nodes(n=>n.tag==='a'&&/\/open-position\//.test(n.attrs.href||'')),seen=new Set(),records=[]
 for(const link of links){const url=roleURL(link.attrs.href);need(!seen.has(url),'duplicate native role route');seen.add(url);const card=up(link,n=>n.tag==='li',map);need(card,'unbound native role card');const p=children(card).filter(n=>n.tag==='p');need(p.length===2,'unreviewed native listing fields');const values=children(p[1]).filter(n=>n.tag==='span').map(n=>doc.text(n).replace(/^\u00b7\s*/,''));const carrier=one(raw.nodes(n=>n.tag==='li'&&raw.nodes(c=>c.tag==='a'&&c.attrs.href===link.attrs.href,n).length===1),'original native card')
  const value={roleURL:url,title:doc.text(link),location:doc.text(p[0]),metadataValues:values,originalHTML:raw.outer(carrier)};records.push(value);onRecord?.(value)
 }
 need(records.length>0,'unproved empty native listing');return {head:header,records,observedRoleCount:records.length,companyGlobalTotal:null,companyIndiaTotal:null}
}
// Preserve every active direct carrier, including unsupported structures. A
// known-label filter cannot prove that the complete native contract is reviewed.
const metadataFrom=(doc,container,outer)=>{
 const records=[];let reviewedStructure=Boolean(container)
 if(!container)return {records,reviewedStructure}
 for(const child of container.children){
  if(typeof child==='string'){
   const value=decodeNativeEntities(child).replace(/\s+/g,' ').trim()
   if(value){records.push({label:null,value,...(outer?{nativeHTML:child}:{})});reviewedStructure=false}
   continue
  }
  if(child.inactive||child.inert)continue
  const parts=children(child).filter(n=>!n.inactive&&!n.inert),directText=child.children.filter(v=>typeof v==='string').map(decodeNativeEntities).join(' ').trim()
  const paired=parts.length>=2&&!directText,label=paired?doc.text(parts[0]):null,value=paired?parts.slice(1).map(n=>doc.text(n)).join(' ').replace(/\s+/g,' ').trim():doc.text(child)
  const known=child.tag==='span'&&parts.length===2&&!directText&&parts.every(n=>n.tag==='span'&&children(n).length===0)
  reviewedStructure&&=known
  records.push({label,value,...(outer?{nativeHTML:outer(child)}:{})})
 }
 return {records,reviewedStructure}
}
const isMetadataContainer=n=>n.tag==='div'&&['mt-4','flex-wrap','items-center','gap-3'].every(c=>cls(n,c))
export function own(html,listed,onRecord){
 const doc=readVisibleNativeDocument(html,{strict:true}),native=readNativeDocument(html),raw=rawDocument(html),map=parents(doc)
 // Locate the publisher's actual header independently of the expected title.
 const rawApply=one(raw.nodes(n=>n.tag==='a'&&raw.text(n)==='Apply for this job'),'original own application link'),rawHeader=up(rawApply,n=>n.tag==='section',parents(raw))
 need(rawHeader,'original own role header carrier')
 const rawHeadings=raw.nodes(n=>n.tag==='h2',rawHeader),actualTitle=rawHeadings.length===1?raw.text(rawHeadings[0]):null
 const applies=doc.nodes(n=>n.tag==='a'&&doc.text(n)==='Apply for this job'),section=applies.length===1?up(applies[0],n=>n.tag==='section',map):null,headings=section?all(doc,section,n=>n.tag==='h2'):[]
 const rawContainers=raw.nodes(isMetadataContainer,rawHeader),visibleContainers=section?all(doc,section,isMetadataContainer):[],rawContainer=rawContainers.length===1?rawContainers[0]:null,visibleContainer=visibleContainers.length===1?visibleContainers[0]:null
 const rawMetadata=metadataFrom(raw,rawContainer,n=>raw.outer(n)),visibleMetadata=metadataFrom(doc,visibleContainer),metadata=rawMetadata.records
 const rawCriteriaNodes=raw.nodes(n=>n.tag==='div'&&cls(n,'max-w-4xl')&&cls(n,'space-y-3')),criteriaNodes=doc.nodes(n=>n.tag==='div'&&cls(n,'max-w-4xl')&&cls(n,'space-y-3')),rawCriteria=rawCriteriaNodes.length===1?rawCriteriaNodes[0]:null,criteria=criteriaNodes.length===1?criteriaNodes[0]:null
 let applicationURL=null;try{applicationURL=new URL(rawApply.attrs.href,PRIMARY).href}catch{}
 const model={roleURL:listed.roleURL,title:actualTitle,metadata,applicationURL,originalHeaderHTML:raw.outer(rawHeader),descriptionHTML:rawCriteria?raw.outer(rawCriteria):null,description:criteria?doc.text(criteria):null,head:head(native)}
 // A conflict or absent criteria must not erase the current response's model.
 onRecord?.(model)
 publisher(model.head,listed.roleURL,listed.title+' | Sigma Solve');need(rawHeadings.length===1&&headings.length===1&&doc.text(headings[0])===model.title&&model.title===listed.title,'missing, hidden or conflicted own role heading');need(!doc.nodes(n=>n.tag==='base').length,'unreviewed native base URI')
 need(rawCriteria&&criteria&&model.description.length>100&&!raw.nodes(n=>n.tag==='form',rawCriteria).length,'complete own criteria missing or contains a form');need(raw.text(rawCriteria)===model.description,'hidden or discrepant own criteria')
 need(rawContainers.length===1&&visibleContainers.length===1&&raw.text(rawContainer)===doc.text(visibleContainer)&&isDeepStrictEqual(visibleMetadata.records,metadata.map(({label,value})=>({label,value}))),'missing, hidden or discrepant native metadata')
 const required=['Type','Location','Department','Openings'];need(required.every(k=>metadata.filter(v=>v.label===k).length===1)&&new Set(metadata.map(v=>v.label)).size===metadata.length,'missing/duplicate native role metadata')
 const field=key=>metadata.find(v=>v.label===key).value
 need(field('Location')===listed.location&&field('Type')===listed.metadataValues[0]&&field('Department')===listed.metadataValues[1],'listing/own title, employment, department or location conflict')
 need(applies.length===1&&new URL(applies[0].attrs.href,PRIMARY).href===applicationURL,'missing, hidden or discrepant own application link')
 const u=new URL(applicationURL);need(u.origin===ORIGIN&&!u.username&&!u.password&&!u.hash&&u.pathname==='/who-we-are/apply-for-job'&&u.searchParams.size===1&&u.searchParams.get('job')===listed.roleURL.split('/').at(-1),'application link identifies another role')
 return {model,contractQualified:rawMetadata.reviewedStructure&&visibleMetadata.reviewedStructure&&metadata.every(v=>required.includes(v.label))&&listed.metadataValues.length===2&&/^[1-9]\d*$/.test(field('Openings'))&&Number.isSafeInteger(Number(field('Openings')))&&!hasUnreviewedDates(model.head),nativePublicationDate:null,activeHiringVerified:false}
}
export const countryFor=location=>location==='United States'?'United States':location==='India'?'India':null
