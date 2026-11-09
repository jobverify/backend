import {decodeHTML} from 'entities'
import {createHash} from 'node:crypto'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {nativeCountryName,nativeDate} from '../../scraper-support/shared/nativeJobPosting.js'

export const COMPANY='Lyra Health',SOURCE='lyrahealth',HOME='https://careers.lyrahealth.com/'
export const INDEX=HOME+'critical-care-navigator-jobs',API='https://api.lever.co/v0/postings/lyrahealth',HOST='https://jobs.lever.co/lyrahealth/'
export const copy=value=>structuredClone(value)
export const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v)
export const need=(ok,message)=>{if(!ok)throw Object.assign(Error('Lyra native: '+message),{code:'LYRA_NATIVE_PROOF',abortRetries:true})}
export const parsed=text=>copy(readLiteralModel(text).value)
const norm=text=>String(text??'').replace(/\s+/g,' ').trim(),key=text=>norm(text).replace(/\s+/g,'')
const one=(items,label)=>{need(items.length===1,'missing or ambiguous '+label);return items[0]}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
export const hash=bytes=>createHash('sha256').update(bytes).digest('hex')

export function corporateHome(html){
 const d=readNativeDocument(html)
 need(!d.nodes(n=>n.tag==='base').length&&activeHead(html).titles.includes('Working at Lyra Health'),'current corporate identity changed')
 need(d.nodes(n=>n.tag==='a'&&n.attrs.href==='/critical-care-navigator-jobs'&&d.text(n)==='Clinical Care Navigator Jobs').length>0,'active corporate recruitment context missing')
 return {url:HOME,title:'Working at Lyra Health',index:INDEX}
}
export function indexRedirect(location){
 const u=new URL(location,INDEX),keys=[...u.searchParams.keys()].sort()
 need(u.origin===new URL(HOME).origin&&u.pathname==='/search-jobs'&&!u.hash&&!u.username&&!u.password
  &&canonical(keys)===canonical(['acm','alrpm','ascf'])&&/^\d+(?:,\d+){0,30}$/.test(u.searchParams.get('acm'))
  &&u.searchParams.get('alrpm')==='ALL'&&canonical(parsed(u.searchParams.get('ascf')))===canonical([{key:'ALL',value:''}]),'unreviewed native index redirect')
 return u.href
}
export function corporateIndex(html,url){
 const d=readNativeDocument(html)
 need(!d.nodes(n=>n.tag==='base').length&&activeHead(html).titles.some(t=>t.includes(COMPANY)),'native corporate hiring index changed')
 const links=d.nodes(n=>n.tag==='a'&&/^\/job\/[^/?#]+\/[^/?#]+\/43250\/\d+$/.test(n.attrs.href||'')&&d.text(n))
 need(links.length>0,'current owned corporate role missing')
 return {url,roleURL:new URL(links[0].attrs.href,HOME).href}
}
const schemaDocument=html=>{
 const d=readNativeDocument(html)
 need(!d.nodes(n=>n.tag==='base').length,'unreviewed own role base')
 const schema=parsed(one(d.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json'),'own JobPosting').raw)
 need(schema['@type']==='JobPosting'&&schema.hiringOrganization?.['@type']==='Organization'&&schema.hiringOrganization.name===COMPANY,'own native publisher changed')
 return {d,schema}
}
export function corporateRole(html,url){
 const {d,schema}=schemaDocument(html)
 need(d.nodes(n=>n.tag==='h2'&&d.hasClass(n,'ajd_header__job-title')&&d.text(n)===schema.title).length===1,'own corporate role title changed')
 const anchors=d.nodes(n=>n.tag==='a'&&n.attrs.href?.startsWith(HOST))
 const links=[...new Set(anchors.map(n=>n.attrs.href))]
 const apply=one(links,'declared public account handoff'),match=apply.match(/^https:\/\/jobs\.lever\.co\/lyrahealth\/([0-9a-f-]+)\/apply$/)
 need(match&&uuid.test(match[1]),'unreviewed public account handoff')
 return {url,title:schema.title,applyURL:apply,postingId:match[1],jobPosting:schema}
}
export function nativePosting(row){
 need(row&&uuid.test(row.id)&&typeof row.text==='string'&&norm(row.text)&&row.hostedUrl===HOST+row.id&&row.applyUrl===HOST+row.id+'/apply','native posting identity or URL changed')
 need(row.country===null||typeof row.country==='string'&&/^[A-Z]{2}$/.test(row.country),'native country type changed')
 return row
}

const tags=new Set(['root','div','p','span','strong','h3','ul','li','a','br','b'])
const classes=new Set(['section','page-centered','posting-requirements','plain-list','text-small','italic','text-gray-700','__cf_email__'])
const qa=new Set(['job-description','posting-requirements','closing-description','ai-disclaimer'])
const sizes=new Set(['11pt','15px','small','14.6667px'])
const links=new Set(['https://www.lyrahealth.com/workforce-privacy-notice/','https://privacy-central.securiti.ai/#/dsr/be61bec1-10a5-47ac-94ab-3055974aefb1','mailto:globaldpo@lyrahealth.com'])
// The native page masks an already-public privacy contact in a literal data
// attribute. Reconcile that browser text transformation as data; never follow
// the masking link or execute its script.
const publicEmail=encoded=>{
 need(typeof encoded==='string'&&/^[a-f\d]{12,400}$/i.test(encoded)&&encoded.length%2===0,'unreviewed native contact encoding')
 const bytes=Buffer.from(encoded,'hex'),mask=bytes[0],decoded=Array.from(bytes.subarray(1),b=>String.fromCharCode(b^mask)).join('')
 need(/^[a-z\d._+-]+@[a-z\d.-]+\.[a-z]{2,}$/i.test(decoded),'unreviewed native contact data')
 return decoded
}
const contentText=node=>{
 if(typeof node==='string')return decodeHTML(node)
 need(!node.inert&&tags.has(node.tag)&&!node.raw,'hidden or unreviewed role criteria')
 for(const[name,value]of Object.entries(node.attrs)){
  if(name==='class')need(value.split(/\s+/).filter(Boolean).every(v=>classes.has(v)),'unreviewed role criteria class')
  else if(name==='data-qa')need(qa.has(value),'unreviewed role criteria section')
  else if(name==='data-pm-slice')need(value==='1 1 []','unreviewed native text formatting')
  else if(name==='style')need(value.split(';').map(v=>v.trim()).filter(Boolean).every(v=>{const m=v.match(/^font-size\s*:\s*([\w.]+)$/i);return m&&sizes.has(m[1].toLowerCase())}),'hidden or unreviewed role criteria style')
  else if(name==='href')need(links.has(value)||/^\/cdn-cgi\/l\/email-protection#[a-f\d]+$/i.test(value),'unreviewed native criteria link')
  else if(name==='data-cfemail')need(node.tag==='span'&&node.attrs.class==='__cf_email__','unreviewed native contact context')
  else need(false,'hidden or unreviewed role criteria attribute')
 }
 if(node.tag==='a'&&node.attrs.href?.startsWith('/cdn-cgi/l/email-protection#')){
  const span=one(node.children.filter(c=>typeof c!=='string'),'native masked contact')
  need(span.tag==='span'&&span.attrs.class==='__cf_email__'&&node.children.filter(c=>typeof c==='string').every(s=>!s.trim()),'unreviewed native masked contact')
  const email=contentText(span);need(publicEmail(node.attrs.href.split('#')[1])===email,'native contact projections conflict');return email
 }
 if(node.attrs.class==='__cf_email__'){
  const email=publicEmail(node.attrs['data-cfemail'])
  need(node.children.every(c=>typeof c==='string')&&norm(node.children.map(value=>decodeHTML(value)).join(' '))==='[email protected]','native masked contact text changed')
  return email
 }
 return node.children.map(contentText).join(' ')
}
export const criteriaText=html=>{
 need(typeof html==='string'&&!/<!--|<!|<\?/.test(html),'unreviewed native criteria markup')
 return norm(contentText(one(readNativeDocument(html).nodes(n=>n.tag==='root'),'criteria root')))
}
const rowFields=new Set(['additionalPlain','additional','categories','createdAt','descriptionPlain','description','id','lists','text','country','workplaceType','opening','openingPlain','descriptionBody','descriptionBodyPlain','hostedUrl','applyUrl'])
const serializedCriteria=value=>value.replace(/\\+n/g,'\n').replace(/\\+"/g,'"')
const closedFields=(value,fields,label)=>need(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(k=>fields.includes(k)),'unreviewed '+label+' field')
const workplaceLabel=value=>({onsite:'On-site',remote:'Remote',hybrid:'Hybrid'})[value]||null
const ownHeader=(accent,row)=>{
 const element=(tag,attrs,children)=>({tag,attrs,children})
 const div=(className,children)=>element('div',{class:className},children)
 const category=(className,text)=>element('div',{href:'#',class:className},[text])
 need(typeof row.categories.department==='string'&&typeof row.categories.team==='string'&&workplaceLabel(row.workplaceType),'unreviewed own header categories')
 const categories=[category('sort-by-time posting-category medium-category-label width-full capitalize-labels location',row.categories.location),
  category('sort-by-team posting-category medium-category-label capitalize-labels department',row.categories.department+' – '+row.categories.team+' /')]
 if(row.categories.commitment!=null)categories.push(category('sort-by-commitment posting-category medium-category-label capitalize-labels commitment',row.categories.commitment+' /'))
 categories.push(category('sort-by-time posting-category medium-category-label capitalize-labels workplaceTypes',workplaceLabel(row.workplaceType)))
 const expected=div('section-wrapper accent-section page-full-width',[
  div('section page-centered posting-header',[
   div('posting-headline',[element('h2',{},[row.text]),div('posting-categories',categories)]),
   div('postings-btn-wrapper',[element('a',{class:'postings-btn template-btn-submit hex-color',href:row.applyUrl},['Apply for this job'])])])])
 const tree=node=>{
  if(typeof node==='string')return norm(decodeHTML(node))||null
  need(!node.inert&&!node.raw,'hidden or unreviewed own header')
  return element(node.tag,node.attrs,node.children.map(tree).filter(value=>value!==null))
 }
 need(canonical(tree(accent))===canonical(expected),'unmodeled or conflicting full own header')
}
const ownRoleLayout=(d,html,row)=>{
 const root=one(d.nodes(n=>n.tag==='root'),'own document root'),parents=new Map(),raw=[]
 const walk=node=>{raw.push(node);for(const child of node.children)if(typeof child!=='string'){parents.set(child,node);walk(child)}};walk(root)
 // These three styles are present, byte-identical, in all seven reviewed
 // original pages. Style elements are inert text in the small DOM reader;
 // inspect the raw tree rather than its active-only node index.
 const styles={inline:raw.filter(n=>n.tag==='style').map(n=>({attrs:n.attrs,raw:n.raw})),
  external:raw.filter(n=>n.tag==='link'&&(n.attrs.rel||'').toLowerCase().split(/\s+/).includes('stylesheet')).map(n=>n.attrs)}
 need(hash(canonical(styles))==='b7a4c6b0d38a5e1ed4e199aafc4f24e33dc381c1a6b71cc49cfaa1aab92a02de','unreviewed own stylesheet contract')
 const wrapper=one(d.nodes(n=>n.tag==='div'&&n.attrs.class==='section-wrapper page-full-width'),'whole own role criteria')
 const chain=[['div',{class:'section-wrapper page-full-width'}],['div',{class:'content'}],
  ['div',{class:'content-wrapper posting-page'}],['body',{class:'show header-compact'}],['html',{}],['root',{}]]
 let node=wrapper
 for(const[tag,attrs]of chain){need(node&&!node.inert&&node.tag===tag&&canonical(node.attrs)===canonical(attrs),'unreviewed own criteria ancestor');node=parents.get(node)}
 need(!node,'unreviewed own criteria ancestry')
 const content=parents.get(wrapper),children=content.children.filter(n=>typeof n!=='string')
 need(children.length===2&&children[1]===wrapper&&children[0].tag==='div'&&!children[0].inert
  &&canonical(children[0].attrs)===canonical({class:'section-wrapper accent-section page-full-width'})
  &&content.children.filter(n=>typeof n==='string').every(n=>!n.trim()),'unmodeled own role content outside criteria')
 ownHeader(children[0],row)
 const postingPage=parents.get(content),postingChildren=postingPage.children.filter(n=>typeof n!=='string')
 need(postingChildren.length===1&&postingChildren[0]===content&&postingPage.children.filter(n=>typeof n==='string').every(n=>!n.trim()),'unmodeled outer posting content')
 const chrome=node=>{
  if(typeof node==='string')return norm(decodeHTML(node))||null
  if(node===wrapper)return {kind:'criteria'}
  if(node===children[0])return {kind:'header'}
  // Script bodies remain data and are never executed. Preserve every other
  // raw body subtree, including inert ones, in the reviewed shell contract.
  if(node.tag==='script')return null
  return {tag:node.tag,attrs:node.attrs,raw:node.raw||null,children:node.children.map(chrome).filter(value=>value!==null)}
 }
 const body=one(d.nodes(n=>n.tag==='body'),'own body')
 need(hash(JSON.stringify(chrome(body)))==='aa058aaf6d637f482bc4cd12a4eef2b4a58b723ef43ee1aa576fb44068c6479f','unmodeled raw content outside own role')
 const visible=readVisibleNativeDocument(html,{strict:true})
 one(visible.nodes(n=>n.tag==='div'&&n.attrs.class==='section-wrapper page-full-width'),'visible whole own criteria')
 return {wrapper,visible}
}

export function readNativeRole(row,html,clock){
 nativePosting(row);need(row.country==='IN','own typed India country missing')
 need(Object.keys(row).every(k=>rowFields.has(k)),'additional unreviewed native role field')
 need(row.categories&&Object.keys(row.categories).every(k=>['location','allLocations','commitment','team','department'].includes(k)),'unreviewed native categories')
 const primary=norm(row.categories.location),locations=row.categories.allLocations
 need(primary&&Array.isArray(locations)&&locations.length===1&&locations[0]===row.categories.location,'own secondary workplace country unresolved')
 const {d,schema}=schemaDocument(html)
 closedFields(schema,['@context','@type','title','hiringOrganization','jobLocation','employmentType','datePosted','description','validThrough'],'own JobPosting')
 need(schema['@context']==='http://schema.org','unreviewed own schema context')
 closedFields(schema.hiringOrganization,['@type','name','logo'],'own hiring organization')
 closedFields(schema.jobLocation,['@type','address'],'own workplace')
 closedFields(schema.jobLocation?.address,['@type','addressLocality','addressRegion','addressCountry','postalCode'],'own workplace address')
 const {wrapper,visible:visibleDocument}=ownRoleLayout(d,html,row)
 need(schema.title===row.text&&activeHead(html).titles.includes(COMPANY+' - '+row.text),'own role title changed')
 need(d.nodes(n=>n.tag==='h2'&&d.text(n)===row.text).length===1,'visible own role title changed')
 const header=one(visibleDocument.nodes(n=>n.tag==='div'&&visibleDocument.hasClass(n,'posting-header')),'visible own posting header')
 need(visibleDocument.nodes(n=>n.tag==='h2'&&visibleDocument.text(n)===row.text,header).length===1,'visible own header title changed')
 need(visibleDocument.text(one(visibleDocument.nodes(n=>n.tag==='div'&&visibleDocument.hasClass(n,'location'),header),'visible own worksite'))===primary,'visible own worksite conflicts')
 need(one(d.nodes(n=>n.tag==='meta'&&n.attrs.property==='og:url'),'own URI').attrs.content===row.hostedUrl,'own native URI changed')
 need(d.nodes(n=>n.tag==='a'&&n.attrs.href===row.applyUrl).length>0,'own published application identity changed')
 const address=schema.jobLocation?.address
 need(schema.jobLocation?.['@type']==='Place'&&address?.['@type']==='PostalAddress'&&norm(address.addressLocality)===primary,'native own worksite changed')
 need(address.addressCountry==null||nativeCountryName(address.addressCountry)==='India','own typed work country conflicts')
 need(schema.applicantLocationRequirements==null,'unreviewed applicant location restriction')
 need(schema.employmentType==null||row.categories.commitment==null||schema.employmentType===row.categories.commitment,'own employment fields conflict')
 const api=[]
 for(const field of ['description','opening','descriptionBody','additional']){
  need(typeof row[field]==='string'&&typeof row[field+'Plain']==='string','native criteria variant missing')
  const active=criteriaText(row[field]);need(key(active)===key(row[field+'Plain']),'native HTML/plain criteria conflict')
 }
 need(key(criteriaText(row.description))===key([criteriaText(row.opening),criteriaText(row.descriptionBody)].filter(Boolean).join(' ')),'native combined criteria incomplete')
 if(row.description)api.push({kind:'description',text:criteriaText(row.description)})
 need(Array.isArray(row.lists),'full native criteria lists missing')
 for(const section of row.lists){need(Object.keys(section).every(k=>['text','content'].includes(k))&&typeof section.text==='string'&&typeof section.content==='string','unreviewed native requirement model')
  api.push({kind:'list',text:norm(decodeHTML(section.text)+' '+criteriaText(section.content))})}
 if(row.additional)api.push({kind:'closing',text:criteriaText(row.additional)})
 // All direct children in the native role wrapper must be accounted for.
 // Inspect inert children too, so hidden criteria cannot disappear silently.
 const sections=wrapper.children.filter(n=>typeof n!=='string').flatMap(n=>{
  if(d.hasClass(n,'last-section-apply')){
   need(!n.inert&&n.attrs.class==='section page-centered last-section-apply'&&n.attrs['data-qa']==='btn-apply-bottom'
    &&Object.keys(n.attrs).length===2,'unreviewed own application navigation container')
   const a=one(n.children.filter(c=>typeof c!=='string'),'own application navigation')
   need(n.children.filter(c=>typeof c==='string').every(s=>!s.trim())&&!a.inert&&a.tag==='a'&&a.attrs.href===row.applyUrl
    &&Object.keys(a.attrs).every(k=>['class','href','data-qa'].includes(k))&&a.children.every(c=>typeof c==='string')&&d.text(a)==='Apply for this job','unreviewed own application navigation content')
   return []
  }
  need(n.tag==='div'&&d.hasClass(n,'section')&&d.hasClass(n,'page-centered'),'unreviewed native criteria container')
  return [{kind:n.attrs['data-qa']==='ai-disclaimer'?'ai-disclaimer':n.attrs['data-qa']==='job-description'?'description':n.attrs['data-qa']==='closing-description'?'closing':'list',text:norm(contentText(n))}]
 })
 need(wrapper.children.filter(n=>typeof n==='string').every(s=>!s.trim()),'unmodeled native criteria text')
 const visible=sections.filter(s=>s.kind!=='ai-disclaimer')
 need(visible.length===api.length&&visible.every((s,i)=>s.kind===api[i].kind&&key(s.text)===key(api[i].text)),'complete visible/native role criteria mismatch')
 need(sections.filter(s=>s.kind==='ai-disclaimer').length<=1,'unreviewed extra native notice')
 const combined=api.map(s=>s.text).join(' ')
 need(typeof schema.description==='string'&&key(criteriaText(serializedCriteria(schema.description)))===key(combined),'complete own JobPosting criteria mismatch')
 const description=sections.map(s=>s.text).join('\n\n');need(description.length>=100,'full own criteria unavailable')
 const contracts=[...description.matchAll(/You will be contracted by ([^.]+)\./g)].map(m=>m[1])
 need(contracts.length<=1&&contracts.every(c=>c==='Lyra Clinical Associates'),'unreviewed native contracting entity')
 const posted=nativeDate(schema.datePosted,{required:true}),expiry=nativeDate(schema.validThrough)
 need(Date.parse(posted.iso)<=Date.parse(clock)&&(!expiry.iso||Date.parse(expiry.iso)>=Date.parse(clock)),'own native publication or expiry unqualified')
 const model={posting:copy(row),jobPosting:copy(schema),visibleRole:{title:row.text,publisher:COMPANY,sections,primaryLocation:primary}}
 return {source:SOURCE,company:COMPANY,jobId:row.id,requisitionId:null,title:row.text,country:'India',
  countryEvidence:{field:'own Lever country (ISO 3166-1 alpha-2)',value:row.country,url:API},
  city:/^india$/i.test(primary)?null:primary,state:null,location:primary,locations:[{location:primary,country:'India'}],
  sourceCountryScopeUnresolved:false,nativeCountryAddresses:[copy(address)],nativeHiringOrganization:copy(schema.hiringOrganization),
  legalEmployer:contracts[0]||null,nativeContractingPartyEvidence:contracts.length?{field:'own published role criteria',sentence:'You will be contracted by '+contracts[0]+'.'}:null,
  sourceNativeEmployerBinding:{publisher:COMPANY,method:'current-corporate-account-handoff-and-own-JobPosting-publisher',legalEmployer:contracts[0]||null},
  employmentType:row.categories.commitment??schema.employmentType??null,department:row.categories.department??null,team:row.categories.team??null,
  nativeWorkplaceType:row.workplaceType,remoteStatus:workplaceLabel(row.workplaceType),
  sourceUrl:row.hostedUrl,applyUrl:row.applyUrl,link:row.applyUrl,postingDate:schema.datePosted,postedAt:schema.datePosted,
  sourcePostedDateRaw:schema.datePosted,sourceDatePrecision:posted.precision,closingDate:schema.validThrough??null,firstEverPublication:null,
  jobDescription:description,sourceDescription:schema.description,nativeSourceRecord:model,
  sourceRawNativeHTML:html,sourceRawNativeHTMLSHA256:hash(html),applicationVisited:false,activeApplyVerified:false,
  sourceDetailComplete:false,sourceDetailStatus:'partial',nativeRoleClosingReconciled:false,
  sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,scrapedAt:clock}
}
