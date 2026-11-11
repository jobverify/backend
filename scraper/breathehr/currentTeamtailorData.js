import {decodeHTML} from 'entities'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {normalizeNativeAttributeBoundaries} from '../../scraper-support/utils/nativeHtmlAttributes.js'
import {parseEightfoldJson as parseNativeJSON} from '../../scraper-support/utils/recruitmentEightfoldData.js'
import {nativeCountryName,nativeLocationCountryName} from '../../scraper-support/shared/nativeJobPosting.js'

export const CORPORATE='https://www.breathehr.com/'
export const CORPORATE_CANONICAL=CORPORATE+'en-gb/'
export const HOME='https://careers.breathehr.com/'
export const LIST=HOME+'jobs'
const ACCOUNT='https://elmogroup-demo.teamtailor.com'
export const failure=message=>Object.assign(Error('BreatheHR current Teamtailor: '+message),{
 softFailure:true,upstreamOutage:false,abortRetries:true,failureKind:'coverage_gap',lifecycleCleanupAllowed:false})
const need=(value,message)=>{if(!value)throw failure(message)}
const norm=value=>String(value??'').normalize('NFC').replace(/\s+/gu,' ').trim()
const elements=node=>node.children.filter(c=>typeof c!=='string')
const walk=(node,ancestors=[])=>[{node,ancestors},...elements(node).flatMap(c=>walk(c,[...ancestors,node]))]
const nodes=node=>walk(node).filter(({node})=>!node.inert).map(({node})=>node)
const text=node=>node.inert||['script','style','template','noscript'].includes(node.tag)?'':norm(node.children.map(c=>typeof c==='string'?decodeHTML(c):text(c)).join(' '))
const hasClass=(node,name)=>(node.attrs.class||'').split(/\s+/).includes(name)
const unique=(values,label)=>{need(values.length===1,'Expected unique '+label);return values[0]}
const context=html=>{
 need(typeof html==='string'&&Buffer.byteLength(html)<=4e6,'Missing or oversized native HTML')
 const normalized=normalizeNativeAttributeBoundaries(html),d=readNativeDocument(normalized),v=readVisibleNativeDocument(normalized,{strict:true})
 const root=unique(d.nodes(n=>n.tag==='root'),'native document'),visible=unique(v.nodes(n=>n.tag==='root'),'visible document')
 need(!nodes(root).some(n=>n.tag==='base'),'Unreviewed native document base')
 return {root,visible,rawEntries:walk(root),active:nodes(root),shown:nodes(visible)}
}
const resolved=(value,page)=>{try{const u=new URL(value,page);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port?u:null}catch{return null}}
export const nativeRoleURL=value=>{
 const u=resolved(value,HOME)
 return u&&u.origin===new URL(HOME).origin&&!u.search&&!u.hash&&/^\/jobs\/([1-9]\d{5,11})-[a-z0-9-]+$/.test(u.pathname)?u.href:null
}
const href=(node,page)=>resolved(node.attrs.href,page)?.href
const careersLabel=value=>/^(?:careers?|jobs?|all jobs|job openings|open positions|view all jobs|join (?:us|our team))$/i.test(norm(value))
 ||/\b(?:careers|openings)\b|\bopen (?:roles|positions)\b/i.test(norm(value))
const recruitmentDestination=value=>{
 const u=new URL(value),host=u.hostname
 return ['boards.greenhouse.io','job-boards.greenhouse.io','boards-api.greenhouse.io','jobs.lever.co','jobs.ashbyhq.com',
  'apply.workable.com','careers.smartrecruiters.com'].includes(host)||host.endsWith('.myworkdayjobs.com')
  ||host.endsWith('.teamtailor.com')&&!['www.teamtailor.com','app.teamtailor.com'].includes(host)
   &&/^\/(?:$|jobs(?:\/|$)|careers(?:\/|$))/.test(u.pathname)
}
function programmeLinks(c,page){
 return c.shown.filter(n=>n.tag==='a'&&n.attrs.href).map(n=>({url:href(n,page),label:text(n)})).filter(l=>l.url)
}
export function corporateProgram(html){
 const c=context(html),titles=c.active.filter(n=>n.tag==='title').map(n=>norm(decodeHTML(n.raw||'')))
 need(titles.length===1&&/\bBreathe\b/.test(titles[0]),'Current corporate publisher identity changed')
 const links=programmeLinks(c,CORPORATE_CANONICAL),careers=links.filter(l=>careersLabel(l.label)
  ||/^(?:careers?|jobs?)\./.test(new URL(l.url).hostname)||recruitmentDestination(l.url))
 need(careers.length>0&&careers.every(l=>l.url===HOME),'Current corporate careers handoff or recruitment programme changed')
 return {url:CORPORATE_CANONICAL,publisherTitle:titles[0],declaredCareerURLs:[...new Set(careers.map(l=>l.url))]}
}
function nativeProgramme(c,page){
 const links=programmeLinks(c,page)
 need(links.some(l=>l.url===CORPORATE_CANONICAL),'Native reciprocal current corporate publisher missing')
 const starts=links.filter(l=>careersLabel(l.label)||recruitmentDestination(l.url))
 need(starts.every(l=>{
  const u=new URL(l.url)
  return u.origin===new URL(HOME).origin&&['/','/jobs'].includes(u.pathname)&&!u.search
   ||u.origin==='https://www.teamtailor.com'&&/^career site by teamtailor$/i.test(l.label)
 }),'Additional or unreviewed native recruitment programme')
 return links
}
function frames(c){
 need(c.rawEntries.filter(({node})=>node.attrs.id==='jobs_list').length===1,'Expected unique native jobs frame including inert shadows')
 const frame=unique(c.shown.filter(n=>n.tag==='turbo-frame'&&n.attrs.id==='jobs_list'),'visible native jobs frame')
 need(!Object.hasOwn(frame.attrs,'src'),'Unreviewed deferred native frame source')
 return frame
}
function cards(c,frame,page){
 const inside=nodes(frame)
 need(c.rawEntries.filter(({node})=>node.attrs.id==='jobs_list_container').length===1,'Expected unique native card inventory including inert shadows')
 const container=unique(inside.filter(n=>n.tag==='ul'&&n.attrs.id==='jobs_list_container'),'visible native card inventory')
 const all=elements(container)
 need(all.every(n=>n.tag==='li'&&!n.inert),'Unreviewed or hidden native inventory row')
 need(all.length>0,'Native card inventory missing')
 const parsed=all.map(card=>{
  const own=nodes(card),links=own.filter(n=>n.tag==='a'&&n.attrs.href)
  need(links.length===1,'Each native card must have exactly one inventoried role link')
  const link=links[0],url=nativeRoleURL(href(link,page))
  need(url,'Native card role identity changed')
  const metadata=unique(own.filter(n=>page===HOME?n.tag==='span'&&hasClass(n,'text-base'):
   n.tag==='div'&&hasClass(n,'text-md')&&hasClass(n,'mt-4')),'native card metadata')
  const spans=elements(metadata)
  need(spans.every(n=>n.tag==='span'),'Unreviewed native card metadata model')
  const values=spans.filter(n=>!hasClass(n,'mx-[2px]')).map(text)
  need(values.length===3||values.length===4,'Native card metadata/location scope changed')
  need(values[0]==='BreatheHR','Native card Division identity changed')
  const mode=values.at(-1),location=values.at(-2)
  need(['Hybrid','Onsite'].includes(mode)&&location,'Unqualified native card country/work mode scope')
  const separators=spans.filter(n=>hasClass(n,'mx-[2px]'))
  need(separators.length===values.length-1&&separators.every(n=>text(n)==='·'),'Native card metadata separator changed')
  return {id:new URL(url).pathname.match(/^\/jobs\/(\d+)-/)[1],url,title:text(link),division:values[0],
   location,remoteStatus:mode,department:values.length===4?values[1]:null,rawVisibleMetadata:text(metadata)}
 })
 need(new Set(parsed.map(r=>r.id)).size===parsed.length&&new Set(parsed.map(r=>r.url)).size===parsed.length,'Duplicate native card role identity')
 const inventoried=new Set(parsed.map(r=>r.url))
 const linked=inside.filter(n=>n.tag==='a'&&n.attrs.href).map(n=>href(n,page)).filter(u=>nativeRoleURL(u))
 need(linked.length===parsed.length&&linked.every(u=>inventoried.has(u)),'Unreconciled native role link outside cards')
 const pageRoles=c.shown.filter(n=>n.tag==='a'&&n.attrs.href).map(n=>href(n,page)).filter(u=>nativeRoleURL(u))
 need(pageRoles.every(u=>inventoried.has(u)),'Additional native role outside inventoried programme')
 need(!inside.some(n=>n.attrs.rel==='next'||Object.keys(n.attrs).some(k=>/pagin|has.more|next.page/i.test(k)))
  &&!inside.some(n=>n.tag==='a'&&/[?&](?:page|cursor|offset)=/.test(n.attrs.href||'')),'Unvisited native pagination declaration')
 return parsed
}
export function nativeHome(html){
 const c=context(html),links=nativeProgramme(c,HOME)
 const title=unique(c.active.filter(n=>n.tag==='title'),'native home title')
 need(norm(decodeHTML(title.raw||''))==='Careers at Breathe HR | Hybrid Jobs in Horsham - BreatheHR','Native home publisher identity changed')
 need(links.some(l=>l.url===LIST&&l.label==='All jobs'),'Complete native jobs programme handoff missing')
 return {cards:cards(c,frames(c),HOME)}
}
function filters(c,frame){
 unique(nodes(frame).filter(n=>n.tag==='form'&&n.attrs.id==='blocks-jobs-filters-form'),'visible unfiltered native jobs form')
 const form=unique(c.rawEntries.filter(({node})=>node.attrs.id==='blocks-jobs-filters-form'),'original unfiltered native jobs form').node
 need(form.tag==='form'&&!form.inert,'Original native jobs filter form is inactive or changed')
 need(form.attrs.action==='/jobs'&&form.attrs.method==='get'&&form.attrs['data-turbo-frame']==='jobs_list','Native filter route/model changed')
 // Hidden successful fields still submit. Inspect the original form rather
 // than its visible projection; template controls are not part of the form.
 const controls=c.rawEntries.filter(({node,ancestors})=>['input','select','textarea'].includes(node.tag)
  &&!ancestors.some(n=>['template','noscript'].includes(n.tag))
  &&(Object.hasOwn(node.attrs,'form')?node.attrs.form===form.attrs.id:ancestors.findLast(n=>n.tag==='form')===form))
  .map(({node})=>node)
 need(controls.length===5,'Unreviewed native filter control')
 const submit=unique(controls.filter(n=>n.tag==='input'&&n.attrs.type==='submit'),'native harmless search submit')
 need(!Object.hasOwn(submit.attrs,'name')&&submit.attrs.value==='search','Unreviewed native submit filter')
 const query=unique(controls.filter(n=>n.tag==='input'&&n.attrs.name==='query'),'native query filter')
 need(query.attrs.type==='text'&&!query.attrs.value&&!Object.hasOwn(query.attrs,'disabled'),'Native query filter is not empty')
 for(const name of ['department','location','remote_status_id']){
  const select=unique(controls.filter(n=>n.tag==='select'&&n.attrs['data-name']===name),'native '+name+' filter')
  const options=elements(select),selected=options.filter(n=>Object.hasOwn(n.attrs,'selected'))
  need(options.length>0&&options.every(n=>n.tag==='option')&&options[0].attrs.value===''&&text(options[0])==='All'
   &&!Object.hasOwn(options[0].attrs,'disabled')
   &&(!selected.length||selected.length===1&&selected[0]===options[0])&&!Object.hasOwn(select.attrs,'disabled'),
  'Native '+name+' filter is not unfiltered')
 }
}
export function nativeListing(html){
 const c=context(html);nativeProgramme(c,LIST)
 const frame=frames(c);filters(c,frame)
 const listContainer=unique(nodes(frame).filter(n=>n.attrs['data-blocks--jobs-target']==='jobsListContainer'),'visible native inventory container')
 const counter=unique(nodes(listContainer).filter(n=>n.tag==='h2'&&/^\d+ jobs?$/.test(text(n))),'native job count')
 const count=Number(text(counter).split(' ')[0]),rows=cards(c,frame,LIST)
 need(count>0&&Number.isSafeInteger(count)&&count===rows.length,'Native reported count and complete card inventory disagree')
 return {reportedTotal:count,rows}
}
function timestamp(value,now){
 const match=typeof value==='string'&&value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/)
 need(match,'Native publication date format changed')
 const [y,m,d,h,minute,second]=match.slice(1,7).map(Number),offset=match[8]
 need(y>=1970&&m>=1&&m<=12&&d>=1&&d<=new Date(Date.UTC(y,m,0)).getUTCDate()&&h<24&&minute<60&&second<60
  &&(offset==='Z'||Number(offset.slice(1,3))<24&&Number(offset.slice(4,6))<60),'Invalid native publication calendar/date offset')
 need(Number.isFinite(Date.parse(value))&&Date.parse(value)<=Date.parse(now),'Future or invalid native publication date')
}
function metadata(c){
 const dl=unique(c.shown.filter(n=>n.tag==='dl'&&nodes(n).some(z=>z.tag==='dt'&&text(z)==='Division')),'own native role Division metadata')
 const parts=elements(dl),result={}
 need(parts.length>0&&parts.length%2===0,'Native role metadata model changed')
 for(let i=0;i<parts.length;i+=2){
  const key=text(parts[i]),value=text(parts[i+1])
  need(parts[i].tag==='dt'&&parts[i+1].tag==='dd'&&['Division','Department','Location','Remote status','Employment type'].includes(key)
   &&!Object.hasOwn(result,key)&&value,'Unknown or duplicate native role metadata field')
  result[key]=value
 }
 return result
}
export function nativeRole(html,row,now){
 const c=context(html),carriers=c.rawEntries.filter(({node})=>node.tag==='script'&&node.attrs.type==='application/ld+json')
 let posting=null
 for(const {node,ancestors}of carriers){
  let value
  try{value=parseNativeJSON(node.raw||'')}catch(error){throw failure('Invalid or duplicate native JSON: '+error.message)}
  if(value?.['@type']!=='JobPosting')continue
  need(!posting&&!node.inert&&!ancestors.some(n=>n.inert||['object','svg','math'].includes(n.tag)||n.nativeTagUnqualified)
   &&!Object.hasOwn(node.attrs,'src')&&!Object.hasOwn(node.attrs,'nomodule'),
   'Expected unique active native JobPosting identity')
  posting=value
 }
 need(posting,'Current native JobPosting missing')
 const allowed=['@context','@type','title','description','identifier','datePosted','employmentType','directApply','hiringOrganization','jobLocation']
 need(Object.keys(posting).every(k=>allowed.includes(k)),'Unreviewed native country/criteria field model')
 const j=posting,employer=j.hiringOrganization,md=metadata(c)
 need(j['@context']==='http://schema.org/'&&norm(j.title)===row.title,'Native role title/identity changed')
 const title=unique(c.active.filter(n=>n.tag==='title'),'own native head title')
 need(norm(decodeHTML(title.raw||''))===row.title+' - BreatheHR','Native head title identity changed')
 need(j.identifier?.['@type']==='PropertyValue'&&j.identifier.value===row.id&&j.identifier.name===employer?.name,'Native role identifier/employer identity changed')
 need(employer?.['@type']==='Organization'&&['Breathe HR','ELMOgroup'].includes(employer.name)
  &&employer.sameAs===ACCOUNT&&typeof employer.logo==='string'&&employer.logo.startsWith('https://images.teamtailor-cdn.com/'),
 'Native account/employer identity changed')
 need(md.Division==='BreatheHR'&&row.division===md.Division,'Own native Division programme binding changed')
 need(md.Location===row.location&&(md.Department??null)===row.department,'Native card/detail location or Department changed')
 need(row.remoteStatus==='Hybrid'?md['Remote status']==='Hybrid':md['Remote status']==null||md['Remote status']==='Onsite',
  'Native card/detail work mode changed')
 const publicURL=unique(c.active.filter(n=>n.tag==='meta'&&n.attrs.property==='og:url'),'own native public role URL')
 const siteName=unique(c.active.filter(n=>n.tag==='meta'&&n.attrs.property==='og:site_name'),'own native programme site name')
 need(publicURL.attrs.content===row.url&&siteName.attrs.content==='BreatheHR','Native public role URL/programme identity changed')
 const description=unique(c.shown.filter(n=>n.tag==='div'&&n.attrs['data-controller']==='careersite--responsive-video'&&hasClass(n,'prose')),'whole visible published role description')
 const raw=j.description
 need(typeof raw==='string'&&raw.length>=100,'Full original native description unavailable')
 const nativeHTML=/<\/?[a-z][a-z\d:-]*(?:\s[^<>]*|\/?)>/i.test(raw)
 const encoded=/(?:&lt;|&#0*60;|&#x0*3c;)\/?[a-z][a-z\d:-]*(?:\s|&gt;|&#0*62;|&#x0*3e;)/i.test(raw)
 const decoded=!nativeHTML&&encoded?decodeHTML(raw):raw
 const published=context(decoded),publishedText=text(published.visible),visibleText=text(description)
 need(publishedText.length>=100&&publishedText===visibleText,'Whole published native/visible description criteria changed')
 const headlines=walk(c.visible).filter(({node,ancestors})=>node.tag==='h1'&&!node.inert&&!ancestors.includes(description)).map(({node})=>text(node))
 need(headlines.length>0&&headlines.every(t=>t===row.title),'Native visible role headline identity changed')
 need(/\bBreathe\b/.test(visibleText),'Own native programme description missing')
 if(employer.name==='ELMOgroup')need(visibleText.includes('ELMO UK is an equal opportunity employer'),
  'Own ELMO UK/Breathe native employer relation missing')
 need(Array.isArray(j.jobLocation)&&j.jobLocation.length===1,'Additional or unreviewed native location country model')
 const location=j.jobLocation[0],address=location?.address
 need(location&&Object.keys(location).every(k=>['@type','address'].includes(k)),'Unreviewed native location/country field model')
 need(location?.['@type']==='Place'&&address?.['@type']==='PostalAddress'&&typeof address.addressCountry==='string','Native country model unavailable')
 const country=nativeCountryName(address.addressCountry)
 need(country&&country!=='India','India or unknown native country withholds programme zero')
 need(address.addressLocality===row.location,'Native published country/address location disagrees with visible card')
 const visibleCountry=nativeLocationCountryName(row.location)
 need(!visibleCountry||visibleCountry===country,'Contradictory explicit visible native work country')
 need(Object.keys(address).every(k=>['@type','streetAddress','addressLocality','postalCode','addressCountry','addressRegion'].includes(k)),
  'Unreviewed additional native address-country field')
 need(Object.entries(address).every(([key,value])=>key==='@type'||value===null||typeof value==='string'),
  'Unreviewed nested native address-country model')
 for(const value of [address.addressLocality,address.streetAddress,address.addressRegion,address.postalCode]){
  if(typeof value!=='string')continue
  for(const part of value.split(/[,;|/()[\]]|\s+[-\u2013\u2014]\s+/u)){
   // An address component may carry a written country. Two-letter region or
   // postal codes do not independently declare a country.
   const label=norm(part),explicit=label.length>2?nativeCountryName(label):null
   need(!explicit||explicit===country,'Contradictory explicit native address country')
  }
 }
 timestamp(j.datePosted,now)
 const applications=c.rawEntries.filter(({node})=>node.tag==='turbo-frame'&&node.attrs.id==='application_form')
 need(applications.length===1&&applications[0].node.attrs.loading==='lazy'
  &&applications[0].node.attrs.src===row.url+'/applications/new','Current lazy native application declaration changed')
 const apply=c.shown.filter(n=>['a','button'].includes(n.tag)&&text(n)==='Apply for this job')
 need(apply.some(n=>!Object.hasOwn(n.attrs,'disabled'))&&apply.every(n=>n.tag==='button'
  &&n.attrs['data-action']==='click->careersite--jobs--form-overlay#showFormOverlay'),'Current native apply control changed')
 return {id:row.id,url:row.url,title:row.title,country,nativeDivision:md.Division,nativeEmployer:structuredClone(employer),
  nativeLegalEmployer:null,nativeSourceRecord:structuredClone(j),nativeVisibleMetadata:md,nativeDescriptionRaw:raw,
  publishedDescriptionHTML:decoded,descriptionEncoding:!nativeHTML&&encoded?'one-entity-HTML-wrapper':'native-HTML-or-text',
  publishedDescriptionVisibleMatch:true,publishedDescriptionText:visibleText,nativeDatePosted:j.datePosted,
  firstEverPostedAt:null,applicationDeadline:null,declaredLazyApplicationURL:applications[0].node.attrs.src,
  applicationVisited:false,screeningCriteriaAcquired:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false}
}
