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
const clients=(proof,inAttempt)=>{
 const rows=proof?.clientResponses
 requireProof(Array.isArray(rows)&&rows.length===3,'declared current clients')
 checkResponse(rows[0],AURECON_MAIN,inAttempt,{javascript:true,sha256:MAIN_SHA})
 // The original module request and its exact same-origin lower-case redirect
 // are separate receipts. Never invent an original 200 or substitute its body.
 requireProof(rows[1]?.url===AURECON_CONTACT_MODULE&&rows[1].status===301&&rows[1].location===AURECON_CONTACT_TARGET
  &&rows[1].body===null&&rows[1].sha256===null&&inAttempt(rows[1].fetchedAt),'declared contact module redirect')
 checkResponse(rows[2],AURECON_CONTACT_TARGET,inAttempt,{javascript:true,sha256:CONTACT_SHA})
 return rows.map(({body,...receipt})=>structuredClone(receipt))
}
const publisherDocument=(html,mountId,mainBody=null)=>{
 requireProof(typeof html==='string'&&Buffer.byteLength(html)<=4*1024*1024&&!hasClientDocumentBase(html),'publisher HTML or document base')
 const document=readNativeDocument(html),visible=readVisibleNativeDocument(html,{strict:true})
 const all=document.nodes(n=>n.tag==='root')[0]
 const ids=[];const walk=n=>{if(typeof n!=='object')return;if(n.attrs?.id===mountId)ids.push(n);for(const c of n.children||[])walk(c)};walk(all)
 requireProof(ids.length===1&&visible.nodes(n=>n.attrs.id===mountId).length===1,'single active '+mountId+' mount')
 const declarations=clientScriptDeclarations(html).filter(n=>n.attrs.src&&new URL(n.attrs.src,AURECON_CAREERS).href===AURECON_MAIN)
 requireProof(declarations.length===1&&declarations[0].attrs.type==='module','current declared module')
 if(mainBody!==null)requireProof(matchesAuthoredIntegrity({scriptIntegrity:declarations[0].attrs.integrity??''},Buffer.from(mainBody).toString('base64')),'authored main-module integrity')
 const canonical=document.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical')
 requireProof(canonical.length===1,'single canonical publisher page')
 return{document,all,canonical:canonical[0].attrs.href}
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
 const d=publisherDocument(corporateResponse.body,'subpage',clientResponses[0]?.body??null)
 requireProof(d.canonical===AURECON_CAREERS&&Array.isArray(clientResponses)&&clientResponses.length<=3,'current careers client request chain')
 if(!clientResponses.length)return AURECON_MAIN
 checkResponse(clientResponses[0],AURECON_MAIN,()=>true,{javascript:true,sha256:MAIN_SHA})
 if(clientResponses.length===1)return AURECON_CONTACT_MODULE
 const redirect=clientResponses[1]
 requireProof(redirect?.url===AURECON_CONTACT_MODULE&&redirect.status===301&&redirect.location===AURECON_CONTACT_TARGET
  &&redirect.body===null&&redirect.sha256===null,'original current module redirect before target request')
 if(clientResponses.length===2)return AURECON_CONTACT_TARGET
 checkResponse(clientResponses[2],AURECON_CONTACT_TARGET,()=>true,{javascript:true,sha256:CONTACT_SHA})
 return null
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
