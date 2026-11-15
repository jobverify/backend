import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {types} from 'node:util'
import {setTimeout as delay} from 'node:timers/promises'
import {parse} from 'acorn'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {readNativeDocument,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument,readNativeStatusLayout} from '../../scraper-support/utils/visibleNativeHtml.js'
import {normalizeNativeAttributeBoundaries} from '../../scraper-support/utils/nativeHtmlAttributes.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const profile=JSON.parse(fs.readFileSync(new URL('./currentScope20261115.json',import.meta.url),'utf8'))
const ORIGIN='https://careers.bhp.com',HOME='https://www.bhp.com/',CORPORATE=HOME+'careers',QUERY=ORIGIN+'/search/?q=India'
const companies={bhp:'BHP',bhpgroup:'BHP Group'},sha=b=>createHash('sha256').update(b).digest('hex')
const problem=message=>Object.assign(Error('BHP current native: '+message),{softFailure:true,abortRetries:true,failureKind:'coverage_gap',sourceScopeComplete:false,lifecycleCleanupAllowed:false})
const need=(value,message)=>{if(!value)throw problem(message)}
const one=(values,label)=>{need(values.length===1,'missing or ambiguous '+label);return values[0]}
const norm=value=>String(value??'').replace(/\s+/g,' ').trim(),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const all=node=>[node,...node.children.filter(c=>typeof c!=='string').flatMap(all)]
const hasClass=(node,name)=>(node.attrs.class??'').split(/\s+/).includes(name)
const docOf=html=>readNativeDocument(normalizeNativeAttributeBoundaries(html))
const rootOf=doc=>one(doc.nodes(n=>n.tag==='root'),'document root')
const uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/
const typedArray=Object.getPrototypeOf(Uint8Array.prototype),byteLength=Object.getOwnPropertyDescriptor(typedArray,'byteLength').get
const override=/^https:\/\/careers\.bhp\.com\/js\/override\.js\?locale=en_GB&i=\d{1,10}$/
const assetKey=url=>override.test(url)?ORIGIN+'/js/override.js?locale=en_GB&i=<CACHE>':url
const modifiers='(?:(?:already|now|currently|temporarily)\\s+)*'
const state='(?:closed|filled|withdrawn|cancelled|canceled|expired|removed|unavailable|not\\s+(?:currently\\s+)?available|no\\s+longer\\s+(?:available|active|open))'
const verb='(?:(?:is|was|are|were|has|have)\\s+'+modifiers+'(?:been\\s+)?)?'+modifiers
const closed=new RegExp('\\b(?:(?:(?:this|the)\\s+)?(?:job|role|position|vacancy|opening|opportunity)\\s+'+verb+state+'|(?:no\\s+longer|not(?:\\s+currently)?)\\s+accepting\\s+(?:(?:any|new)\\s+)?applications|(?:applications|recruitment|hiring)\\s+(?:for\\s+(?:(?:this|the)\\s+)?(?:role|position|job|vacancy)\\s+)?'+verb+'(?:closed|ended|stopped|suspended|unavailable))\\b','i')
const closureOnly=new RegExp('^(?:'+closed.source+')[.!]?$','i')
const rawText=node=>typeof node==='string'?decodeNativeEntities(node):['script','style','meta','link'].includes(node.tag)?'':node.children.map(rawText).join(' ')
const plainTextTags=new Set(['section','div','p','span','h2','h3','h4','h5','h6','ul','ol','li','dl','dt','dd','strong','b','em','i','u','small','br'])
const extraTextProperties=new Set(['qualifications','jobBenefits','responsibilities','skills','experienceRequirements','educationRequirements'])
const walk=(node,visit)=>{if(!node||typeof node!=='object')return;visit(node);for(const value of Object.values(node))if(Array.isArray(value))value.forEach(n=>walk(n,visit));else if(value&&typeof value==='object')walk(value,visit)}
const key=node=>node?.type==='Identifier'?node.name:node?.type==='Literal'?node.value:null
const mask='<style id="antiClickjack" type="text/css">body{display:none !important;}</style>'
function nativeCalendar(value){
 const match=String(value).match(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (0[1-9]|[12]\d|3[01]) ([01]\d|2[0-3]):([0-5]\d):([0-5]\d) UTC ([1-9]\d{3})$/)
 need(match,'native date/calendar representation changed')
 const [,weekday,month,day,hour,minute,second,year]=match,index=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(month)
 const date=new Date(Date.UTC(Number(year),index,Number(day),Number(hour),Number(minute),Number(second)))
 need(date.getUTCFullYear()===Number(year)&&date.getUTCMonth()===index&&date.getUTCDate()===Number(day)&&['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][date.getUTCDay()]===weekday,'native invalid calendar date; rollover forbidden')
 return date.toISOString()
}
function layoutProjection(rawBody,body){
 const original=all(rawBody),projected=all(body)
 need(original.length===projected.length&&original.every((n,i)=>n.tag===projected[i].tag),'native body visibility tree changed')
 return new Map(original.map((n,i)=>[n,projected[i]]))
}
function inactiveClosure(node,projection){
 if(!closureOnly.test(norm(rawText(node)))||readNativeStatusLayout(projection.get(node))?.visibility!=='excluded')return false
 return all(node).every(n=>['div','p','span','template','noscript'].includes(n.tag)&&Object.entries(n.attrs).every(([name,value])=>
  name==='hidden'&&['','hidden'].includes(value)||name==='class'&&value==='hidden'||name==='style'&&/^display\s*:\s*none\s*(?:!important)?\s*;?$/i.test(value.trim())))
}
function authoredText(node,projection,omit){
 if(node===omit)return' <NATIVE-OWN-JOBPOSTING> '
 if(typeof node==='string')return decodeNativeEntities(node)
 if(['script','style','meta','link'].includes(node.tag))return ''
 if(inactiveClosure(node,projection))return ''
 return node.children.map(n=>authoredText(n,projection,omit)).join(' ')
}
// Retain every native body tag and attribute, including inactive controls and
// non-text property values. Only full, visible, attribute-free prose inside a
// declared extra criteria section can extend this reviewed native structure.
function bodyAuthority(rawBody,projection,owner,roleID){
 const ownNodes=new Set(all(owner)),nodes=all(rawBody),parents=new Map(),passiveBindings=new Map()
 for(const node of nodes)for(const child of node.children)if(typeof child!=='string')parents.set(child,node)
 const frequency=nodes.filter(n=>n.tag==='input'&&n.attrs.name==='frequency')
 need(frequency.length===2,'native passive alert control inventory changed')
 frequency.forEach((input,index)=>{
  const id=input.attrs.id,parent=parents.get(input),labels=nodes.filter(n=>n.tag==='label'&&n.attrs.for===id)
  need(/^j_idt\d{1,6}$/.test(id??'')&&nodes.filter(n=>n.attrs.id===id).length===1&&!ownNodes.has(input)
   &&input.attrs.type==='number'&&hasClass(input,'frequencySpinBtn')&&hasClass(parent,'subscribe-frequency-label')
   &&labels.length===1&&parents.get(labels[0])===parent&&labels[0].attrs.id===input.attrs['aria-labelledby'],'native passive alert control/label binding changed')
  const marker='<PASSIVE-ALERT-FREQUENCY-'+index+'>'
  passiveBindings.set(input,{id:marker});passiveBindings.set(labels[0],{for:marker})
 })
 const plainSection=node=>owner.children.includes(node)&&node.tag==='section'&&same(Object.keys(node.attrs),['itemprop'])
  &&extraTextProperties.has(node.attrs.itemprop)&&norm(rawText(node))&&all(node).every(n=>plainTextTags.has(n.tag)
   &&(n===node||Object.keys(n.attrs).length===0)&&!projection.get(n)?.inert&&readNativeStatusLayout(projection.get(n))?.visibility==='visible')
 const tree=node=>{
  if(inactiveClosure(node,projection)||plainSection(node))return null
  const attrs={...node.attrs,...passiveBindings.get(node)}
  if(ownNodes.has(node)&&node.tag==='meta'&&['datePosted','validThrough'].includes(attrs.itemprop))attrs.content='<NATIVE-'+attrs.itemprop+'>'
  if(node.tag==='a'&&attrs.href==='/talentcommunity/apply/'+roleID+'/?locale=en_GB')attrs.href='<CURRENT-NATIVE-APPLY>'
  if(node.tag==='form'&&attrs.action==='/talentcommunity/subscribe/?locale=en_GB&jobid='+roleID)attrs.action='<CURRENT-NATIVE-SUBSCRIBE>'
  if(node.tag==='script'&&attrs.src&&override.test(new URL(attrs.src,ORIGIN).href))attrs.src='/js/override.js?locale=en_GB&i=<CACHE>'
  return{tag:node.tag,attrs,inert:Boolean(node.inert),children:node.children.filter(n=>typeof n!=='string').map(tree).filter(Boolean)}
 }
 return tree(rawBody)
}
export function currentBodyAuthorityInventory(html,css,roleID){
 const unmasked=html.replace(mask,''),raw=docOf(unmasked),nodes=all(rootOf(raw)),rawBody=one(nodes.filter(n=>n.tag==='body'),'inventory body')
 const owner=one(nodes.filter(n=>hasClass(n,'jobDisplayShell')),'inventory own JobPosting')
 const d=readVisibleNativeDocument(unmasked.replace('</head>','<style>'+css+'</style></head>'),{strict:true,statusLayout:true}),body=one(d.statusNodes(n=>n.tag==='body'),'inventory status body')
 return bodyAuthority(rawBody,layoutProjection(rawBody,body),owner,roleID)
}
export function currentStyleProfile(html){
 return sha(JSON.stringify(all(rootOf(docOf(html))).filter(n=>n.tag==='style'||n.tag==='link'&&(n.attrs.rel??'').toLowerCase().split(/\s+/).includes('stylesheet'))
  .map(n=>({tag:n.tag,attrs:n.attrs,inert:Boolean(n.inert),...(n.tag==='style'?{bodySHA256:sha(n.raw??'')}:{})}))))
}
// Current shared page furniture may not silently acquire hiring conditions
// outside the native JobPosting. A changed author frame requires review.
export function currentOutsideOwnerProfile(html,css){
 const unmasked=html.replace(mask,''),raw=docOf(unmasked),nodes=all(rootOf(raw)),rawBody=one(nodes.filter(n=>n.tag==='body'),'author body')
 const owner=one(nodes.filter(n=>hasClass(n,'jobDisplayShell')),'author own JobPosting')
 const d=readVisibleNativeDocument(unmasked.replace('</head>','<style>'+css+'</style></head>'),{strict:true,statusLayout:true}),body=one(d.statusNodes(n=>n.tag==='body'),'author status body')
 return sha(norm(authoredText(rawBody,layoutProjection(rawBody,body),owner)))
}

// The complete current script cohort, modes and order are qualified. Only
// passive anonymous visit/CSRF literals, the matching public job ID and the
// native internal ID (retained and closing-compared) may vary. No code executes.
export function currentProgramProfile(html,roleID=null){
 const nodes=all(rootOf(docOf(html))),frames=[]
 for(const node of nodes.filter(n=>n.tag==='script')){
  const attrs={...node.attrs};if(attrs.src){const url=new URL(attrs.src,ORIGIN);if(override.test(url.href))attrs.src='/js/override.js?locale=en_GB&i=<CACHE>'}
  let code=node.raw??''
  if(!Object.hasOwn(attrs,'src')){
   let ast;try{ast=parse(code,{ecmaVersion:'latest',sourceType:attrs.type==='module'?'module':'script'})}catch{throw problem('unreviewed current native program syntax')}
   const spans=[]
   walk(ast,n=>{
    let value,marker
    if(n.type==='VariableDeclarator'&&n.id?.name==='ctid'){value=n.init;need(value?.type==='Literal'&&uuid.test(value.value),'unreviewed passive visit literal');marker='<PASSIVE-VISIT>'}
    if(n.type==='Property'&&!n.computed&&key(n.key)==='X-CSRF-Token'){value=n.value;need(value?.type==='Literal'&&uuid.test(value.value),'unreviewed anonymous CSRF literal');marker='<ANONYMOUS-CSRF>'}
    if(roleID&&n.type==='Property'&&!n.computed&&key(n.key)==='jobID'){value=n.value;need(value?.type==='Literal'&&String(value.value)===roleID,'native executable role identity mismatch');marker='<PUBLIC-ROLE-ID>'}
    if(roleID&&n.type==='Property'&&!n.computed&&key(n.key)==='internalId'){value=n.value;need(value?.type==='Literal'&&/^[1-9]\d{0,12}-en_GB$/.test(value.value),'native internal requisition identity unavailable');marker='<NATIVE-INTERNAL-ID>'}
    if(marker)spans.push({start:value.start,end:value.end,marker})
   })
   for(const span of spans.sort((a,b)=>b.start-a.start))code=code.slice(0,span.start)+span.marker+code.slice(span.end)
  }
  frames.push({attrs,inert:Boolean(node.inert),bodySHA256:sha(code)})
 }
 const otherExecution=nodes.flatMap(node=>{
  const attrs=Object.entries(node.attrs).filter(([name,value])=>/^on/i.test(name)||['href','action','src'].includes(name)&&/^\s*javascript:/i.test(value))
  if(['iframe','object','embed','frame'].includes(node.tag)||node.tag==='meta'&&/^refresh$/i.test(node.attrs['http-equiv']??''))return[{tag:node.tag,attrs:node.attrs,inert:Boolean(node.inert),rawSHA256:sha(node.raw??'')}]
  return attrs.length?[{tag:node.tag,attrs,inert:Boolean(node.inert)}]:[]
 })
 return sha(JSON.stringify({frames,otherExecution}))
}
function nativeDocument(html,kind,roleID){
 const doc=docOf(html),nodes=all(rootOf(doc))
 need(!nodes.some(n=>n.tag==='base'),'unreviewed native base')
 need(currentProgramProfile(html,roleID)===profile.programs[kind],'unreviewed complete current '+kind+' program/mode/order')
 need(currentStyleProfile(html)===profile.styles[kind],'unreviewed current '+kind+' body stylesheet declaration/mode/order')
 const style=one(nodes.filter(n=>n.tag==='style'&&n.attrs.id==='antiClickjack'),'top-window body mask')
 const controller=one(nodes.filter(n=>n.tag==='script'&&n.attrs.id==='antiClickJackScript'),'top-window display controller')
 const head=one(nodes.filter(n=>n.tag==='head'),'native head')
 need(style.raw==='body{display:none !important;}'&&same(style.attrs,{id:'antiClickjack',type:'text/css'})
  &&head.children.includes(style)&&head.children.includes(controller)&&head.children.indexOf(style)<head.children.indexOf(controller)
  &&same(controller.attrs,{type:'text/javascript',id:'antiClickJackScript'})&&sha(controller.raw??'')===profile.antiSHA256,'unreviewed body mask/controller binding')
 need(html.split(mask).length===2,'ambiguous current top-window mask')
 return{raw:doc,nodes,unmasked:html.replace(mask,''),visible:readVisibleNativeDocument(html.replace(mask,''),{strict:true})}
}
function publisher(html,home){
 const d=readVisibleNativeDocument(html,{strict:true}),nodes=d.nodes(()=>true)
 need(!all(rootOf(docOf(html))).some(n=>n.tag==='base'),'unreviewed corporate base')
 const canonical=one(nodes.filter(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'corporate canonical')
 need(canonical.attrs.href===(home?'https://www.bhp.com':CORPORATE),'corporate canonical identity changed')
 if(home){
  need(nodes.some(n=>n.tag==='a'&&/^BHP Group Ltd \(BHP\), Price displayed in (?:AUD|GBX|USD):$/.test(d.text(n))),'current own BHP Group/BHP issuer binding unavailable')
  need(nodes.some(n=>n.tag==='a'&&n.attrs.href==='/careers'&&/careers?|career with BHP/i.test(d.text(n))),'visible corporate careers handoff unavailable')
 }else need(nodes.some(n=>n.tag==='a'&&n.attrs.href===profile.handoff&&/^(?:View )?current opportunities$/i.test(d.text(n))),'visible corporate native opportunities handoff unavailable')
 return true
}
function verifySearchForm(document){
 const d=document.visible,forms=d.nodes(n=>n.tag==='form'&&n.attrs.name==='keywordsearch'&&n.attrs.method==='get'&&n.attrs.action==='/search/')
 need(forms.some(n=>all(n).some(n=>n.tag==='input'&&n.attrs.name==='q'&&n.attrs.type==='text')),'current public keyword GET form unavailable')
}
function listing(p){
 const d=p.visible,raw=p.raw
 verifySearchForm(p)
 const table=one(d.nodes(n=>n.tag==='table'&&n.attrs.id==='searchresults'),'current native results table')
 const headers=all(table).filter(n=>n.tag==='th').map(n=>[n.attrs.id,d.text(n)])
 need(same(headers,[['hdrTitle','Title'],['hdrLocation','Job Country'],['hdrState','Region'],['hdrShifttype','Shift Type'],['hdrFacility','Job Posting End Date']]),'native country table header changed')
 const rawRows=p.nodes.filter(n=>n.tag==='tr'&&hasClass(n,'data-row')),visibleRows=d.nodes(n=>n.tag==='tr'&&hasClass(n,'data-row'))
 need(rawRows.length===visibleRows.length&&rawRows.length>0&&rawRows.length<=25,'native rows hidden, empty or outside partial observation bound')
 const seen=new Set()
 return rawRows.map((row,index)=>{
  const children=all(row),links=children.filter(n=>n.tag==='a'&&hasClass(n,'jobTitle-link'))
  need(links.length===2&&links.every(n=>!n.inert),'native responsive identity unavailable')
  const urls=links.map(n=>new URL(n.attrs.href,ORIGIN)),titles=links.map(n=>raw.text(n))
  need(urls.every(u=>u.origin===ORIGIN&&!u.search&&!u.hash&&!u.username&&!u.password&&/^\/job\/[^/]+\/[1-9]\d{5,12}\/$/.test(u.pathname))&&urls[0].href===urls[1].href&&titles[0]&&titles[0]===titles[1],'native row role URL/title identity conflict')
  const jobId=urls[0].pathname.split('/').at(-2);need(!seen.has(jobId),'repeated native vacancy identity');seen.add(jobId)
  const country=one(children.filter(n=>n.tag==='td'&&n.attrs.headers==='hdrLocation'),'row typed Job Country'),value=raw.text(country)
  need(value&&d.text(visibleRows[index]).includes(titles[0])&&d.text(visibleRows[index]).includes(value),'native visible row identity/country unavailable')
  return{jobId,title:titles[0],sourceUrl:urls[0].href,nativeCountry:value,rawText:raw.text(row),rawFields:children.filter(n=>n.tag==='td').map(n=>({attrs:n.attrs,text:raw.text(n)}))}
 })
}
const safeHTML=node=>typeof node==='string'?node:node.inert||['script','style','meta','link'].includes(node.tag)?'':`<${node.tag}>${node.children.map(safeHTML).join('')}</${node.tag}>`
function ownRole(html,row,css,now){
 const p=nativeDocument(html,'role',row.jobId),raw=p.raw,rawOwner=one(p.nodes.filter(n=>hasClass(n,'jobDisplayShell')&&n.attrs.itemtype==='http://schema.org/JobPosting'),'own native JobPosting')
 const d=readVisibleNativeDocument(p.unmasked.replace('</head>','<style>'+css+'</style></head>'),{strict:true,statusLayout:true})
 const body=one(d.statusNodes(n=>n.tag==='body'),'current native status body')
 const statusText=node=>typeof node==='string'?decodeNativeEntities(node):readNativeStatusLayout(node)?.visibility==='excluded'?'':node.children.map(statusText).join(' ')
 need(!closed.test(norm(statusText(body))),'current visible or unresolved role availability is unavailable or closed')
 const owner=one(d.nodes(n=>hasClass(n,'jobDisplayShell')&&n.attrs.itemtype==='http://schema.org/JobPosting'),'visible full own JobPosting')
 const descendants=all(owner),rawDesc=all(rawOwner),properties=name=>descendants.filter(n=>n.attrs.itemprop===name),text=name=>d.text(one(properties(name),'native '+name))
 const rawBody=one(p.nodes.filter(n=>n.tag==='body'),'authored native body'),bodyProjection=layoutProjection(rawBody,body)
 need(sha(norm(authoredText(rawBody,bodyProjection,rawOwner)))===profile.outsideOwnerAuthorTextSHA256,'unreviewed authored hiring context outside own JobPosting')
 const propertyNodes=p.nodes.filter(n=>n.attrs.itemprop)
 need(propertyNodes.every(n=>rawDesc.includes(n)&&n.attrs.itemprop.split(/\s+/).length===1),'unbound or ambiguous native role/location/criteria property carrier')
 const metas=rawDesc.filter(n=>n.tag==='meta')
 need(metas.every(n=>['streetAddress','datePosted','validThrough','hiringOrganization'].includes(n.attrs.itemprop)),'unreviewed native metadata criteria carrier')
 const locations=rawDesc.filter(n=>n.attrs.itemprop==='jobLocation'),addressesInRole=rawDesc.filter(n=>n.attrs.itemprop==='address')
 const geoNames=['jobLocation','address','streetAddress','addressCountry','addressLocality','addressRegion','postalCode','geo','latitude','longitude']
 const geography=rawDesc.filter(n=>geoNames.includes(n.attrs.itemprop))
 need(locations.length===1&&addressesInRole.length===1&&same(geography.map(n=>n.attrs.itemprop),['jobLocation','address','streetAddress'])
  &&locations[0].attrs.itemtype==='http://schema.org/Place'&&addressesInRole[0].attrs.itemtype==='http://schema.org/PostalAddress'
  &&all(locations[0]).includes(addressesInRole[0])&&all(addressesInRole[0]).includes(geography[2]),'native own location/country scope changed or conflicts')
 need(same(rawDesc.filter(n=>Object.hasOwn(n.attrs,'itemscope')),[rawOwner,locations[0],addressesInRole[0]]),'unreviewed native structured criteria/location scope')
 const canonical=one(d.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'own role canonical');need(canonical.attrs.href===row.sourceUrl,'native role canonical identity mismatch')
 need(text('title')===row.title,'native list/detail title identity conflict')
 const employer=one(properties('hiringOrganization'),'own employer');need(employer.tag==='meta'&&employer.attrs.content==='BHP Career Portal','native own employer changed')
 const field=label=>{
  const fields=descendants.filter(n=>hasClass(n,'joblayouttoken')&&norm(d.text(n)).startsWith(label+':'))
  return norm(d.text(one(fields,label+' field')).slice(label.length+1))
 }
 const country=field('Job Country'),state=field('Job State/Province'),city=field('Job Location/Region')
 need(country==='India'&&row.nativeCountry==='India','native typed list/detail work-country conflict')
 need(state&&city,'native own India worksite incomplete')
 const addresses=rawDesc.filter(n=>n.attrs.itemprop==='streetAddress');need(addresses.length===1&&addresses[0].attrs.content===country,'native address and visible work-country conflict')
 const posted=one(properties('datePosted'),'native publication'),end=one(properties('validThrough'),'native expiry')
 const postedAt=nativeCalendar(posted.attrs.content),closingDate=nativeCalendar(end.attrs.content)
 need(Date.parse(postedAt)<=Date.parse(now)&&Date.parse(closingDate)>Date.parse(now),'native role future-dated or expired')
 const description=one(properties('description'),'complete native criteria'),criteria=d.text(description)
 need(criteria.length>=1000&&/About BHP/.test(criteria)&&/About the Role/.test(criteria)&&/About You/.test(criteria)&&/About Our Process/.test(criteria),'full own authored criteria unavailable')
 const applies=descendants.filter(n=>n.tag==='a'&&hasClass(n,'dialogApplyBtn')),apply='/talentcommunity/apply/'+row.jobId+'/?locale=en_GB'
 need(applies.length===2&&applies.every(n=>n.attrs.href===apply&&/^Apply now/.test(d.text(n))&&same({...n.attrs,href:'<NATIVE-APPLY>'},profile.applyAttributes)),'native active Apply role identity or enabled attributes mismatch')
 const fullText=d.text(owner)
 need(norm(authoredText(rawOwner,bodyProjection))===fullText,'authored full own criteria hidden, inert or omitted')
 const authoritySHA256=sha(JSON.stringify(bodyAuthority(rawBody,bodyProjection,rawOwner,row.jobId)))
 need(authoritySHA256===profile.bodyAuthoritySHA256,'unreviewed complete native body control/property/value structure')
 const internal=html.match(/"internalId":"([1-9]\d{0,12})-en_GB"/g)
 need(internal?.length===1,'native internal application ID ambiguous')
 return{jobId:row.jobId,requisitionId:internal[0].match(/\d+/)[0],title:row.title,sourceUrl:row.sourceUrl,link:row.sourceUrl,applyUrl:ORIGIN+apply,
  country,city,state,location:[city,state,country].join(', '),locations:[[city,state,country].join(', ')],postedAt,closingDate,
  nativeCompanyBrand:'BHP',nativeHiringOrganization:'BHP Career Portal',nativeLegalEmployer:null,nativeIssuerBinding:'BHP Group Ltd (BHP)',
  jobDescription:fullText,sourceDescription:owner.children.map(safeHTML).join(''),sourceNativeDescription:criteria,sourceDetailComplete:true,
  sourceWholeVisibleOwnerRetained:true,sourceNativeBodyAuthoritySHA256:authoritySHA256,sourceScopeComplete:false,sourceListingComplete:false,sourceCompanyCoverageComplete:false,
  lifecycleCleanupAllowed:false,sourceRenderedApplicationQualified:false,sourceNativeClosingReconciled:true}
}

export async function runCurrentBhp(source,options={}){
 need(Object.hasOwn(companies,source),'original source identity unavailable');options.signal?.throwIfAborted()
 const now=typeof options.now==='function'?options.now():options.now??new Date().toISOString();need(Number.isFinite(Date.parse(now)),'invalid observation clock')
 need(!(options.fetchPage||options.fetchText||options.fetchJson),'original byte/HTTP transport required')
 const duration=options.sourceDeadlineMs??85000,interval=options.requestIntervalMs??500
 need(Number.isSafeInteger(duration)&&duration>0&&duration<=180000,'invalid bounded source deadline')
 need(Number.isSafeInteger(interval)&&interval>=0&&interval<=60000&&(interval>=500||options.fetchImpl),'invalid native host pacing')
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(problem('source deadline exceeded')),duration)
 const signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal,receipts=[],lastReads=new Map(),allowed=new Set([HOME,CORPORATE,profile.handoff,QUERY])
 let reads=0,total=0,opening,closing
 const read=async(url,kind)=>{
  signal.throwIfAborted();need(allowed.has(url)&&++reads<=100,'unbound native URL or read budget')
  const origin=new URL(url).origin,wait=Math.max(0,interval-(performance.now()-(lastReads.get(origin)??-Infinity)))
  if(wait)await delay(wait,undefined,{signal});lastReads.set(origin,performance.now())
  const packet=await boundedDeclaredPublicRead(url,{signal,timeoutMs:15000,overflowError:problem('native byte bound'),fetchImpl:async(value,init)=>{
   // Preserve the registered generic reader's existing transparent public
   // identity and HTML negotiation. The bounded primitive owns cancellation,
   // original bytes and manual redirects, not a new source request identity.
   const response=await(options.fetchImpl??globalThis.fetch)(value,{...init,cache:'no-store',credentials:'omit',headers:{...init.headers,
    'User-Agent':'Mozilla/5.0 (compatible; Jobverify careers inventory check)',...(kind==='html'?{Accept:'text/html'}:{})}});let bytes=0
   const body=response.body===null?null:{cancel:reason=>response.body.cancel(reason),getReader(){const reader=response.body.getReader();return{
    async read(){const part=await reader.read();if(!part.done){need(types.isUint8Array(part.value),'native chunk must be bytes');const length=byteLength.call(part.value);need(length<=4_000_000-bytes&&length<=16_000_000-total,'native streaming byte bound');bytes+=length;total+=length}return part},cancel:reason=>reader.cancel(reason),releaseLock:()=>reader.releaseLock()}}}
   return{status:response.status,url:response.url,headers:response.headers,body}
  }})
  const bytes=Buffer.from(packet.bodyBase64,'base64');receipts.push({requestedURL:url,...packet,bodySHA256:sha(bytes)})
  need(packet.status===200&&packet.url===url,'native HTTP status or final URL changed')
  const mime=(packet.headers['content-type']??'').split(';')[0].trim().toLowerCase()
  if(kind==='html')need(mime==='text/html','native publisher/document MIME changed')
  else{const expected=profile.assets[assetKey(url)];need(expected&&expected.mime===mime&&expected.bytes===bytes.length&&expected.sha256===sha(bytes),'complete current declared client/style changed')}
  try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{throw problem('native invalid UTF-8')}
 }
 const pass=async()=>{
  publisher(await read(HOME,'html'),true);publisher(await read(CORPORATE,'html'),false)
  const assets=new Map()
  const document=async(url,kind,id)=>{
   const html=await read(url,'html'),p=nativeDocument(html,kind,id)
   const styles=[]
   for(const node of p.nodes.filter(n=>n.tag==='link'&&n.attrs.rel==='stylesheet'||n.tag==='script'&&n.attrs.src)){
    const resource=new URL(node.attrs.href??node.attrs.src,url).href,k=assetKey(resource)
    if(!Object.hasOwn(profile.assets,k)){need(profile.passiveExternalScripts.includes(resource)&&node.tag==='script','unreviewed declared native dependency');continue}
    need(!node.inert&&!(node.attrs.disabled!==undefined),'native client/style is inactive')
    if(!assets.has(resource)){allowed.add(resource);assets.set(resource,{kind:node.tag==='link'?'style':'script',body:await read(resource,'asset')})}
    if(node.tag==='link')styles.push(assets.get(resource).body)
   }
   const css=styles.join('\n')
   return{html,p,css}
  }
  const search=await document(profile.handoff,'search');verifySearchForm(search.p)
  const page=await document(QUERY,'query'),rows=listing(page.p),jobs=[]
  for(const row of rows.filter(r=>r.nativeCountry==='India')){allowed.add(row.sourceUrl);const role=await document(row.sourceUrl,'role',row.jobId);jobs.push(ownRole(role.html,row,role.css,now))}
  return{rows,jobs}
 }
 try{
  opening=await pass();closing=await pass();need(same(opening,closing),'closing native membership/full criteria/identity changed');signal.throwIfAborted()
  const jobs=opening.jobs.map(job=>({...job,source,company:companies[source],scrapedAt:now}))
  attachSourceObservationEvidence(jobs,{source,recordKind:'vacancy-rows',observedRecordCount:opening.rows.length,observedVacancyCount:opening.rows.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{source,openingRows:opening.rows,closingRows:closing.rows,nativeModels:opening.jobs,heldNativeRows:opening.rows.filter(r=>r.nativeCountry!=='India').map(r=>({...r,holdReason:'foreign-or-unresolved-native-country;partial-query-only'})),originalResponses:receipts,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,applicationInteractions:0,independentNativeClosingReconciled:true},configurable:true})
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:QUERY,firstParty:true,listingComplete:false,reportedTotal:null,indiaFacetCount:null,pagesFetched:reads,verifiedAt:now,reason:'stable-own-current-keyword-observations-and-full-India-role-criteria;partial-query-company-inventory-and-zero-unqualified;cleanup-forbidden'})
 }catch(error){
  if(options.signal?.aborted)throw options.signal.reason
  if(error&&typeof error==='object'&&Object.isExtensible(error))try{Object.defineProperty(error,'sourceAudit',{value:{source,opening,closing,originalResponses:receipts,sourceScopeComplete:false,lifecycleCleanupAllowed:false},enumerable:true,configurable:true})}catch{}
  throw error
 }finally{clearTimeout(timer)}
}
