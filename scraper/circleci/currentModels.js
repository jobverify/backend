import {all,flow,norm,snapshot} from '../anandengineeringproductspvtltd/currentHtml.js'
import {decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {greenhouseLocationLabels,greenhouseCountryLabels,hasUnhandledGreenhouseGeography} from '../../scraper-support/utils/greenhouseLocations.js'
import {roleUrl} from './native.js'
import {isDeepStrictEqual} from 'node:util'
import {calendarEvidence,rolePostingEvidence,hasUnhandledNestedWorkplace} from './currentQualifications.js'
import {need,failure,isFailure} from './currentErrors.js'
export {need,failure,isFailure}
export const CAREERS='https://circleci.com/careers/jobs/',HOME=CAREERS,API='https://boards-api.greenhouse.io/v1/boards/circleci/jobs?content=true',EMBED='https://boards.greenhouse.io/embed/job_board/js?for=circleci'
const activeTree=n=>typeof n==='string'?n:n.inert?'':{...n,children:n.children.map(activeTree)}
const activeText=n=>flow(activeTree(n))
// An India token cannot erase other countries or unresolved alternatives in
// the same publisher location string. These are exclusion checks only.
const foreignNames=(()=>{const names=new Set(['United States of America','USA','US','U.S.','U.S.A.','UK','U.K.','UAE','Great Britain']),display=new Intl.DisplayNames(['en'],{type:'region'});for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){const code=String.fromCharCode(a,b),name=display.of(code);if(code!=='IN'&&name&&name!==code)names.add(name)}return[...names].sort((a,b)=>b.length-a.length)})()
const foreignCountry=new RegExp('(?:^|[^\\p{L}])(?:'+foreignNames.map(v=>v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')(?:$|[^\\p{L}])','iu')
const one=(nodes,label)=>{need(nodes.length===1,'missing/ambiguous '+label);return nodes[0]}
const parse=html=>{try{return readVisibleNativeDocument(html,{strict:true})}catch(e){const error=failure('HTML contract failed');Object.defineProperty(error,'cause',{value:e});throw error}}
const whole=doc=>one(doc.nodes(n=>n.tag==='root'),'document root')
export function readCareers(html){
 const doc=parse(html),root=whole(doc),nodes=all(root),titles=nodes.filter(n=>n.tag==='title').map(n=>norm(n.raw||flow(n)))
 need(titles.length===1&&titles[0]==='Career Opportunities - CircleCI','careers publisher title differs');need(nodes.filter(n=>n.attrs.id==='jobs-list'&&!n.inert).length===1&&nodes.some(n=>n.tag==='h1'&&!n.inert&&norm(flow(n))==='Current open roles'),'current open roles scope missing')
 if(nodes.some(n=>(n.attrs.rel||'').toLowerCase().split(/\s+/).includes('next')))throw Object.assign(failure('new native continuation requires qualification'),{softFailure:true,upstreamOutage:false,failureKind:'surface_drift_or_fail_closed'})
 const roles=new Map()
 for(const anchor of nodes.filter(n=>n.tag==='a'&&/\/careers\/jobs\/\d+/.test(n.attrs.href||''))){
  let url;try{url=new URL(anchor.attrs.href,CAREERS)}catch{throw failure('invalid corporate role URL')}
  const id=url.pathname.match(/^\/careers\/jobs\/(\d+)\/$/)?.[1]
  need(url.origin==='https://circleci.com'&&!url.username&&!url.password&&id&&!url.hash&&url.searchParams.getAll('gh_jid').length===1&&url.searchParams.get('gh_jid')===id&&[...url.searchParams.keys()].every(k=>k==='gh_jid'),'foreign or malformed corporate role URL')
  const titleNode=one(all(anchor).filter(n=>n.tag==='h3'),'corporate role title'),locationNode=one(all(anchor).filter(n=>n.tag==='p'),'corporate role location'),title=norm(flow(titleNode)),location=norm(flow(locationNode));need(title&&location,'empty corporate title/location')
  const copy={literalHref:anchor.attrs.href,anchorTree:snapshot(anchor),enabled:!anchor.inert&&norm(activeText(titleNode))===title&&norm(activeText(locationNode))===location&&!Object.hasOwn(anchor.attrs,'disabled')&&anchor.attrs['aria-disabled']!=='true'}
  if(roles.has(id)){const r=roles.get(id);need(r.title===title&&r.location===location&&r.url===url.href,'conflicting duplicate corporate role');r.copies.push(copy);r.enabled ||=copy.enabled}else roles.set(id,{id,title,location,url:url.href,copies:[copy],enabled:copy.enabled})
 }
 need(roles.size>0&&roles.size<=30,'missing or excessive corporate cohort')
 return{tree:snapshot(root),roles:[...roles.values()],scriptDeclarations:nodes.filter(n=>n.tag==='script').map(snapshot),styleDeclarations:nodes.filter(n=>n.tag==='style'||n.tag==='link'&&(n.attrs.rel||'').toLowerCase().split(/\s+/).includes('stylesheet')).map(snapshot),publisherProgramsExecuted:false,externalHTMLRendererQualified:false}
}
export function readRole(html,url){
 const doc=parse(html),root=whole(doc),nodes=all(root),parents=new Map();for(const n of nodes)for(const child of n.children)if(typeof child!=='string')parents.set(child,n)
 const inArticle=n=>{for(let p=parents.get(n);p;p=parents.get(p))if(p.tag==='article')return true;return false},canonical=one(nodes.filter(n=>n.tag==='link'&&(n.attrs.rel||'').toLowerCase()==='canonical'&&!n.inert),'role canonical'),heading=one(nodes.filter(n=>n.tag==='h1'&&!n.inert&&!inArticle(n)),'role heading')
 need(new URL(canonical.attrs.href,url).href===url,'role canonical differs');need(nodes.filter(n=>n.attrs.id==='grnhse_app'&&!n.inert).length===1&&nodes.filter(n=>n.tag==='script'&&n.attrs.src===EMBED&&!n.inert).length===1,'active current CircleCI board handoff missing or foreign')
 // Native descriptions may contain their own article inside the publisher's
 // criteria article. Keep the complete outer boundary, including every child.
 const articles=nodes.filter(n=>n.tag==='article'&&!inArticle(n));need(articles.length===1,'missing/ambiguous native criteria article')
 return{tree:snapshot(root),canonicalURL:url,title:norm(flow(heading)),articleTree:snapshot(articles[0]),articleText:norm(flow(articles[0])),articleActiveText:norm(activeText(articles[0])),articleActive:!articles[0].inert,scriptDeclarations:nodes.filter(n=>n.tag==='script').map(snapshot),jsonLDDeclarations:nodes.filter(n=>n.tag==='script'&&(n.attrs.type||'').toLowerCase()==='application/ld+json').map(snapshot),publisherProgramsExecuted:false,renderedCriteriaVisibilityQualified:false}
}
export function readInventory(text){
 const value=JSON.parse(text);need(value&&typeof value==='object'&&!Array.isArray(value)&&Array.isArray(value.jobs)&&Number.isSafeInteger(value.meta?.total)&&value.meta.total===value.jobs.length&&value.jobs.length<=30,'native count absent, excessive or truncated')
 const ids=new Set();for(const r of value.jobs){need(Number.isSafeInteger(r?.id)&&r.id>0&&!ids.has(r.id)&&typeof r.title==='string'&&norm(r.title),'missing or duplicate native posting identity');ids.add(r.id);roleUrl(r)}
 return value
}
export const detailURL=id=>'https://boards-api.greenhouse.io/v1/boards/circleci/jobs/'+id+'?questions=true'
export function bind(record,detail,corporate,role,at){
 need(detail?.id===record.id&&detail.company_name==='CircleCI'&&norm(detail.title)===norm(record.title)&&roleUrl(detail)===roleUrl(record),'native detail employer/posting/title identity differs')
 // This documented field describes an applicant's location input, not a job
 // workplace. Retain it in detail while checking actual workplace fields.
 // eslint-disable-next-line no-unused-vars -- Deliberately omit applicant location form inputs from workplace fields.
 const {location_questions:applicantLocationQuestions,...detailWorkplaceFields}=detail
 const vacancyId=value=>Number.isSafeInteger(value)&&value>0
 const nativePostingKind=Object.hasOwn(record,'internal_job_id')&&Object.hasOwn(detail,'internal_job_id')&&record.internal_job_id===null&&detail.internal_job_id===null?'prospect':vacancyId(record.internal_job_id)&&record.internal_job_id===detail.internal_job_id?'vacancy':'unknown'
 const commonNativeFieldConflicts=['internal_job_id','location','offices','departments','metadata','requisition_id','updated_at','first_published','language'].filter(key=>Object.hasOwn(record,key)&&!isDeepStrictEqual(record[key],detail[key]))
 const content=value=>{need(typeof value==='string','missing native description HTML');const html=decodeNativeEntities(value),root=whole(parse(html));return{html,tree:snapshot(root),text:norm(flow(root)),activeText:norm(activeText(root))}},nativeDescription=content(detail.content),listingDescription=content(record.content),text=nativeDescription.text,listingText=listingDescription.text,corporateMatches=!!corporate&&corporate.enabled&&norm(corporate.title)===norm(record.title)&&norm(corporate.location)===norm(record.location?.name),roleMatches=!!role&&norm(role.title)===norm(record.title)&&role.articleActive&&role.articleText===role.articleActiveText&&role.articleText===text&&text===nativeDescription.activeText&&listingText===listingDescription.activeText
 const postingEvidence=rolePostingEvidence(role,record)
 const identityQualified=Boolean(corporateMatches&&roleMatches&&listingText&&text===listingText&&!commonNativeFieldConflicts.length),labels=[...new Set([...greenhouseLocationLabels(record),...greenhouseLocationLabels(detail),...greenhouseCountryLabels(record),...greenhouseCountryLabels(detail),...postingEvidence.labels])],explicitIndiaLabels=labels.filter(v=>/\bindia\b/i.test(v)),foreignCountryLabels=labels.filter(v=>foreignCountry.test(v)),unqualifiedAlternativeLabels=labels.filter(v=>/\b(?:or|and|worldwide|global|anywhere|international)\b|[;|/]/i.test(v)),allLabelsExplicitIndia=labels.length>0&&labels.every(v=>/\bindia\b/i.test(v)),unhandledGeography=hasUnhandledGreenhouseGeography(record)||hasUnhandledGreenhouseGeography(detailWorkplaceFields)||hasUnhandledNestedWorkplace(record)||hasUnhandledNestedWorkplace(detail)||postingEvidence.unhandledGeography,indiaQualified=identityQualified&&explicitIndiaLabels.length>0&&allLabelsExplicitIndia&&!unhandledGeography&&!foreignCountryLabels.length&&!unqualifiedAlternativeLabels.length
 return{identityQualified,nativePostingKind,nativeVacancyQualified:nativePostingKind==='vacancy'&&identityQualified,rolePostingEvidence:postingEvidence,nativeCalendarEvidence:calendarEvidence(record,detail,at,postingEvidence.boundPostings),corporateMatches,roleMatches,commonNativeFieldConflicts,nativeDescriptionText:text,listingDescriptionText:listingText,nativeDescriptionHTML:nativeDescription.html,nativeDescriptionModel:nativeDescription,listingDescriptionModel:listingDescription,nativeIndiaEvidence:{labels,explicitIndiaLabels,foreignCountryLabels,unqualifiedAlternativeLabels,unhandledGeography,allLabelsExplicitIndia,indiaQualified,companyGeographyUsed:false},renderedCriteriaVisibilityQualified:false,fullCriteriaQualified:false}
}
