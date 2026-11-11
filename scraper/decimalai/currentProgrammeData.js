import {decodeHTML} from 'entities'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {normalizeNativeAttributeBoundaries} from '../../scraper-support/utils/nativeHtmlAttributes.js'
import {parseEightfoldJson as parseNativeJSON} from '../../scraper-support/utils/recruitmentEightfoldData.js'
import {nativeCountryName} from '../../scraper-support/shared/nativeJobPosting.js'

export const HOME='https://www.decimal.app/'
export const LIST=HOME+'careers'
const ORIGIN=new URL(HOME).origin,LOGO=ORIGIN+'/icon.svg',ORG=HOME+'#organization'
const PRODUCT_VIDEO='https://www.youtube-nocookie.com/embed/WgdwXi28CIw?autoplay=0&mute=0&controls=1&playsinline=1'
export const failure=message=>Object.assign(Error('Decimal current programme: '+message),{
 softFailure:true,upstreamOutage:false,abortRetries:true,failureKind:'coverage_gap',lifecycleCleanupAllowed:false})
const need=(value,message)=>{if(!value)throw failure(message)}
const norm=value=>String(value??'').normalize('NFC').replace(/\s+/gu,' ').trim()
const elements=node=>node.children.filter(n=>typeof n!=='string')
const walk=(node,ancestors=[])=>[{node,ancestors},...elements(node).flatMap(n=>walk(n,[...ancestors,node]))]
const nodes=node=>walk(node).filter(({node})=>!node.inert).map(({node})=>node)
const text=node=>node.inert||['script','style','template','noscript'].includes(node.tag)?'':norm(node.children.map(n=>typeof n==='string'?decodeHTML(n):text(n)).join(' '))
const allText=node=>['script','style','noscript'].includes(node.tag)?'':norm(node.children.map(n=>typeof n==='string'?decodeHTML(n):allText(n)).join(' '))
const hasClass=(node,value)=>(node.attrs.class||'').split(/\s+/).includes(value)
const one=(values,label)=>{need(values.length===1,'Expected unique '+label);return values[0]}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const exactKeys=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&same(Object.keys(value).sort(),[...keys].sort())
const resolved=(value,page)=>{try{const u=new URL(value,page);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port?u:null}catch{return null}}
export const roleURL=value=>{
 const u=resolved(value,LIST)
 return u&&u.origin===ORIGIN&&!u.search&&!u.hash&&/^\/careers\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(u.pathname)?u.href:null
}
const href=(node,page)=>resolved(node.attrs.href,page)?.href
const careerLabel=value=>/^(?:careers?|jobs?|all jobs|see all open roles|see open roles|back to careers|join (?:us|our team))$/i.test(norm(value))
 ||/\bcareers\b|\bopenings\b|\bopen (?:roles|positions)\b/i.test(norm(value))
const knownBoard=value=>{
 const u=new URL(value),h=u.hostname
 return ['boards.greenhouse.io','job-boards.greenhouse.io','boards-api.greenhouse.io','jobs.lever.co','jobs.ashbyhq.com',
  'apply.workable.com','careers.smartrecruiters.com'].includes(h)||h.endsWith('.myworkdayjobs.com')
  ||h.endsWith('.teamtailor.com')&&!['www.teamtailor.com','app.teamtailor.com'].includes(h)&&/^\/(?:$|jobs(?:\/|$)|careers(?:\/|$))/.test(u.pathname)
}
const recruitmentURL=value=>{
 const u=new URL(value)
 return /^(?:careers?|jobs?)\./i.test(u.hostname)||/^\/(?:careers?|jobs?)(?:\/|$)/i.test(u.pathname)
}
function context(html,page){
 need(typeof html==='string'&&Buffer.byteLength(html)<=4e6,'Missing or oversized original HTML')
 let d,v
 try{const source=normalizeNativeAttributeBoundaries(html);d=readNativeDocument(source,{excludeObjectFallback:true});v=readVisibleNativeDocument(source,{strict:true})}
 catch(error){if(error?.name==='ActiveNativeContentError')throw failure('Unqualified original HTML model: '+error.message);throw error}
 const root=one(d.nodes(n=>n.tag==='root'),'original document'),shownRoot=one(v.nodes(n=>n.tag==='root'),'visible document')
 const entries=walk(root),active=nodes(root),shown=nodes(shownRoot)
 need(!entries.some(({node})=>node.tag==='base'),'Unreviewed document base scope')
 const canonical=one(entries.filter(({node})=>node.tag==='link'&&node.attrs.rel==='canonical'),'original canonical URL').node
 const openGraph=one(entries.filter(({node})=>node.tag==='meta'&&node.attrs.property==='og:url'),'original open-graph URL').node
 const expectedURL=page===HOME?ORIGIN:page
 // The captured careers landing inherits its layout's root OG URL, while
 // its canonical and each own-role OG URL are page-specific.
 const expectedOpenGraph=page===HOME||page===LIST?ORIGIN:page
 need(!canonical.inert&&!openGraph.inert&&canonical.attrs.href===expectedURL&&openGraph.attrs.content===expectedOpenGraph,
  'Native canonical/open-graph URL identity changed')
 // The home page's exact declared product-demo media is not a job board.
 const frames=entries.filter(({node})=>node.tag==='iframe')
 need(frames.every(({node})=>page===HOME&&node.attrs.src===PRODUCT_VIDEO&&hasClass(node,'DFbwpq_video')&&!Object.hasOwn(node.attrs,'srcdoc'))
  &&frames.length<=(page===HOME?1:0),'Unreviewed embedded recruitment programme scope')
 // The retained CSP blocks object loads; these are unsupported representations,
 // rather than evidence that an additional programme actually executed.
 need(!entries.some(({node,ancestors})=>['object','embed'].includes(node.tag)
  &&!ancestors.some(n=>['template','noscript'].includes(n.tag))),'Unreviewed object/embed embedding model')
 need(!entries.some(({node,ancestors})=>['form','input','select','textarea'].includes(node.tag)
  &&!ancestors.some(n=>['template','noscript'].includes(n.tag))),'Unreviewed filter/control or embedded programme scope')
 const main=one(shown.filter(n=>n.tag==='main'),'visible programme main')
 need(entries.filter(({node})=>node.tag==='main').length===1,'Duplicate original programme main')
 const anchors=shown.filter(n=>n.tag==='a'&&n.attrs.href).map(n=>{
  let declaredURL
  try{declaredURL=new URL(n.attrs.href,page).href}catch{}
  const label=text(n)
  const menuPlaceholder=n.attrs.href==='#'&&hasClass(n,'_9fWxfa_mobileNavItem')&&['Product','Resources'].includes(label)
  return {url:href(n,page),declaredURL,label,menuPlaceholder}
 })
 const links=anchors.filter(n=>n.url)
 for(const link of anchors)if(!link.menuPlaceholder&&(careerLabel(link.label)||link.declaredURL&&(knownBoard(link.declaredURL)||recruitmentURL(link.declaredURL)))){
  // Every recruitment declaration must belong to the current finite programme.
  // Exact role links are reconciled with every visible card below. Query and
  // fragment variants cannot disappear merely because roleURL rejects them.
  need(link.url===LIST||page===LIST&&(link.url===LIST+'#open-roles'||roleURL(link.url)),
   'Additional declared recruitment programme/handoff scope')
 }
 need(!active.some(n=>['a','link'].includes(n.tag)&&/(?:^|\s)next(?:\s|$)/i.test(n.attrs.rel||''))
  &&!active.some(n=>n.tag==='a'&&/\/careers(?:[/?#]|$)/.test(n.attrs.href||'')&&/[?&](?:page|cursor|offset)=/.test(n.attrs.href)),
 'Unvisited native pagination/page scope')
 const values=[]
 for(const {node,ancestors}of entries.filter(({node})=>node.tag==='script'&&/application\/ld\+json/i.test(node.attrs.type||''))){
  need(node.attrs.type==='application/ld+json'&&!node.inert&&!ancestors.some(n=>n.inert||['template','object','svg','math'].includes(n.tag)||n.nativeTagUnqualified)
   &&!Object.hasOwn(node.attrs,'src')&&!Object.hasOwn(node.attrs,'nomodule'),'Unqualified active native JSON carrier/source')
  let rows
  try{rows=parseNativeJSON(node.raw||'')}catch(error){throw failure('Invalid or duplicate native JSON: '+error.message)}
  need(Array.isArray(rows)&&rows.length>0&&rows.every(j=>j&&typeof j==='object'&&!Array.isArray(j)),'Unreviewed native JSON array model')
  values.push(...rows)
 }
 const expectedTypes=['Organization','WebSite','SoftwareApplication',...(page===HOME||page===LIST?[]:['JobPosting','BreadcrumbList'])]
 need(same(values.map(j=>j['@type']).sort(),expectedTypes.sort()),'Unreviewed native JSON page/type/cardinality model')
 const org=one(values.filter(j=>j['@type']==='Organization'),'published Organization identity')
 need(exactKeys(org,['@context','@type','@id','name','legalName','alternateName','url','logo','description','sameAs','email'])
  &&org['@context']==='https://schema.org'&&org['@id']===ORG&&org.name==='Decimal'&&org.legalName==='Decimal AI'
  &&org.alternateName==='Decimal AI'&&org.url===ORIGIN&&org.logo===LOGO&&org.email==='hello@getdecimal.ai'
  &&Array.isArray(org.sameAs)&&org.sameAs.every(x=>typeof x==='string'),'Published organization/publisher identity changed')
 const website=one(values.filter(j=>j['@type']==='WebSite'),'native WebSite'),app=one(values.filter(j=>j['@type']==='SoftwareApplication'),'native SoftwareApplication')
 need(website.url===ORIGIN&&website.publisher?.['@id']===ORG&&app.url===ORIGIN&&app.provider?.['@id']===ORG,
  'Native publisher identity chain changed')
 return {root,entries,active,shown,main,links,values,org}
}
const title=(c,expected)=>{
 const headTitles=c.entries.filter(({node,ancestors})=>node.tag==='title'&&!node.inert&&ancestors.at(-1)?.tag==='head')
 need(headTitles.length===1&&norm(decodeHTML(headTitles[0].node.raw||''))===expected,'Native page title identity changed')
}
export function readHome(html){
 const c=context(html,HOME);title(c,'Decimal AI | Customer Engineering Platform')
 need(c.links.some(l=>l.url===LIST&&l.label==='Careers'),'Current corporate Careers handoff missing')
 need(!c.links.some(l=>roleURL(l.url)),'Additional corporate own-role inventory outside declared careers list')
 return {organization:structuredClone(c.org)}
}
export function readListing(html,organization){
 const c=context(html,LIST);title(c,'Careers | Decimal')
 need(same(c.org,organization),'Corporate/listing published organization identity changed')
 need(c.entries.filter(({node})=>node.attrs.id==='open-roles').length===1,'Expected unique open-roles inventory including inert shadows')
 const section=one(c.shown.filter(n=>n.tag==='section'&&n.attrs.id==='open-roles'),'visible native role inventory')
 const counter=one(nodes(section).filter(n=>n.tag==='p'&&/^\d+ open roles\s*, all based in San Mateo, CA\.$/.test(text(n))),'native current inventory count')
 const count=Number(text(counter).match(/^\d+/)[0])
 const container=one(nodes(section).filter(n=>n.tag==='div'&&hasClass(n,'LRsLgq_rowList')),'native role card inventory')
 const cards=elements(container);need(cards.length>0&&cards.every(n=>n.tag==='a'&&!n.inert),'Unlinked or hidden native role card/row')
 const rows=cards.map(card=>{
  const url=roleURL(href(card,LIST));need(url,'Native card public role URL changed')
  const descendants=nodes(card),name=text(one(descendants.filter(n=>n.tag==='h3'&&hasClass(n,'LRsLgq_rowTitle')),'native card title'))
  const meta=text(one(descendants.filter(n=>n.tag==='span'&&hasClass(n,'LRsLgq_rowMeta')),'native card location metadata'))
  const parts=meta.split(/\s+\u00b7\s+/u);need(parts.length===2&&parts[0]&&parts[1]==='San Mateo, CA','Unreviewed native card country/location scope')
  need(text(one(descendants.filter(n=>n.tag==='span'&&hasClass(n,'LRsLgq_rowAside')),'native employment type'))==='Full-time','Native card employment model changed')
  need(text(card)===norm(name+' '+meta+' Full-time'),'Unreconciled whole visible card country/criteria scope')
  return {url,title:name,department:parts[0],location:parts[1],employmentType:'FULL_TIME',originalVisibleCard:text(card)}
 })
 need(Number.isSafeInteger(count)&&count>0&&rows.length===count&&new Set(rows.map(r=>r.url)).size===count,'Native reported count and unique complete card inventory disagree')
 const linked=c.links.filter(l=>roleURL(l.url))
 need(linked.length===count&&linked.every(l=>rows.some(r=>r.url===l.url)),'Additional own role outside inventoried card inventory')
 return {reportedTotal:count,rows}
}
const nativeDate=(value,now)=>{
 const m=typeof value==='string'&&value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
 need(m,'Unknown native publication date format')
 const [year,month,day]=m.slice(1).map(Number)
 need(year>=1970&&month>=1&&month<=12&&day>=1&&day<=new Date(Date.UTC(year,month,0)).getUTCDate(),'Invalid native calendar date')
 need(Date.parse(value)<=Date.parse(now),'Future native publication date')
}
const checkCountryLabels=(values,country)=>{
 for(const value of values){
  need(value===undefined||value===null||typeof value==='string','Unreviewed nested native address-country model')
  if(typeof value!=='string')continue
  for(const part of value.split(/[,;|/()[\]]|\s+[-\u2013\u2014]\s+/u)){
   const label=norm(part),explicit=label.length>2?nativeCountryName(label):null
   need(!explicit||explicit===country,'Contradictory written native work country')
  }
 }
}
export function readRole(html,row,organization,now){
 const c=context(html,row.url);title(c,row.title+' | Decimal')
 need(same(c.org,organization),'Own-role published organization identity changed')
 const job=one(c.values.filter(j=>j['@type']==='JobPosting'),'native JobPosting carrier identity')
 need(exactKeys(job,['@context','@type','title','description','datePosted','employmentType','hiringOrganization','jobLocation','directApply','url']),
  'Unreviewed native country/criteria field model')
 need(job['@context']==='https://schema.org'&&job.title===row.title&&job.url===row.url,'Native public role URL/title identity changed')
 const employer=job.hiringOrganization
 need(exactKeys(employer,['@type','name','sameAs','logo'])&&employer['@type']==='Organization'&&employer.name===organization.legalName
  &&employer.sameAs===ORIGIN&&employer.logo===LOGO,'Native employer identity changed')
 need(job.employmentType===row.employmentType&&job.directApply===false,'Native employment/application model changed')
 const location=job.jobLocation
 need(exactKeys(location,['@type','address'])&&location['@type']==='Place','Additional or unknown native location/country model')
 const address=location.address
 need(address&&typeof address==='object'&&!Array.isArray(address)&&Object.keys(address).every(k=>['@type','addressLocality','addressRegion','addressCountry','streetAddress','postalCode'].includes(k))
  &&address['@type']==='PostalAddress'&&typeof address.addressCountry==='string','Native country/address model unavailable')
 const country=nativeCountryName(address.addressCountry)
 need(country==='United States','India or unknown/changed native work country withholds programme zero')
 checkCountryLabels([address.addressLocality,address.addressRegion,address.streetAddress,address.postalCode],country)
 need(address.addressLocality+', '+address.addressRegion===row.location,'Native country/location and card detail disagree')
 const mainText=text(c.main)
 need(!/\bIndia(?:n)?\b/i.test(mainText),'Additional written India/applicant scope is unresolved')
 const article=one(nodes(c.main).filter(n=>n.tag==='article'),'visible complete own-role article')
 need(c.entries.filter(({node})=>node.tag==='article').length===1,'Duplicate original role article')
 const head=one(nodes(article).filter(n=>n.tag==='div'&&hasClass(n,'GKRuyq_head')),'visible native role head')
 const h1=one(nodes(head).filter(n=>n.tag==='h1'),'visible role title');need(text(h1)===row.title,'Visible native role title identity changed')
 const department=one(elements(head).filter(n=>n.tag==='p'&&hasClass(n,'kGaWra_eyebrow')),'native department')
 need(text(department)===row.department,'Card/detail department identity changed')
 const meta=one(nodes(head).filter(n=>n.tag==='div'&&hasClass(n,'GKRuyq_meta')),'visible native location/type')
 const spans=elements(meta).filter(n=>n.tag==='span'&&!hasClass(n,'GKRuyq_dot'))
 need(spans.length===2&&text(spans[0])===row.location&&text(spans[1])==='Full-time','Visible native country/location employment scope changed')
 const prose=one(nodes(article).filter(n=>n.tag==='div'&&hasClass(n,'GKRuyq_prose')),'visible full native prose criteria')
 need(c.entries.filter(({node})=>node.tag==='div'&&hasClass(node,'GKRuyq_prose')).length===1,'Duplicate original full prose criteria')
 need(allText(prose)===text(prose),'Hidden/inert published criterion or requirement is unresolved')
 need(!walk(article).some(({node,ancestors})=>ancestors.some(n=>['object','svg','math','template'].includes(n.tag))&&allText(node)),
  'Unqualified namespace published criterion')
 const children=elements(prose)
 need(same(children.map(n=>n.tag),['section','section','section','section','h2','p','div']),'Unreviewed complete native criterion section model')
 const headings=['About Decimal','The role','In this role, you will','Requirements']
 const sectionContent=children.slice(0,4).map((section,index)=>{
  const parts=elements(section);need(parts[0]?.tag==='h2'&&text(parts[0])===headings[index],'Native Requirements/criteria section identity changed')
  if(index<2)need(parts.length>=2&&parts.slice(1).every(n=>n.tag==='p'),'Unknown native introductory criterion model')
  else need(parts.length===2&&parts[1].tag==='ul'&&elements(parts[1]).length>0&&elements(parts[1]).every(n=>n.tag==='li'),'Unknown native full requirement/list model')
  return index<2?parts.slice(1).map(text):elements(parts[1]).map(text)
 })
 need(text(children[4])==='How to apply'&&text(children[5]).length>=20,'Original application instructions unavailable')
 const intro=one(nodes(head).filter(n=>n.tag==='p'&&hasClass(n,'GKRuyq_dek')),'native role introductory summary')
 const introText=[text(intro),...sectionContent[1]].join(' ')
 need(typeof job.description==='string'&&norm(job.description)===norm(introText),'Native schema introductory description/visible criteria disagree')
 const apply=c.shown.filter(n=>n.tag==='a'&&text(n)==='Apply for this role')
 const expectedApply='mailto:founders@getdecimal.ai?subject='+encodeURIComponent('Application: '+row.title)
 need(apply.length===2&&apply.every(n=>n.attrs.href===expectedApply),'Native published application instructions identity changed')
 need(c.links.some(l=>l.url===LIST&&l.label==='Back to careers')&&c.links.some(l=>l.url===LIST&&l.label==='See all open roles'),
  'Own role complete programme reciprocal handoff changed')
 nativeDate(job.datePosted,now)
 return {url:row.url,title:row.title,country,nativeEmployer:structuredClone(employer),nativePublisherOrganization:structuredClone(c.org),
  publisherLegalNameRegistryVerified:false,nativeSourceRecord:structuredClone(job),nativeSchemaDescription:job.description,
  schemaDescriptionIsIntroOnly:true,schemaIntroductionVisibleMatch:true,schemaFullDescriptionMatch:false,
  originalOwnRoleHTML:html,fullPublishedRoleText:text(article),fullPublishedMainText:mainText,
  publishedRequirements:sectionContent[3],publishedResponsibilities:sectionContent[2],publishedHowToApply:text(children[5]),
  nativeDatePosted:job.datePosted,firstEverPostedAt:null,applicationDeadline:null,remoteStatus:null,
  sourceRemoteStatusUnresolved:true,applicationVisited:false,screeningCriteriaAcquired:false,
  publishedApplicationURL:expectedApply,sourceScopeComplete:false,lifecycleCleanupAllowed:false}
}
