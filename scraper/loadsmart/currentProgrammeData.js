import {createHash} from 'node:crypto'
import {isDeepStrictEqual,types} from 'node:util'
import {decodeHTML} from 'entities'
import {readNativeDocument,readNativeAttributeTokens,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {parseEightfoldJson} from '../../scraper-support/utils/recruitmentEightfoldData.js'
import {NATIVE_INDIA_LOCATION} from '../../scraper-support/utils/greenhouseLocations.js'
import {validatePublicPostingScope} from '../../scraper-support/utils/publishingGapAts.js'
import {certifyLeverRequestMetadata,LOADSMART_SERVER_PUBLICATION_PROFILE} from '../../scraper-support/utils/leverRequestMetadataCertificate.js'
export {LOADSMART_SERVER_PUBLICATION_PROFILE}

export const CORPORATE='https://loadsmart.com/careers/'
export const BOARD='https://jobs.lever.co/loadsmart/'
export const CLIENT='https://jobs.lever.co/js/list.js'
export const API='https://api.lever.co/v0/postings/loadsmart?mode=json'
export const CLIENT_SHA256='369919145cbce28d907a75a8c1da873f3cf62eafbb7fb8c323c18fdd2a8d1f76'
export const sha=value=>createHash('sha256').update(value).digest('hex')
export const failure=message=>Object.assign(new Error('Loadsmart programme: '+message),{softFailure:true,abortRetries:true,upstreamOutage:false,failureKind:'coverage_gap'})
export const need=(value,message)=>{if(!value)throw failure(message)}
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)
const norm=s=>s.replace(/\s+/gu,' ').trim()
const entriesOf=document=>{const result=[];const visit=(node,ancestors=[])=>{if(typeof node==='string')return;result.push({node,ancestors});for(const child of node.children)visit(child,[...ancestors,node])};for(const root of document.nodes(n=>n.tag==='root'))visit(root);return result}
const active=e=>!e.node.inert&&!e.node.nativeTagUnqualified&&!e.ancestors.some(n=>n.inert||n.nativeTagUnqualified||['template','noscript','svg','math','object','iframe'].includes(n.tag))
const plainText=node=>typeof node==='string'?decodeHTML(node):node.children.map(plainText).join('')

export function readLoadsmartCorporate(html){
 // Current reviewed first-party programme, including all declarations and
 // consumer bodies. Unknown corporate changes need a new reviewed profile.
 need(sha(html)==='7fbee7abb7bee3dcca1d3a2934bcacae4f4ffb6b74485469f4622065c7b19eb6','Current whole corporate publisher/consumer profile changed')
 const document=readNativeDocument(html),entries=entriesOf(document),head=activeHead(html)
 need(isDeepStrictEqual(head.titles,['Freight Tech Careers & Logistics Technology Jobs | Loadsmart']),'Corporate publisher identity changed')
 const links=entries.filter(e=>e.node.tag==='a'&&e.node.attrs.href===BOARD)
 need(links.length===4&&links.every(active),'Current active exact corporate careers handoff unavailable')
 need(links.some(e=>norm(plainText(e.node))==='Explore open positions'),'Corporate recruitment declaration changed')
 return{publisherBrand:'Loadsmart',corporateURL:CORPORATE,declaredBoardURL:BOARD,activeHandoffCount:links.length,bodySHA256:sha(html),publisherLegalEntity:null}
}

const cardShape=node=>{
 // The acquired title and three labels are scalar text slots. Do not erase
 // a nested frame/script/link/foreign carrier when representing their text.
 const title=node.children[1].children[0],labels=node.children[1].children[1].children
 need([title,...labels].every(n=>n.children.every(c=>typeof c==='string')),'Unreviewed nested native card content/consumer')
 const copy=n=>typeof n==='string'?n:{...n,attrs:{...n.attrs},children:n.children.map(copy)}
 const result=copy(node)
 result.attrs['data-qa-posting-id']='<id>'
 result.children[0].children[0].attrs.href='<ownURL>'
 result.children[1].attrs.href='<ownURL>'
 result.children[1].children[0].children=['<title>']
 for(const child of result.children[1].children[1].children)child.children=['<label>']
 return sha(JSON.stringify(result))
}
// Source-tree model pin outside every separately reconciled posting. It does
// not rewrite the raw entity or the complete-entity closing fingerprint.
const boardModel=node=>typeof node==='string'?node:node.attrs.class==='posting'?null:node.tag==='script'&&node.raw?.includes('window.__CF$cv$params')
 ?{...node,raw:'reviewed-two-header-rays-one-opaque-t-source',children:[]}
 :Object.fromEntries(Object.entries(node).map(([k,v])=>[k,k==='children'?v.map(boardModel).filter(v=>v!==null):v]))

const originalBoardMetadata=metadata=>{
 need(object(metadata)&&!types.isProxy(metadata)&&[Object.prototype,null].includes(Object.getPrototypeOf(metadata)),'Original plain native receipt metadata/provenance required')
 const suppliedProfile=Object.getOwnPropertyDescriptor(metadata,'profile')
 if(suppliedProfile)need(Object.hasOwn(suppliedProfile,'value')&&suppliedProfile.value===LOADSMART_SERVER_PUBLICATION_PROFILE,'Unreviewed original receipt profile')
 const original={profile:LOADSMART_SERVER_PUBLICATION_PROFILE}
 for(const key of['requestedURL','finalURL','headers','headerEntries']){
  const descriptor=Object.getOwnPropertyDescriptor(metadata,key)
  need(descriptor&&Object.hasOwn(descriptor,'value'),'Original receipt own data metadata unavailable: '+key)
  original[key]=descriptor.value
 }
 return original // Never fill a missing or redirected original transport URL.
}

export function readLoadsmartBoard(html,responseMetadata){
 const certificate=certifyLeverRequestMetadata(html,originalBoardMetadata(responseMetadata))
 need(certificate.comparisonProfile===LOADSMART_SERVER_PUBLICATION_PROFILE&&certificate.tDateBound===false&&certificate.sourceTimeSemanticsQualified===false,'Unqualified server-publication metadata comparison profile')
 const document=readNativeDocument(html),entries=entriesOf(document),head=activeHead(html),root=document.nodes(n=>n.tag==='root')[0]
 need(isDeepStrictEqual(head.titles,['Loadsmart'])&&head.metas.filter(m=>m.property==='og:url'&&m.content==='https://jobs.lever.co/loadsmart').length===1,'Native board publisher/account identity changed')
 need(entries.filter(e=>e.node.tag==='script'&&e.node.raw?.includes('window.__CF$cv$params')).length===1,'Ambiguous native response metadata carrier')
 need(sha(JSON.stringify(boardModel(root)))==='0dd11b22934ffb058b634a59c4d0168937a7844aa0e8784bdbe9a6c0a6617400','Unreviewed native board structure/filter/client/style/declaration profile')
 const clients=entries.filter(e=>e.node.tag==='script'&&e.node.attrs.src==='/js/list.js')
 need(clients.length===1&&active(clients[0])&&Object.keys(clients[0].node.attrs).length===1,'Exact active declared listing client changed')
 const wrappers=entries.filter(e=>e.node.attrs.class==='postings-wrapper')
 need(wrappers.length===1&&active(wrappers[0]),'Unique active unfiltered native postings mount unavailable')
 const filters=entries.filter(e=>e.node.attrs.class==='filter-button-wrapper filter-button-wrapper-margin-right')
 need(filters.length===4&&filters.every(active)&&isDeepStrictEqual(filters.map(e=>e.node.attrs['aria-label']),['Filter by Location type: All','Filter by Location: All','Filter by Team: All','Filter by Work type: All']),'All four current native filters must be unfiltered')
 const raw=entries.filter(e=>Object.hasOwn(e.node.attrs,'data-qa-posting-id')||e.node.attrs.class?.split(/\s+/).includes('posting'))
 need(raw.length>0,'No authored genuine empty-board contract is reviewed')
 const groupModel=new Map();let department=null
 for(const group of wrappers[0].node.children.filter(n=>typeof n!=='string')){
  need(group.attrs.class==='postings-group','Unreviewed native department/team group')
  const header=group.children.find(n=>typeof n!=='string'&&n.attrs.class==='large-category-header')
  if(header)department=norm(plainText(header))
  const team=group.children.find(n=>typeof n!=='string'&&n.attrs.class==='posting-category-title large-category-label')
  need(department&&team,'Native department/team header missing');groupModel.set(group,{department,team:norm(plainText(team))})
 }
 const visible=readVisibleNativeDocument(html,{strict:true}),visibleIDs=new Set(visible.nodes(n=>n.attrs['data-qa-posting-id']).map(n=>n.attrs['data-qa-posting-id'])),IDs=new Set(),postings=[]
 for(const e of raw){
  const n=e.node,id=n.attrs['data-qa-posting-id']
  need(n.tag==='div'&&n.attrs.class==='posting'&&Object.keys(n.attrs).length===2&&typeof id==='string'&&!IDs.has(id)&&active(e)&&e.ancestors.includes(wrappers[0].node)&&visibleIDs.has(id),'Raw duplicate/hidden/inert/unqualified native posting identity');IDs.add(id)
  try{need(cardShape(n)===CARD_SHAPE,'Whole native card title/location/criteria structure changed')}catch(error){if(error.failureKind)throw error;throw failure('Whole native card structure changed')}
  const title=n.children[1],labels=title.children[1].children
  const group=e.ancestors.find(n=>groupModel.has(n));need(group,'Native posting is outside a reviewed department/team')
  const posting={id,title:norm(plainText(title.children[0])),URL:title.attrs.href,applyLabelURL:n.children[0].children[0].attrs.href,workplace:norm(plainText(labels[0])),commitment:norm(plainText(labels[1])),location:norm(plainText(labels[2])),...groupModel.get(group)}
  need(posting.URL===BOARD+id&&posting.applyLabelURL===posting.URL&&posting.title,'Native own-role account identity mismatch')
  need(!NATIVE_INDIA_LOCATION.test(Object.values(posting).join(' ')),'Native card India/location uncertainty requires separate qualification')
  postings.push(posting)
 }
 need(visibleIDs.size===IDs.size,'Unreconciled raw/visible native posting')
 return{publisherBrand:'Loadsmart',boardURL:BOARD,postings,filters:filters.map(e=>e.node.attrs['aria-label']),requestMetadataCertificate:certificate,bodySHA256:sha(html),comparisonFingerprint:certificate.comparisonFingerprint,listingScriptURL:CLIENT,unfiltered:true}
}

// This pin is filled from the acquired complete current first native card;
// it covers the complete DOM shape, original classes, label order and attrs.
const CARD_SHAPE='c337e94e159bed00e1e32fa97895ff4c5217ef4e9b93db97c01610fefcc13b63'

export function readLoadsmartClient(text){
 need(sha(text)===CLIENT_SHA256,'Complete current listing script source changed')
 return{URL:CLIENT,sourceSHA256:CLIENT_SHA256,sourceBytes:Buffer.byteLength(text),publishedConsumer:'Only filter-popup accessibility, mouse/click/keyboard focus and show/hide. No posting/API load, subset, paging or child import in this exact reviewed source.',executed:false,unacquiredJQueryAnalyticsCSSOrCFChildrenQualified:false}
}

const allowed=new Set(['additional','additionalPlain','applyUrl','categories','country','createdAt','description','descriptionBody','descriptionBodyPlain','descriptionPlain','hostedUrl','id','lists','opening','openingPlain','salaryDescription','salaryDescriptionPlain','salaryRange','text','workplaceType'])
const htmlFields=['opening','description','descriptionBody','additional'],plainFields=htmlFields.map(k=>k+'Plain')
// Actual observed publisher-authored location / typed-country pairs; no city
// supplies or inherits a country. New labels/alternatives remain unresolved.
const countryPairs=new Map([['Chicago','US'],['Chicago / Remote','US'],['São Paulo / Remote','BR'],['Philippines / Remote','PH']])
// Four exact acquired representation pairs differ before this repair: one
// serializer word-boundary difference and one role's extra plain introductory
// company text. Both originals remain preserved. These are exact data pairs,
// never a rule deleting spaces, punctuation or criteria from future records.
const originalRepresentationPairs=new Map([
 ['be01a698-8459-4a99-b10a-21bf2fbf5929/description',['2a2b4a2410c384f622d08f1889fc6d92b9885ae525d4d082e805c7a28da582f2','753461837b625dfb789af98605e0708b0e12e892cef260bfc3804cd8803ac926']],
 ['be01a698-8459-4a99-b10a-21bf2fbf5929/descriptionBody',['eccf22d50e8b7cd5929257e5e159418b493525c8e6e3a628b640a3b06292dbd0','19f214fa7eb17c33d733ac00bc8220e44488a29cdda37ad08935a56f8330dedc']],
 ['d05cca8d-a041-4274-a2a7-5d8f290234ce/description',['21da5ba3771842b965eb78b0ff5e4cbf12deed0b4ccbb1250eacfe0d7ed7873c','b7b6e380a1dfd4d38016be9a832beb4148d7bfc166246cc2ccf8427579a8f7e5']],
 ['d05cca8d-a041-4274-a2a7-5d8f290234ce/descriptionBody',['784baedc85d810f2d6ece3b1c6f6858badee6cdb59ac015f315538ed2cb5b934','e23538262d1e91a6fe06ad066faf47948b9071e410123cbe30510369d4667351']],
])
const tags=new Set(['root','div','p','ul','li','strong','span','br','em']),blocks=new Set(['div','p','ul','li','br'])
const attributes=new Map([
 ['strong@style',new Set(['font-size: 15px;','font-size: 10pt;','font-size: 16px;'])],
 ['span@style',new Set(['font-size: 15px;','font-size: 10pt; font-family: Poppins, sans-serif; background-color: #ffffff;','font-size: 10pt; font-family: Poppins, sans-serif; color: #ff0000; background-color: #ffffff;','font-size: 10pt; font-family: Poppins, sans-serif;','font-size: 10pt;','font-size: 10pt; background-color: #ffffff;','font-size: 16px;'])],
 ['p@style',new Set(['background-color: #ffffff; margin-top: 0pt; margin-bottom: 0pt;','line-height: 1.2; text-align: justify; margin-top: 0pt; margin-bottom: 10pt;','margin-top: 0pt; margin-bottom: 0pt;','margin-right: 30pt; background-color: #ffffff; margin-top: 12pt; margin-bottom: 0pt;'])],
 ['ul@style',new Set(['margin-top: 0px; margin-bottom: 0px; padding-inline-start: 48px;'])],['li@style',new Set(['font-size: 10pt; font-family: Poppins, sans-serif;'])],
])
const authoredText=html=>{
 need(typeof html==='string','Full native HTML criteria must be strings')
 const re=/<\/?([A-Za-z][A-Za-z0-9:-]*)([^<>]*)>/g
 need(!html.replace(re,'').includes('<'),'Unreviewed authored HTML/comment carrier')
 for(const m of html.matchAll(re)){
  const tag=m[1].toLowerCase();need(tags.has(tag),'Unreviewed authored tag/foreign namespace')
  if(m[0].startsWith('</')){need(!m[2].trim(),'Unreviewed authored closing tag');continue}
  const seen=new Set();for(const[k,v]of readNativeAttributeTokens(m[2])){need(!seen.has(k)&&attributes.get(tag+'@'+k)?.has(v),'Unreviewed authored style/visibility/duplicate attribute');seen.add(k)}
 }
 const document=readNativeDocument(html)
 const text=n=>{if(typeof n==='string')return decodeHTML(n);need(!n.inert&&tags.has(n.tag),'Unreviewed authored hidden/carrier model');const s=n.children.map(text).join('');return blocks.has(n.tag)?' '+s+' ':s}
 return text(document.nodes(n=>n.tag==='root')[0])
}

export function readLoadsmartNative(text){
 let rows;try{rows=parseEightfoldJson(text)}catch(error){throw failure('Native JSON: '+error.message)}
 need(Array.isArray(rows)&&rows.length>0,'Complete native flat array required; no empty-publication model reviewed')
 const IDs=new Set()
 for(const row of rows){
  need(object(row)&&Object.keys(row).every(k=>allowed.has(k)),'Unreviewed native field/criteria/applicant schema')
  need(typeof row.id==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(row.id)&&!IDs.has(row.id),'Duplicate/malformed native role identity');IDs.add(row.id)
  need(typeof row.text==='string'&&row.text.trim()&&row.hostedUrl===BOARD+row.id&&row.applyUrl===row.hostedUrl+'/apply','Native account/own/application URL identity changed')
  need(object(row.categories)&&Object.keys(row.categories).length===5&&Object.keys(row.categories).every(k=>['allLocations','commitment','department','location','team'].includes(k)),'Native category/location shape changed')
  for(const k of['commitment','department','location','team'])need(typeof row.categories[k]==='string'&&row.categories[k].trim(),'Native category/location missing')
  need(['US','BR','PH'].includes(row.country)&&countryPairs.get(row.categories.location)===row.country,'Native country/location unknown, contradictory or India')
  need(Array.isArray(row.categories.allLocations)&&row.categories.allLocations.length===1&&row.categories.allLocations[0]===row.categories.location,'Additional native country/worksite unresolved')
  need(Number.isSafeInteger(row.createdAt)&&row.createdAt>=0&&['onsite','hybrid','remote'].includes(row.workplaceType),'Native raw date/workplace type changed')
  for(const k of[...htmlFields,...plainFields])need(typeof row[k]==='string','Complete original criteria missing: '+k)
  need(Array.isArray(row.lists)&&row.lists.every(l=>object(l)&&Object.keys(l).length===2&&Object.keys(l).every(k=>['text','content'].includes(k))&&typeof l.text==='string'&&typeof l.content==='string'),'Native criteria list structure changed')
  need(Object.hasOwn(row,'salaryDescription')===Object.hasOwn(row,'salaryDescriptionPlain'),'Native salary representations missing')
  if(Object.hasOwn(row,'salaryRange')){const s=row.salaryRange;need(object(s)&&Object.keys(s).length===4&&Object.keys(s).every(k=>['min','max','currency','interval'].includes(k))&&Number.isFinite(s.min)&&Number.isFinite(s.max)&&s.min>=0&&s.max>=s.min&&s.currency==='USD'&&row.country==='US'&&s.interval==='per-year-salary','Native complete salary model changed')}
  const authored=Object.fromEntries(htmlFields.map(k=>[k,authoredText(row[k])]))
  // Company overview or benefits alone cannot establish a vacancy's full
  // published role criteria. The actual Philippines role has no body but has
  // substantial complete native lists; the other acquired roles have a body.
  const boilerplate=new Set([norm(authored.opening),norm(authored.additional)])
  const roleCriteria=[authored.descriptionBody,...row.lists.map(l=>authoredText(l.content))].map(norm)
  need(roleCriteria.some(text=>text.length>100&&!boilerplate.has(text)),'Complete role-specific native body/list criteria missing')
  for(const k of htmlFields){const pair=originalRepresentationPairs.get(row.id+'/'+k);need(norm(authored[k])===norm(decodeHTML(row[k+'Plain']))||(pair&&sha(row[k])===pair[0]&&sha(row[k+'Plain'])===pair[1]),'Unreviewed original native HTML/plain criteria contradiction')}
  const texts=[decodeHTML(row.text),...['commitment','department','location','team'].map(k=>decodeHTML(row.categories[k])),...plainFields.map(k=>decodeHTML(row[k])),...Object.values(authored),...row.lists.flatMap(l=>[decodeHTML(l.text),authoredText(l.content)])]
  if(Object.hasOwn(row,'salaryDescription')){need(typeof row.salaryDescriptionPlain==='string','Native salary plain criteria missing');const salaryText=authoredText(row.salaryDescription);need(norm(salaryText)===norm(decodeHTML(row.salaryDescriptionPlain)),'Native salary HTML/plain criteria contradiction');texts.push(salaryText,decodeHTML(row.salaryDescriptionPlain))}
  need(texts.some(t=>t.trim().length>100),'Full original native criteria unavailable')
  need(!texts.some(t=>NATIVE_INDIA_LOCATION.test(t)||/\b(?:work(?:ing)?\s+country|applicant\s+(?:country|location))\s*:/i.test(t)),'Authored India/location/applicant country requires separate qualification')
 }
 need(validatePublicPostingScope(rows,'lever',{source:'loadsmart',boardToken:'loadsmart',leverRegion:'global'}).length===0,'Native complete worksite/country scope unresolved')
 return rows // No projection, filtering, reordering or source-field rewriting.
}

export function reconcileLoadsmartBoard(board,rows){
 need(board.postings.length===rows.length,'Native board/API whole membership mismatch')
 const byID=new Map(rows.map(row=>[row.id,row]))
 for(const p of board.postings){const r=byID.get(p.id);need(r&&p.title===norm(r.text)&&p.location===norm(r.categories.location)&&p.commitment===r.categories.commitment&&p.department===r.categories.department&&p.team===r.categories.team&&p.workplace===({onsite:'On-site —',hybrid:'Hybrid —',remote:'Remote —'})[r.workplaceType]&&p.URL===r.hostedUrl,'Native board/API title/location/commitment/workplace/team/account conflict')}
 return true
}

const securityKeys=['content-security-policy','content-security-policy-report-only','x-content-security-policy','x-webkit-csp','cross-origin-embedder-policy','cross-origin-resource-policy','cross-origin-opener-policy','x-frame-options','permissions-policy','document-policy']
export function readLoadsmartSecurity(headers,url){
 const policy=Object.fromEntries(securityKeys.map(k=>[k,headers.get(k)]));for(const k of securityKeys)need(policy[k]===null,'Unreviewed response security policy: '+k)
 need(headers.get('x-content-type-options')===(url===CORPORATE?null:'nosniff'),'Current response nosniff profile changed');policy['x-content-type-options']=headers.get('x-content-type-options')
 for(const[k]of headers){need(!k.startsWith('access-control-'),'Unreviewed response CORS policy');need(!['location','content-location','refresh','content-disposition','x-amzn-waf-action','x-sucuri-block'].includes(k)&&!/(?:^|-)(?:authenticate|authentication-info|captcha|challenge|mitigated)(?:-|$)/i.test(k)&&!/^cf-chl(?:-|$)/i.test(k),'Unreviewed denial/auth/challenge/redirect header: '+k)}
 return policy
}
