import {parse} from 'acorn'
import {createHash} from 'node:crypto'
import {isIP} from 'node:net'
import {literalRecruitmentPageData} from './recruitmentPageData.js'
import {nativeCountryName} from '../shared/nativeJobPosting.js'
import {extractActiveDescription} from './activeNativeHtml.js'

const need=(value,message)=>{if(!value)throw Error('Jibe recruitment: '+message)}
const text=value=>typeof value==='string'?value.trim():''
const country=value=>nativeCountryName(value)||(/^IND$/i.test(text(value))?'India':null)
const verifiedClients=new Set()
// This complete current program implements the reviewed anonymous internal
// selector and searchOverride merge. Scoped portals fail closed on client drift.
const scopedClientSHA='8fa15e15e8165865026e2f5768af0160b4e1739096302d078e540131894c7f3f'

function scopeParams(config,context){
 const override=config.searchOverride
 const definitions=config.contextSettings?.contextDefinitions
 const own=Array.isArray(definitions)?definitions.filter(row=>row?.name===context):[]
 const contextual=own.some(row=>row.search&&Object.keys(row.search).length)
 if(override==null&&!contextual)return null
 need(override&&typeof override==='object'&&!Array.isArray(override),'unsupported native search override scope')
 const keys=Object.keys(override)
 if(!keys.length&&!contextual)return null
 need(keys.every(key=>key==='tags1'||key==='internal')&&keys.includes('tags1'),'unsupported native search override scope')
 need(typeof override.tags1==='string'&&override.tags1.length>0&&override.tags1.length<=200
  &&override.tags1===override.tags1.trim()&&!/[\x00-\x1f\x7f|]/.test(override.tags1),'unsupported native hierarchy scope')
 need(!Object.hasOwn(override,'internal')||override.internal===false||override.internal==='false','unsupported internal publication scope')
 need(context&&own.length===1&&own[0].search&&Object.keys(own[0].search).length===1
  &&own[0].search.tags1===override.tags1,'native context and hierarchy scope disagree')
 need(config.searchListingOverride==null,'unsupported native listing scope override')
 return {internal:'false',tags1:override.tags1}
}

// Account, public-search configuration and the client URL all come from this
// current publisher's active document. Historical guessed API/tenant URLs do
// not participate in the binding.
export function declaredJibeSearch(document,pageURL){
 const account=literalRecruitmentPageData(document,'_jibe')?.config
 if(!account)return null
 const config=literalRecruitmentPageData(document,'searchConfig')?.config
 if(!config)return null
 need(/^[a-z\d_-]{2,100}$/i.test(account.cid||''),'invalid native account')
 need(config.externalSearch===true&&config.isLoggedIn===false,'native search is not an anonymous public portal')
 need((config.jobDescriptionAtsOverride==null||config.jobDescriptionAtsOverride===false)&&config.useCustomJDUrl!==true,'unsupported external description route')
 need(/^\/(?:[a-z\d_-]+\/)*jobs\/?$/i.test(config.path||'')&&config.path.length<=200,'invalid declared public search path')
 need(/^[a-z]{2}-[a-z]{2}$/i.test(config.locale||''),'invalid native search locale')
 need(Number.isSafeInteger(config.numRowsPerPage)&&config.numRowsPerPage>0&&config.numRowsPerPage<=100,'invalid native page size')
 const context=config.contextSettings?.currentContext||''
 need(typeof context==='string'&&/^[a-z\d_-]{0,100}$/i.test(context),'unsupported native site context')
 const page=new URL(pageURL),searchPageURL=new URL(config.path,page.origin).href
 const clients=document.nodes(n=>n.tag==='script'&&n.attrs.src&&/^(?:|module|(?:application|text)\/(?:java|ecma)script)$/i.test(n.attrs.type||''))
  .map(n=>{try{return new URL(n.attrs.src,page)}catch{return null}}).filter(u=>u?.protocol==='https:'&&u.hostname==='app.jibecdn.com'
   &&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash&&/^\/prod\/search\/\d+\.\d+\.\d+\/main\.js$/.test(u.pathname))
 need(clients.length<=1,'ambiguous current public search client')
 const mandatoryParams=scopeParams(config,context)
 return {origin:page.origin,pageURL,searchPageURL,clientURL:clients[0]?.href||null,cid:account.cid,locale:config.locale,
  pageSize:config.numRowsPerPage,context,rolePrefix:(context?'/'+context:'')+'/jobs/',
  ...(mandatoryParams?{mandatoryParams}:{})}
}

function verifyPublicClient(script,mandatoryParams){
 need(typeof script==='string'&&script.length<=1.5e6,'public search client size bound')
 const digest=createHash('sha256').update(script).digest('hex')
 if(mandatoryParams)need(digest===scopedClientSHA,'current scoped public client program changed')
 if(verifiedClients.has(digest))return
 const stack=[parse(script,{ecmaVersion:'latest'})];let search=false,role=false,detail=false,nodes=0
 while(stack.length){
  const node=stack.pop()
  if(!node||typeof node!=='object')continue
  need(++nodes<=300000,'public client node bound')
  const callee=node.type==='CallExpression'?node.callee:null
  if(callee?.type==='MemberExpression'&&!callee.computed&&callee.property?.name==='get'
   &&callee.object?.type==='MemberExpression'&&!callee.object.computed&&callee.object.property?.name==='http'
   &&callee.object.object?.type==='ThisExpression'){
   const arg=node.arguments[0]
   if(arg?.type==='Literal'&&arg.value==='/api/jobs')search=true
   const variants=arg?.type==='ConditionalExpression'?[arg.consequent,arg.alternate]:[arg]
   if(variants.some(value=>value?.type==='TemplateLiteral'&&value.expressions.length===2
    &&['api/jobs/','/api/jobs/'].includes(value.quasis[0]?.value.cooked)
    &&value.quasis[1]?.value.cooked==='/'&&value.quasis[2]?.value.cooked===''))detail=true
  }
  if(node.type==='TemplateLiteral'&&node.quasis[0]?.value.cooked==='/jobs/'&&node.quasis[1]?.value.cooked==='?lang='
   &&node.expressions[0]?.type==='MemberExpression'&&!node.expressions[0].computed&&node.expressions[0].property?.name==='slug')role=true
  for(const [key,value]of Object.entries(node))if(!['start','end'].includes(key)){
   if(Array.isArray(value))stack.push(...value.filter(v=>v&&typeof v==='object'))
   else if(value&&typeof value==='object')stack.push(value)
  }
 }
 need(search&&role&&detail,'current client does not declare the public GET search, detail and role routes')
 verifiedClients.add(digest)
}

function nativeQualification(data,cid,mandatoryParams){
 const accounts=[data.client_code,data.meta_data?.client_code].filter(value=>value!=null)
 if(!accounts.length||accounts.some(value=>value!==cid))return 'native-jibe-account-unqualified'
 if(data.internal!==false||data.searchable!==true||data.applyable!==true
  ||Object.hasOwn(data.meta_data?.icims||{},'jps_is_public')&&data.meta_data.icims.jps_is_public!==true)
  return 'native-jibe-publication-scope-unqualified'
 if(mandatoryParams&&(!Array.isArray(data.tags1)||data.tags1.length!==1||data.tags1[0]!==mandatoryParams.tags1))
  return 'native-jibe-context-scope-unqualified'
 if([data.country,data.country_code].some(value=>value!=null&&typeof value!=='string'))return 'native-location-scope-unresolved'
 const countries=[data.country,data.country_code].filter(value=>value!=null&&text(value))
 const resolved=countries.map(country)
 if(!countries.length||resolved.some(value=>!value)||new Set(resolved).size!==1)return 'native-location-scope-unresolved'
 return resolved[0]==='India'?null:'native-jibe-foreign-country'
}

function publicApplication(value,data){
 let url
 try{url=new URL(value)}catch{return null}
 if(url.protocol!=='https:'||url.username||url.password||url.port||isIP(url.hostname)
  ||/^(?:localhost|\[)|\.(?:localhost|local|internal)$/i.test(url.hostname)||!url.hostname.includes('.'))return null
 if(/(?:^|\.)icims\.com$/i.test(url.hostname)){
  const match=/^\/jobs\/([^/]+)\/login\/?$/i.exec(url.pathname)
  if(!match||![data.slug,text(data.req_id)].includes(match[1]))return null
 }
 return url
}

export async function readJibeRecruitment(search,io){
 need(search.clientURL,'current search client is absent')
 const mandatoryParams=search.mandatoryParams?{...search.mandatoryParams}:null
 if(mandatoryParams)need(Object.keys(mandatoryParams).length===2&&mandatoryParams.internal==='false'
  &&typeof mandatoryParams.tags1==='string'&&mandatoryParams.tags1.length>0&&mandatoryParams.tags1.length<=200
  &&mandatoryParams.tags1===mandatoryParams.tags1.trim()&&!/[\x00-\x1f\x7f|]/.test(mandatoryParams.tags1),'invalid mandatory native search scope')
 io.permit(search.clientURL)
 verifyPublicClient((await io.readRenderer(search.clientURL)).html,mandatoryParams)
 const endpoint=search.origin+'/api/jobs',limit=Math.min(search.pageSize,20),seen=new Map()
 io.permit(endpoint)
 let total=null,inspected=0,heldContexts=0
 for(let page=1;page<=io.maxPages&&io.canRead();page++){
  const url=new URL(endpoint)
  for(const [name,value]of Object.entries({lang:search.locale,country:'India',limit,page,...mandatoryParams}))url.searchParams.set(name,String(value))
  const payload=await io.readJson(url.href)
  need(payload&&Array.isArray(payload.jobs)&&Number.isSafeInteger(payload.totalCount)&&payload.totalCount>=0&&!payload.error
   &&payload.jobs.length<=limit&&payload.jobs.length<=payload.totalCount,'invalid native public search envelope')
  if(payload.count!=null)need(payload.count===payload.totalCount,'native inventory counters conflict')
  if(total===null)total=payload.totalCount
  need(payload.totalCount===total,'native total changed during pagination')
  const inventory={kind:'jibe',surface:search.pageURL,cid:search.cid,candidateSearch:'India',reportedTotal:total,page,observedCandidates:payload.jobs.length}
  io.inventoryRead(inventory)
  const holdContext=(reason,row,detail=null)=>{
   need(heldContexts<Math.min(io.maxDetails,80),'native context hold budget exhausted')
   heldContexts++
   ;(inventory.heldNativeRows??=[]).push({reason,nativeRow:structuredClone(row),nativeDetail:detail==null?null:structuredClone(detail),
    mandatoryParams:{...mandatoryParams},context:search.context})
   if(heldContexts>=Math.min(io.maxDetails,80)&&seen.size<total){io.unresolved('native-context-hold-budget-reached');return true}
   return false
  }
  let repeated=false
  for(const row of payload.jobs){
   const data=row?.data
   need(data&&typeof data==='object'&&!Array.isArray(data)&&text(data.req_id)&&text(data.req_id).length<=160
    &&/^[a-z\d_-]{1,128}$/i.test(data.slug||'')&&text(data.title),'native public role identity is missing')
   const id=text(data.req_id),identity=JSON.stringify({slug:data.slug,title:data.title,country:data.country,country_code:data.country_code})
   if(seen.has(id)){need(seen.get(id)===identity,'native repeated role identity conflicts');repeated=true;io.unresolved('native-jibe-pagination-repeated-role');continue}
   seen.set(id,identity);io.recordRead(data)
   const listingProblem=nativeQualification(data,search.cid,mandatoryParams)
   if(listingProblem){
    if(listingProblem!=='native-jibe-foreign-country')io.unresolved(listingProblem)
    if(listingProblem==='native-jibe-context-scope-unqualified'&&holdContext(listingProblem,row))return
    continue
   }
   if(inspected>=io.maxDetails||!io.canRead()){io.unresolved('native-detail-budget-reached');break}
   inspected++
   if(!/^[a-z]{2}-[a-z]{2}$/i.test(data.language||'')){io.unresolved('native-jibe-public-role-language-unqualified');continue}
   const detailURL=endpoint+'/'+encodeURIComponent(data.slug)+'/'+encodeURIComponent(data.language)
   io.permit(detailURL)
   let detail
   try{detail=await io.readJson(detailURL)}catch(error){
    io.problem('native-jibe-public-detail',error)
    io.unresolved('native-jibe-public-detail-unavailable')
    if(/(?:HTTP\s*|status\s*[:=]?\s*)(?:401|403|429|451)\b|access denied|origin denied/i.test(String(error.message||error)))return
    continue
   }
   if(!detail||typeof detail!=='object'||Array.isArray(detail)||text(detail.req_id)!==id||detail.slug!==data.slug
    ||text(detail.title)!==text(data.title)||detail.language!==data.language){io.unresolved('native-jibe-detail-identity-unqualified');continue}
   const detailProblem=nativeQualification(detail,search.cid,mandatoryParams)
   if(detailProblem){
    io.unresolved(detailProblem)
    if(detailProblem==='native-jibe-context-scope-unqualified'&&holdContext(detailProblem,row,detail))return
    continue
   }
   if(!text(data.hiring_organization)||text(data.hiring_organization)!==text(detail.hiring_organization)){
    io.unresolved('native-jibe-detail-employer-unqualified');continue
   }
   const description=[detail.description,detail.responsibilities,detail.qualifications,detail.preferred_qualifications]
    .filter(value=>typeof value==='string'&&value.trim()).join('\n')
   if(!extractActiveDescription(description)||extractActiveDescription(description).length<100){io.unresolved('native-full-description-unavailable');continue}
   const publicURL=new URL(search.rolePrefix+encodeURIComponent(data.slug),search.origin)
   publicURL.searchParams.set('lang',data.language)
   const applyURL=publicApplication(text(detail.apply_url),detail)
   if(!applyURL||text(data.apply_url)!==applyURL.href){io.unresolved('native-public-application-url-unqualified');continue}
   io.permit(publicURL.href)
   io.addJob({id,title:detail.title,url:publicURL.href,applyURL:applyURL.href,
    employer:{name:detail.hiring_organization.trim()},description,
    location:[detail.city,detail.state,'India'].filter(Boolean).join(', '),posted:detail.posted_date,closing:detail.posting_expiry_date,
    employmentType:detail.employment_type,record:{nativeRepresentation:'jibe-public-api',row,detail,
     nativeAccount:{cid:search.cid,searchPageURL:search.pageURL,clientURL:search.clientURL,
      ...(mandatoryParams?{context:search.context,mandatoryParams:{...mandatoryParams}}:{})},publicRoleURL:publicURL.href,nativeApplyURL:applyURL.href}})
  }
  if(inspected>=io.maxDetails&&seen.size<total)io.unresolved('native-detail-budget-reached')
  if(repeated||inspected>=io.maxDetails||seen.size===total)return
  need(payload.jobs.length>0&&seen.size<total,'native pagination ended without reconciling its total')
 }
 if(total!=null&&seen.size<total)io.unresolved('native-listing-budget-reached')
}
