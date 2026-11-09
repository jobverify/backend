import {createHash} from 'node:crypto'
import {parse} from 'acorn'
import {readNativeDocument,activeIframeSources} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {hasLiteralActiveKekaConfiguration,unhandledKekaGeography} from '../../scraper-support/shared/kekaCurrentSourceScope.js'
import {nativeCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {createAvizvaPublicReader} from './publicRead.js'

export const CORPORATE_URL='https://www.avizva.com/career'
export const BOARD_URL='https://avizva.keka.com/careers/'
export const IDENTIFIER='c7623625-5a79-4737-98fd-395ae6db7a4e'
export const EMBED_URL=`${BOARD_URL}api/embedjobs/js/${IDENTIFIER}`
export const ACTIVE_URL=`${BOARD_URL}api/embedjobs/default/active/${IDENTIFIER}`
export const INFO_URL=`${BOARD_URL}api/organization/default/careerportalinfo`
export const GROUP_URL=`${BOARD_URL}api/embedjobs/grouplinkstatus/${IDENTIFIER}`
const CORPORATE_CLIENT='https://www.avizva.com/wp-content/themes/avizva/assets/js/career.js?ver=1.1'
const hash=value=>createHash('sha256').update(value).digest('hex')
const clean=value=>typeof value==='string'?value.replace(/\s+/g,' ').trim():''
const key=value=>String(value).replace(/\s+/g,'')
const ensure=(condition,message)=>{if(!condition)throw Error('AVIZVA '+message)}
const detailURL=id=>BOARD_URL+'jobdetails/'+id
const classes=(node,value)=>(node.attrs.class||'').split(/\s+/).includes(value)
const rootText=doc=>doc.text(doc.nodes(node=>node.tag==='root')[0])
const plain=html=>rootText(readVisibleNativeDocument(html,{strict:true}))

const hiringURL=value=>{
 if(typeof value!=='string'||!value.trim())return false
 try{
  const url=new URL(value,CORPORATE_URL)
  return /(?:^|\.)(?:ashbyhq\.com|greenhouse\.io|lever\.co|myworkdayjobs\.com|smartrecruiters\.com|darwinbox\.com|keka\.com|zohorecruit\.(?:com|in))$/i.test(url.hostname)
   ||/(?:^|\/)(?:careers?|jobs?|openings?)(?:\/|$)/i.test(url.pathname)
 }catch{return false}
}
function typedPostingCount(doc){
 let count=doc.nodes(node=>String(node.attrs.itemtype||'').split(/\s+/).some(type=>/^https?:\/\/schema\.org\/JobPosting$/i.test(type))).length
 for(const script of doc.nodes(node=>node.tag==='script'&&node.attrs.type?.trim().toLowerCase()==='application/ld+json')){
  let value
  try{value=JSON.parse(script.raw||'')}catch{
   if(/"@type"\s*:\s*(?:"JobPosting"|\[[^\]]*"JobPosting")/i.test(script.raw||''))count++
   continue
  }
  const pending=[value]
  while(pending.length){
   const item=pending.pop()
   if(Array.isArray(item)){pending.push(...item);continue}
   if(!item||typeof item!=='object')continue
   const types=Array.isArray(item['@type'])?item['@type']:[item['@type']]
   if(types.includes('JobPosting'))count++
   if(item['@graph'])pending.push(item['@graph'])
  }
 }
 return count
}

export function currentCorporate(html){
 const doc=readVisibleNativeDocument(String(html),{strict:true})
 const links=doc.nodes(node=>node.tag==='a'&&node.attrs.href).map(node=>({href:node.attrs.href.trim(),text:doc.text(node)}))
 const roleLinks=links.filter(link=>/^https:\/\/avizva\.keka\.com\/careers\/jobdetails\/[1-9]\d*$/.test(link.href)&&/^Apply Now$/i.test(link.text))
 const titles=doc.nodes(node=>node.tag==='title').map(node=>clean(node.raw))
 const official=titles.length===1&&/^(?:Careers at AVIZVA\s*\||Avizva Careers\s*\|)/i.test(titles[0])
  &&doc.nodes(node=>node.tag==='h1'&&doc.text(node)==='We Aim, Learn, and Grow Each Day with Passion and Purpose').length===1
  &&roleLinks.length>0
 const ids=roleLinks.map(link=>link.href.split('/').at(-1)).sort()
 const additional=links.filter(link=>{
  if([CORPORATE_URL,'https://www.avizva.com/'].includes(link.href)||link.href.startsWith('#')||/^mailto:/i.test(link.href)||roleLinks.includes(link))return false
  return /Apply Now|View (?:all )?(?:jobs|openings)|Open (?:roles|positions)/i.test(link.text)
   ||/(?:ashbyhq|greenhouse|lever|myworkdayjobs|smartrecruiters|darwinbox|keka|zohorecruit)\./i.test(link.href)
   ||/linkedin\.com\/jobs\//i.test(link.href)
 })
 const client=doc.nodes(node=>node.tag==='script'&&node.attrs.id==='career-js').map(node=>node.attrs.src)
 const typedCarriers=typedPostingCount(doc)+doc.frames().filter(frame=>hiringURL(frame.attrs.src||'')
  ||frame.attrs.srcdoc&&typedPostingCount(readVisibleNativeDocument(frame.attrs.srcdoc,{strict:true}))>0).length
 return{official,ids,additional,typedCarriers,client,html}
}

export const hasCurrentOfficialCareersSignal=html=>{
 try{return currentCorporate(html).official}catch{return false}
}

// The shell's top-level fetch expression is parsed as data. A fetch string in
// comments, a template, a function body or an inert script cannot delegate jobs.
function portalDocument(html){
 const doc=readNativeDocument(html),paths=[]
 for(const node of doc.nodes(node=>node.tag==='script'&&!node.attrs.src&&(!node.attrs.type||/^(?:text|application)\/(?:java|ecma)script$/i.test(node.attrs.type)))){
  let program
  try{program=parse(node.raw||'',{ecmaVersion:'latest'})}catch{continue}
  for(const statement of program.body){
   if(statement.type!=='ExpressionStatement')continue
   let expression=statement.expression
   while(expression?.type==='CallExpression'&&expression.callee?.type==='MemberExpression')expression=expression.callee.object
   if(expression?.type==='CallExpression'&&expression.callee.type==='Identifier'&&expression.callee.name==='fetch'
    &&expression.arguments.length===1&&expression.arguments[0].type==='Literal'&&typeof expression.arguments[0].value==='string')paths.push(expression.arguments[0].value)
  }
 }
 ensure(paths.length===1,'native portal document declaration changed')
 const url=new URL(paths[0],BOARD_URL)
 ensure(url.origin==='https://avizva.keka.com'&&!url.search&&!url.hash&&new RegExp(`^/ats/documents/${IDENTIFIER}/careerportal/[a-f0-9]+\\.html$`).test(url.pathname),'native portal document identity changed')
 return url.href
}

function validateInfo(info){
 ensure(info&&typeof info==='object'&&!Array.isArray(info)&&info.name==='AVIZVA'&&info.shortName==='AVIZVA'
  &&info.careersPortalDomain==='avizva.keka.com'&&info.companyWebsite==='https://www.avizva.com/','native account identity changed')
 return info
}

const ownLocationCountry=location=>{
 if(!location||typeof location!=='object'||Array.isArray(location))return null
 const code=nativeCountryName(location.countryCode),name=nativeCountryName(location.countryName)
 if(location.countryCode!=null&&location.countryCode!==''&&!code||location.countryName!=null&&location.countryName!==''&&!name
  ||!code&&!name||code&&name&&code!==name)return null
 return code||name
}

function parseInventory(payload,observedAt){
 ensure(Array.isArray(payload)&&payload.length<=40,'native inventory must be a bounded complete array')
 const seen=new Set()
 return payload.map(row=>{
  const id=String(row?.id??'')
  ensure(/^[1-9]\d*$/.test(id)&&Number.isSafeInteger(Number(id))&&!seen.has(id)&&clean(row?.title),'native inventory has invalid/duplicate identity')
  seen.add(id)
  ensure(Array.isArray(row.jobLocations)&&row.jobLocations.length<=32,'native inventory has malformed locations')
  const countries=[],unknown=unhandledKekaGeography(row)
  for(const location of row.jobLocations){
   if(!location||typeof location!=='object'||Array.isArray(location)){unknown.push('invalid-location');continue}
   const country=ownLocationCountry(location)
   if(!country)
    unknown.push('unresolved-or-conflicting-native-country')
   else countries.push(country)
  }
  if(!row.jobLocations.length)unknown.push('no-native-country-locations')
  // A valid own India worksite remains independent proof when a different
  // worksite is unresolved. A conflicting code/name within the same worksite
  // never entered countries and therefore cannot supply that proof.
  const country=countries.includes('India')?'India':unknown.length?null:new Set(countries).size===1?countries[0]:null
  const description=typeof row.description==='string'?row.description:null
  const descriptionText=description?plain(description):''
  const validDescription=descriptionText.length>200&&/Job Responsibilities/i.test(descriptionText)&&/Skills\s*&\s*Qualifications/i.test(descriptionText)
  const published=typeof row.publishedOn==='string'?row.publishedOn:null
  const parsedDate=published&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(published)&&Number.isFinite(Date.parse(published))
   &&new Date(published).toISOString()===published&&Date.parse(published)<=Date.parse(observedAt)?published:null
  return{jobId:id,title:clean(row.title),country,sourceCountryScopeUnresolved:unknown.length>0||country===null,
   nativeCountries:countries,nativeCountryUnresolvedFields:unknown,sourceRawDescription:description,
   jobDescriptionText:descriptionText,sourceDetailComplete:validDescription,sourcePostedDateRaw:row.publishedOn??null,
   postingDate:parsedDate,sourcePostingDateUnresolved:published!==null&&!parsedDate,nativeSourceRecord:structuredClone(row)}
 })
}

function verifyRole(html,observation){
 const doc=readVisibleNativeDocument(html,{strict:true})
 const titles=doc.nodes(node=>node.tag==='h1').map(node=>doc.text(node))
 const descriptions=doc.nodes(node=>classes(node,'job-description-container')).map(node=>doc.text(node))
 const root=doc.nodes(node=>node.tag==='root')[0],parents=new Map()
 const walk=node=>{for(const child of node.children||[])if(typeof child!=='string'){parents.set(child,node);walk(child)}}
 walk(root)
 const locationIcons=doc.nodes(node=>node.tag==='span'&&classes(node,'ki-location'))
 const labels=locationIcons.map(node=>doc.text(parents.get(node)))
 const expected=observation.nativeSourceRecord.jobLocations.map(place=>clean(place?.name)||clean(place?.city)).join(', ')
 return titles.length===1&&titles[0]===observation.title&&descriptions.length===1
  &&observation.sourceDetailComplete&&key(descriptions[0])===key(observation.jobDescriptionText)
  &&labels.length===1&&labels[0]===expected&&!/The Job posting is not available anymore/i.test(rootText(doc))
}
const explicitlyClosed=html=>{
 const doc=readVisibleNativeDocument(html,{strict:true})
 return doc.nodes(node=>node.tag==='p'&&doc.text(node)==='The Job posting is not available anymore').length===1
  &&doc.nodes(node=>node.attrs.id==='all-jobs').length===1&&doc.nodes(node=>classes(node,'job-description-container')).length===0
}

export async function collectCurrentAvizva(options={}){
 options.signal?.throwIfAborted()
 ensure(!options.fetchText||options.fetchImpl,'card-only text injection cannot verify the current native inventory; provide fetchImpl')
 const observedAt=new Date((options.now||(()=>new Date().toISOString()))()).toISOString()
 const cap=options.maxJobs??null
 ensure(cap===null||Number.isSafeInteger(cap)&&cap>=0,'invalid result limit')
 const allowed=new Set([CORPORATE_URL,BOARD_URL,EMBED_URL,ACTIVE_URL,INFO_URL,GROUP_URL,CORPORATE_CLIENT])
 const io=createAvizvaPublicReader(options,url=>allowed.has(url))
 const gaps=new Set(),closedIDs=[],detailReads=[]
 let native=[],openingPayload,firstParty=false
 const evidence=options.evidence||{}
 Object.assign(evidence,{scope:'configured-public-board',companyGlobalTotal:null,companyIndiaTotal:null,nativeObservations:[],failures:[]})
 const context=async()=>{
  const corporate=currentCorporate(await io.read(CORPORATE_URL))
  ensure(corporate.official,'careers page no longer matches the verified first-party surface')
  ensure(new Set(corporate.ids).size===corporate.ids.length&&corporate.ids.length<=16,'corporate role handoffs are ambiguous or exceed bounds')
  corporate.ids.forEach(id=>allowed.add(detailURL(id)))
  if(corporate.additional.length)gaps.add('additional-current-corporate-hiring-handoff')
  if(corporate.typedCarriers)gaps.add('additional-current-corporate-typed-hiring-carrier')
  if(corporate.client.length!==1||corporate.client[0]!==CORPORATE_CLIENT)gaps.add('corporate-jobs-client-unqualified')
  else if(hash(await io.read(CORPORATE_CLIENT,'js'))!=='ca3ae152497d2aaf73fa57dafeaa5f7217100f7dd6ada429aa8bdfdfe98420f5')gaps.add('corporate-jobs-client-changed')
  const shell=await io.read(BOARD_URL),documentURL=portalDocument(shell)
  allowed.add(documentURL)
  const template=await io.read(documentURL)
  ensure(hasLiteralActiveKekaConfiguration(template,{identifier:IDENTIFIER,kekaRootUrl:BOARD_URL}),'native literal tenant configuration changed')
  const templateDoc=readNativeDocument(template)
  ensure(templateDoc.nodes(node=>node.tag==='script'&&node.attrs.src===EMBED_URL).length===1
   &&templateDoc.nodes(node=>node.attrs.id==='khembedjobs').length===1,'native renderer handoff changed')
  if(templateDoc.nodes(node=>['a','area'].includes(node.tag)&&node.attrs.href&&node.attrs.href!=='https://www.avizva.com/').length
   ||templateDoc.nodes(node=>['form','base'].includes(node.tag)).length||activeIframeSources(template).length)
   gaps.add('additional-active-native-hiring-handoff')
  const templateScripts=templateDoc.nodes(node=>node.tag==='script')
  const reviewedInline=new Set(['265d294208ded381db2fb918b77888a75eeb95feb824ac22bdfc924d6052ef1a',
   '45d274b6cd549c34ae5a740344d2e736c799b105003ce29421e494e8ba549691'])
  if(templateScripts.length!==3||templateScripts.some(node=>node.attrs.src?node.attrs.src!==EMBED_URL:!reviewedInline.has(hash(node.raw||''))))
   gaps.add('unreviewed-native-template-program')
  // Both exact renderers were reviewed statically: the default active endpoint
  // returns the full array, with no server pagination. The 2026-11-07 program
  // changes only one separator literal from a misencoded dash to an em dash.
  const reviewedRenderers=new Set([
   'b283162bf07a7e4b5940e4e612004cee5f64e7fbfd341d806f7c87e6b14c9120',
   '176878893ddcd1a0dabb3b84d1c8a98bde7c16c6ace1af2871db06c741fa022b',
  ])
  ensure(reviewedRenderers.has(hash(await io.read(EMBED_URL,'js'))),'native renderer contract changed')
  const info=validateInfo(await io.read(INFO_URL,'json'))
  const group=await io.read(GROUP_URL,'json')
  ensure(group&&Object.keys(group).length===1&&group.isGroupLinked===false,'native grouped inventory requires separate reconciliation')
  firstParty=true
  return{corporate,documentURL,info}
 }
 const inspect=async(observations,phase)=>{
  for(const observation of observations){
   const url=detailURL(observation.jobId);allowed.add(url)
   try{
    const html=await io.read(url),valid=verifyRole(html,observation)
    detailReads.push({jobId:observation.jobId,phase,valid,html})
    if(!valid){observation.sourceDetailComplete=false;gaps.add('native-detail-unqualified:'+observation.jobId)}
   }catch(error){io.check();if([401,403,429,451].includes(error?.status))throw error
    observation.sourceDetailComplete=false;gaps.add('native-detail-unavailable:'+observation.jobId)
    evidence.failures.push({stage:'native-detail',jobId:observation.jobId,message:error?.message||'native-detail-failure'})}
  }
 }
 try{
  const opening=await context()
  openingPayload=await io.read(ACTIVE_URL,'json');native=parseInventory(openingPayload,observedAt)
  const activeIds=new Set(native.map(row=>row.jobId))
  for(const id of opening.corporate.ids.filter(id=>!activeIds.has(id))){
   if(explicitlyClosed(await io.read(detailURL(id))))closedIDs.push(id)
   else gaps.add('corporate-native-active-set-mismatch:'+id)
  }
  await inspect(native,'opening')
  const closing=await context()
  if(JSON.stringify(opening.corporate.ids)!==JSON.stringify(closing.corporate.ids)||opening.documentURL!==closing.documentURL
   ||JSON.stringify(opening.info)!==JSON.stringify(closing.info))gaps.add('closing-native-context-changed')
  const closingPayload=await io.read(ACTIVE_URL,'json')
  parseInventory(closingPayload,observedAt)
  if(JSON.stringify(openingPayload)!==JSON.stringify(closingPayload)){
   gaps.add('closing-native-inventory-changed')
   for(const row of native)if(!closingPayload.some(closingRow=>String(closingRow.id)===row.jobId&&JSON.stringify(closingRow)===JSON.stringify(row.nativeSourceRecord)))
    row.sourceDetailComplete=false
  }
  await inspect(native,'closing')
  for(const id of closedIDs)if(!explicitlyClosed(await io.read(detailURL(id))))gaps.add('closing-native-closed-role-changed:'+id)
  for(const row of native){
   if(row.sourceCountryScopeUnresolved)gaps.add('native-country-unresolved:'+row.jobId)
   if(!row.sourceDetailComplete)gaps.add('native-criteria-incomplete:'+row.jobId)
   if(row.sourcePostingDateUnresolved)gaps.add('native-publication-unresolved:'+row.jobId)
  }
  if(cap!==null)gaps.add('caller-result-limit')
  io.check()
  const complete=gaps.size===0,observations=native.map(row=>({...row,sourceUrl:detailURL(row.jobId),
   jobDescription:row.sourceRawDescription,sourceDescription:row.sourceRawDescription,sourceListingComplete:complete}))
  Object.assign(evidence,{firstPartyConfirmed:firstParty,sourceClock:observedAt,sourceScopeComplete:complete,
   configuredPublicBoardComplete:complete,companyGlobalTotal:null,companyIndiaTotal:null,
   observedNativeRecords:native.length,observedNativeIndiaRecords:native.filter(row=>row.country==='India').length,
   nativeObservations:observations,openingNativePayload:openingPayload,closingNativePayload:closingPayload,
   nativeDetailReads:detailReads,closedCorporateIDs:closedIDs,retainedResponses:io.receipts,reasons:[...gaps],lifecycleCleanupAllowed:complete})
  let jobs=native.filter(row=>row.sourceDetailComplete&&(row.country==='India'||row.sourceCountryScopeUnresolved)).map(row=>{
   const raw=row.nativeSourceRecord,places=raw.jobLocations.filter(place=>place&&typeof place==='object'&&!Array.isArray(place)
    &&(row.country===null||ownLocationCountry(place)==='India'))
   const labels=places.map(place=>[clean(place.name)||clean(place.city),clean(place.state),row.country].filter(Boolean).join(', '))
   return{...row,company:'AVIZVA',source:'avizva',companyCareerPage:CORPORATE_URL,companyDomain:'avizva.com',atsPlatform:'keka',
    requisitionId:clean(raw.jobNumber)||null,legalEmployer:null,firstEverPublication:null,
    location:labels.join(' / ')||null,locations:labels,city:places.length===1?(clean(places[0].name)||clean(places[0].city)||null):null,
    state:places.length===1?clean(places[0].state)||null:null,nativeCountryLocations:structuredClone(raw.jobLocations),
    sourceUrl:detailURL(row.jobId),applyUrl:detailURL(row.jobId),link:detailURL(row.jobId),applicationVisited:false,
    applicationLinkSource:'native-public-role-page',jobDescription:row.sourceRawDescription,sourceDescription:row.sourceRawDescription,
    department:clean(raw.departmentName)||null,experienceRequired:clean(raw.experience)||null,
    employmentType:raw.jobType===2?'Full Time':raw.jobType===1?'Part Time':null,sourceNativeJobType:raw.jobType??null,
    requiredSkills:Array.isArray(raw.skillNames)?structuredClone(raw.skillNames):[],postedAt:row.postingDate,closingDate:null,
    sourceDatePrecision:row.postingDate?'millisecond':null,sourceDetailComplete:true,sourceListingComplete:complete,
    sourceScopeComplete:complete,sourceScope:'configured-public-board',sourceClosingQualified:complete,
    lifecycleCleanupAllowed:complete,scrapedAt:observedAt}
  }).sort((a,b)=>a.title.localeCompare(b.title))
  if(cap!==null)jobs=jobs.slice(0,cap)
  Object.defineProperty(jobs,Symbol.for('jobverify.verified-recruitment-observations'),{value:evidence})
  attachSourceObservationEvidence(jobs,{source:'avizva',recordKind:'vacancy-rows',observedRecordCount:native.length,
   observedVacancyCount:native.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  const output=attachInventoryEvidence(jobs,{status:complete?(native.length?'complete-inventory':'verified-empty'):'coverage-gap',surface:BOARD_URL,
   firstParty,listingComplete:complete,pagesFetched:io.receipts.length,reportedTotal:complete?native.length:null,
   indiaFacetCount:complete?native.filter(row=>row.country==='India').length:null,verifiedAt:observedAt,
   reason:complete?'configured-public-board-reconciled;company-wide-totals-unknown':[...gaps].join(';')})
  io.check()
  return output
 }finally{io.close()}
}
