import {createHash} from 'node:crypto'
import {readNativeDocument} from '../utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../utils/visibleNativeHtml.js'
import {clientScriptDeclarations,hasClientDocumentBase} from '../utils/reviewedClientProgram.js'
import {matchesAuthoredIntegrity} from '../native-sources/declaredGreenhouse/reviewedDeclaredAssets.js'

export const AURECON_CAREERS='https://www.aurecongroup.com/careers/experienced-professionals'
export const AURECON_CONTACT='https://www.aurecongroup.com/contact-us'
export const AURECON_BOARD='https://aurecongroup.wd3.myworkdayjobs.com/en-US/aurecon'
export const AURECON_API='https://aurecongroup.wd3.myworkdayjobs.com/wday/cxs/aurecongroup/aurecon/jobs'
export const AURECON_MAIN='https://www.aurecongroup.com/content/static/index.20261009.1.js'
export const AURECON_CONTACT_MODULE='https://www.aurecongroup.com/content/static/indexBQdjKFCm.js'
export const AURECON_CONTACT_TARGET='https://www.aurecongroup.com/content/static/indexbqdjkfcm.js'
const BOARD_KEY='https://aurecongroup.wd3.myworkdayjobs.com/aurecon'
const MAIN_SHA='6dcc8d8b84abd7bdc23425ff584791df465d58ffcf8d70c2974d0b46999ba99a'
const CONTACT_SHA='efb133e47525c56636a8a00f8150ba9a61d2ecabc03028aeda19fc40387482f1'
// Each reviewed deployment has its own complete original request sequence.
// The November build split the native contact model constants/sanitizer from
// the contact component. Pin those explicit imports before using that model.
const currentMain='https://www.aurecongroup.com/content/static/index.20261116.1.js'
const profiles=[
 {main:AURECON_MAIN,steps:[
  {url:AURECON_MAIN,sha256:MAIN_SHA},
  {url:AURECON_CONTACT_MODULE,location:AURECON_CONTACT_TARGET},
  {url:AURECON_CONTACT_TARGET,sha256:CONTACT_SHA},
 ]},
 {main:currentMain,steps:[
  {url:currentMain,sha256:'d494885b5f39398405f6d9f73cf39540b7a332e8c721ed6e7977e75b0fe89d41'},
  {url:'https://www.aurecongroup.com/content/static/ContactUsPageD1OZtVsm.js',location:'https://www.aurecongroup.com/content/static/contactuspaged1oztvsm.js'},
  {url:'https://www.aurecongroup.com/content/static/contactuspaged1oztvsm.js',sha256:'2bdf93c7324cd4837fbdde75f6b27f5292a48d62a70b022cd0197970cf256877'},
  {url:'https://www.aurecongroup.com/content/static/constantsD2LeT1o5.js',location:'https://www.aurecongroup.com/content/static/constantsd2let1o5.js'},
  {url:'https://www.aurecongroup.com/content/static/constantsd2let1o5.js',sha256:'73aeb9cad8d1aa1eb97ecac811a986edf05a844733ed49bc2588b5504fed2203'},
  {url:'https://www.aurecongroup.com/content/static/sanatiseStringXxxJfhmd.js',location:'https://www.aurecongroup.com/content/static/sanatisestringxxxjfhmd.js'},
  {url:'https://www.aurecongroup.com/content/static/sanatisestringxxxjfhmd.js',sha256:'90212c08b4ebf081b38a17ffc21cdc6584b56c82e6c18bed2bf87b253c5c2e47'},
 ]},
]
export const AURECON_REVIEWED_CLIENT_URLS=Object.freeze([...new Set(profiles.flatMap(p=>p.steps.map(s=>s.url)))])
export const AURECON_CLIENT_REDIRECTS=Object.freeze(Object.fromEntries(profiles.flatMap(p=>p.steps.filter(s=>s.location).map(s=>[s.url,s.location]))))
const hash=value=>createHash('sha256').update(value).digest('hex')
const jsonHash=value=>hash(JSON.stringify(value)),key=value=>value.trim().toLowerCase()
const requireProof=(ok,reason)=>{if(!ok)throw Object.assign(Error('Invalid current Aurecon worksite proof: '+reason),{abortRetries:true,failureKind:'parser_or_contract_error'})}
const guid=value=>value&&value.IsNull===false&&value.IsGlobalNullId===false&&typeof value.Guid==='string'&&/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value.Guid)?value.Guid.toLowerCase():null
const time=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))

// Explicit country names/codes only. No city, address, postcode or employer-HQ lookup.
const countries=new Map()
const regionNames=new Intl.DisplayNames(['en'],{type:'region'})
for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){
 const code=String.fromCharCode(a,b),name=regionNames.of(code)
 if(name&&name!==code&&!['ZZ','EU','UN','XA','XB','QO'].includes(code)){
  const canonical=new Intl.Locale('und-'+code).region
  for(const token of [name,code])countries.set(token.toLowerCase().replace(/[\s-]+/g,''),canonical)
 }
}
const countryCode=value=>typeof value==='string'?countries.get(value.trim().toLowerCase().replace(/[\s-]+/g,''))||null:null

const clocks=({attemptStartedAt,attemptDeadlineAt,verifiedAt},now=Date.now())=>{
 requireProof([attemptStartedAt,attemptDeadlineAt,verifiedAt].every(time),'attempt clocks')
 const start=Date.parse(attemptStartedAt),end=Date.parse(attemptDeadlineAt),verified=Date.parse(verifiedAt)
 requireProof(Number.isFinite(now)&&start<=verified&&verified<=now&&now<=end&&end>start&&end-start<=600000,'stale or unbounded attempt')
 return value=>time(value)&&Date.parse(value)>=start&&Date.parse(value)<=verified
}
const checkResponse=(row,url,inAttempt,{javascript=false,sha256=null}={})=>{
 requireProof(row?.url===url&&row.status===200&&inAttempt(row.fetchedAt)&&typeof row.body==='string'
  &&Buffer.byteLength(row.body)<=4*1024*1024&&hash(row.body)===row.sha256
  &&(!sha256||row.sha256===sha256)
  &&(javascript?/^(?:text|application)\/(?:x-)?(?:javascript|ecmascript)(?:\s*;|$)/i:/^(?:text\/html|application\/xhtml\+xml)(?:\s*;|$)/i).test(row.contentType||''),'response identity, body, type or current receipt: '+url)
}
const checkClientResponse=(row,step,inAttempt)=>{
 if(step.location){
  // Keep the original redirect separate; its target never impersonates a 200
  // response from the authored mixed-case import URL.
  requireProof(row?.url===step.url&&row.status===301&&row.location===step.location
   &&row.body===null&&row.sha256===null&&inAttempt(row.fetchedAt),'declared contact module redirect')
 }else checkResponse(row,step.url,inAttempt,{javascript:true,sha256:step.sha256})
}
const clients=(proof,inAttempt)=>{
 const rows=proof?.clientResponses,profile=profiles.find(p=>p.main===rows?.[0]?.url)
 requireProof(profile&&Array.isArray(rows)&&rows.length===profile.steps.length,'declared current clients')
 rows.forEach((row,index)=>checkClientResponse(row,profile.steps[index],inAttempt))
 return rows.map(({body,...receipt})=>structuredClone(receipt))
}
const publisherDocument=(html,mountId,mainBody=null)=>{
 requireProof(typeof html==='string'&&Buffer.byteLength(html)<=4*1024*1024&&!hasClientDocumentBase(html),'publisher HTML or document base')
 const document=readNativeDocument(html),visible=readVisibleNativeDocument(html,{strict:true})
 const all=document.nodes(n=>n.tag==='root')[0]
 const ids=[];const walk=n=>{if(typeof n!=='object')return;if(n.attrs?.id===mountId)ids.push(n);for(const c of n.children||[])walk(c)};walk(all)
 requireProof(ids.length===1&&visible.nodes(n=>n.attrs.id===mountId).length===1,'single active '+mountId+' mount')
 const declarations=clientScriptDeclarations(html).filter(n=>n.attrs.src&&profiles.some(p=>new URL(n.attrs.src,AURECON_CAREERS).href===p.main))
 requireProof(declarations.length===1&&declarations[0].attrs.type==='module','current declared module')
 const profile=profiles.find(p=>p.main===new URL(declarations[0].attrs.src,AURECON_CAREERS).href)
 if(mainBody!==null)requireProof(hash(mainBody)===profile.steps[0].sha256&&matchesAuthoredIntegrity({scriptIntegrity:declarations[0].attrs.integrity??''},Buffer.from(mainBody).toString('base64')),'authored main-module integrity')
 const canonical=document.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical')
 requireProof(canonical.length===1,'single canonical publisher page')
 return{document,all,canonical:canonical[0].attrs.href,profile}
}
const model=(document,id)=>{
 const all=[];const visit=n=>{if(typeof n!=='object')return;if(n.attrs?.id===id)all.push(n);for(const c of n.children||[])visit(c)}
 visit(document.nodes(n=>n.tag==='root')[0])
 const parents=document.nodes(n=>n.attrs.id===id)
 requireProof(all.length===1&&parents.length===1,'single native '+id+' model')
 const scripts=parents[0].children.filter(n=>typeof n==='object'&&n.tag==='script')
 requireProof(scripts.length===1&&scripts[0].attrs.type==='application/json'&&!scripts[0].attrs.src&&typeof scripts[0].raw==='string','native JSON script')
 let value;try{value=JSON.parse(scripts[0].raw)}catch{requireProof(false,'malformed native JSON')}
 requireProof(value&&typeof value==='object'&&!Array.isArray(value),'native model object')
 return value
}

// This qualifies each next asset before it is requested. It does not grant an
// inventory proof; the complete attempt/receipt validator still runs below.
export function nextAureconClientRequest(corporateResponse,clientResponses=[]){
 checkResponse(corporateResponse,AURECON_CAREERS,()=>true)
 const d=publisherDocument(corporateResponse.body,'subpage',clientResponses[0]?.body??null),steps=d.profile.steps
 requireProof(d.canonical===AURECON_CAREERS&&Array.isArray(clientResponses)&&clientResponses.length<=steps.length,'current careers client request chain')
 clientResponses.forEach((row,index)=>checkClientResponse(row,steps[index],()=>true))
 return steps[clientResponses.length]?.url??null
}

// Pinned programs were inspected as data: header-links-data -> HeaderLinks ->
// unrestricted LinkList/PageLink -> Url; CONTACT_US lazy import -> native JSON
// ContactCards -> ContactUsTabs.TabID + RelatedLocations.ID.Guid country filter.
// No downloaded program is evaluated, imported or called.
export function currentAureconCorporateReceipt({officialCareersUrl,boardUrl,response,html,renderProof,now=Date.now()}){
 requireProof(officialCareersUrl===AURECON_CAREERS&&boardUrl===AURECON_BOARD,'exact source careers and board')
 const inAttempt=clocks(renderProof,now),clientReceipts=clients(renderProof,inAttempt)
 requireProof(response?.ok===true&&response.status===200&&response.url===AURECON_CAREERS
  &&/^(?:text\/html|application\/xhtml\+xml)(?:\s*;|$)/i.test(response.headers?.get?.('content-type')||''),'current corporate response')
 const d=publisherDocument(html,'subpage',renderProof.clientResponses[0].body);requireProof(d.canonical===AURECON_CAREERS,'corporate canonical')
 const m=model(d.document,'header-links-data'),links=[]
 requireProof(Array.isArray(m.HeaderLinks),'header navigation')
 for(const top of m.HeaderLinks){
  if(top.ItemName!=='Careers'||top.ItemLinkUrl!=='/careers'||!Array.isArray(top.RestrictLocation)||top.RestrictLocation.length)continue
  for(const group of top.SecondaryLinks||[]){
   if(group.Type!=='LinkList'||!Array.isArray(group.RestrictLocation)||group.RestrictLocation.length)continue
   for(const link of group.TertiaryLinks1||[]){
    if(link.Type==='PageLink'&&link.MenuTitle==='Search all jobs'&&link.Url===BOARD_KEY&&link.BlockLinkUrl===BOARD_KEY&&link.BlockLink?.Url===BOARD_KEY
     &&Array.isArray(link.RestrictLocation)&&!link.RestrictLocation.length&&Array.isArray(link.RelatedLocations)&&!link.RelatedLocations.length)links.push(link)
   }
  }
 }
 requireProof(links.length===1,'unrestricted native careers handoff')
 return{requestedUrl:AURECON_CAREERS,responseUrl:AURECON_CAREERS,status:200,contentType:response.headers.get('content-type'),board:BOARD_KEY,
  anchorUrl:links[0].Url,sha256:hash(html),fetchedAt:new Date(now).toISOString(),bindingMethod:'reviewed-aurecon-header-model',syntheticAnchor:false,
  nativeModel:'header-links-data.HeaderLinks',nativeLink:structuredClone(links[0]),clientReceipts}
}

export function validateAureconWorksiteProof(input,{source,baseUrl,jobsApiUrl,officialCareersUrl,countryProof,now=Date.now()}){
 requireProof(countryProof===true&&input.version==='aurecon-native-worksites-v2'&&source==='aurecon'&&input.source===source
  &&baseUrl===AURECON_BOARD&&input.boardUrl===baseUrl&&jobsApiUrl===AURECON_API&&input.jobsApiUrl===jobsApiUrl
  &&officialCareersUrl===AURECON_CAREERS&&input.officialCareersUrl===officialCareersUrl&&input.directoryUrl===AURECON_CONTACT,'exact source/API and proof mode')
 const inAttempt=clocks(input,now);clients(input,inAttempt)
 checkResponse(input.corporateResponse,AURECON_CAREERS,inAttempt)
 const corporateRenderProof={attemptStartedAt:input.attemptStartedAt,attemptDeadlineAt:input.attemptDeadlineAt,verifiedAt:input.verifiedAt,clientResponses:structuredClone(input.clientResponses)}
 const corporateReceipt=currentAureconCorporateReceipt({officialCareersUrl,boardUrl:baseUrl,html:input.corporateResponse.body,
  response:{ok:true,status:200,url:AURECON_CAREERS,headers:new Headers({'content-type':input.corporateResponse.contentType})},renderProof:corporateRenderProof,now})
 requireProof(Array.isArray(input.contactSnapshots)&&input.contactSnapshots.length===2,'two original whole contact models')
 const snapshots=input.contactSnapshots.map(row=>{
  checkResponse(row,AURECON_CONTACT,inAttempt)
  const d=publisherDocument(row.body,'contact-page',input.clientResponses[0].body);requireProof(d.canonical===AURECON_CONTACT,'contact canonical')
  const nativeModel=model(d.document,'contact-page-data')
  requireProof(Array.isArray(nativeModel.ContactCards)&&nativeModel.ContactCards.length<=1000&&Array.isArray(nativeModel.LocationsTags)
   &&nativeModel.LocationsTags.length<=250&&Array.isArray(nativeModel.Tabs),'whole native cards, countries and tabs')
  const offices=nativeModel.Tabs.filter(t=>t.TabID==='Offices'&&t.TabName==='Offices'&&t.TabType==='TabWithContacts'&&guid(t.ID))
  requireProof(offices.length===1,'native Offices tab')
  const tags=new Map()
  for(const tag of nativeModel.LocationsTags){const id=guid(tag.ID);requireProof(id&&!tags.has(id),'unique native country tag');tags.set(id,tag)}
  const records=[]
  for(const card of nativeModel.ContactCards){
   if(typeof card?.LocationName!=='string'||!Array.isArray(card.ContactUsTabs)
    ||!card.ContactUsTabs.some(t=>t.TabID==='Offices'&&t.TabName==='Offices'&&guid(t.ID)===guid(offices[0].ID)))continue
   const publisherLabel=card.LocationName.trim(),label=publisherLabel.replace(/ office$/i,'')
   if(!label||label===publisherLabel||/\b(?:remote|hybrid|global|worldwide|anywhere|unknown|multiple|various)\b|[;/|+&]/i.test(label))continue
   const relations=Array.isArray(card.RelatedLocations)?card.RelatedLocations:[],relation=relations.length===1?relations[0]:null
   const countryTag=relation&&tags.get(guid(relation.ID)),descriptor=countryTag?.TagName,code=countryCode(descriptor)
   const country=code&&[relation.Name,countryTag.Name,countryTag.DisplayName].every(v=>countryCode(v)===code)?{descriptor,alpha2Code:code}:null
   records.push({label,publisherLabel,publisherCardId:null,derivedCardFingerprint:jsonHash(card),country,
    countryRelation:structuredClone(relations),countryTag:countryTag?structuredClone(countryTag):null,nativeCard:structuredClone(card),sourceUrl:AURECON_CONTACT})
  }
  return{url:AURECON_CONTACT,status:200,sha256:row.sha256,fetchedAt:row.fetchedAt,reportedTotal:null,observedCardCount:nativeModel.ContactCards.length,
   nativeModelSHA256:jsonHash(nativeModel),nativeModel,records}
 })
 requireProof(Date.parse(snapshots[0].fetchedAt)<=Date.parse(snapshots[1].fetchedAt),'snapshot order')
 const byLabel=new Map(),group=s=>{const result=new Map();for(const r of s.records){const k=key(r.label),rows=result.get(k)||[];rows.push(r);result.set(k,rows)}return result}
 const first=group(snapshots[0]),last=group(snapshots[1])
 for(const[label,records]of first){
  const closing=last.get(label)
  if(records.length!==1||closing?.length!==1||!records[0].country||!closing[0].country||jsonHash(records)!==jsonHash(closing))continue
  const r=records[0]
  byLabel.set(label,{label:r.label,country:structuredClone(r.country),scope:r.country.alpha2Code==='IN'?'india':'foreign',directoryUrl:AURECON_CONTACT,
   worksiteIds:null,worksiteRecords:structuredClone(records),snapshots:snapshots.map(({nativeModel,records,...receipt})=>structuredClone(receipt))})
 }
 return{source,jobsApiUrl,boardUrl:baseUrl,directoryUrl:AURECON_CONTACT,corporateReceipt,corporateRenderProof,verifiedAt:input.verifiedAt,snapshots,byLabel}
}
