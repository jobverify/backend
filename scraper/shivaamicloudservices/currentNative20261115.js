import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {types} from 'node:util'
import {setTimeout as delay} from 'node:timers/promises'
import {parse} from 'acorn'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {normalizeNativeAttributeBoundaries} from '../../scraper-support/utils/nativeHtmlAttributes.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const legacyProfile=JSON.parse(readFileSync(new URL('./currentScope20261115.json',import.meta.url),'utf8'))
const reviewedProfiles=[legacyProfile,JSON.parse(readFileSync(new URL('./currentScope20261121.json',import.meta.url),'utf8'))]
const SOURCE='shivaamicloudservices',COMPANY='Shivaami Cloud Services',sha=value=>createHash('sha256').update(value).digest('hex')
const problem=message=>Object.assign(Error('Shivaami current native: '+message),{softFailure:true,abortRetries:true,failureKind:'coverage_gap',sourceScopeComplete:false,lifecycleCleanupAllowed:false})
const need=(value,message)=>{if(!value)throw problem(message)}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const one=(values,label)=>{need(values.length===1,'missing or ambiguous '+label);return values[0]}
const key=node=>node?.type==='Identifier'?node.name:node?.type==='Literal'?node.value:null
const program=source=>{try{return parse(source,{ecmaVersion:'latest',sourceType:'module'})}catch{throw problem('unreviewed native program syntax')}}
function nativeArrays(source,profile){
 const ast=program(source),declarations=ast.body.filter(n=>n.type==='VariableDeclaration').flatMap(n=>n.declarations)
 const read=(name,allowed)=>{
  const array=one(declarations.filter(n=>n.id.type==='Identifier'&&n.id.name===name),'native '+name+' declaration').init
  need(array?.type==='ArrayExpression'&&array.elements.length===4,'changed native '+name+' membership; empty is not zero evidence')
  return array.elements.map(node=>{
   need(node?.type==='ObjectExpression'&&node.properties.every(p=>p.type==='Property'&&!p.computed&&!p.method&&p.kind==='init'),'unreviewed native object properties')
   const names=node.properties.map(p=>key(p.key));need(names.length===allowed.length&&new Set(names).size===names.length&&names.every(k=>allowed.includes(k)),'duplicate, additional or omitted native field')
   return Object.fromEntries(node.properties.map(p=>{
    if(key(p.key)==='icon'){need(p.value.type==='Identifier','unreviewed native benefit icon');return['iconReference',p.value.name]}
    need(p.value.type==='Literal'&&typeof p.value.value==='string'&&p.value.value.trim(),'native criterion is not an original literal')
    return[key(p.key),p.value.value]
   }))
  })
 }
 const roles=read(profile.nativeRoleArray,['title','experience','location','description']),benefits=read(profile.nativeBenefitsArray,['icon','title','description'])
 need(new Set(roles.map(r=>r.title)).size===roles.length&&roles.every(r=>r.description.length>=150),'ambiguous native profile identity or incomplete original description')
 return{roles,benefits,imports:ast.body.filter(n=>n.type==='ImportDeclaration').map(n=>new URL(n.source.value,profile.careersURL).href)}
}

export async function runCurrentShivaami(options={}){
 need(!(options.fetchText||options.fetchPage||options.fetchJson)||options.fetchImpl,'original HTTP metadata required; body-only overrides cannot qualify native inventory')
 options.signal?.throwIfAborted()
 const observedAt=typeof options.now==='function'?options.now():options.now??new Date().toISOString();need(Number.isFinite(Date.parse(observedAt)),'invalid observation clock')
 const duration=options.sourceDeadlineMs??85000,interval=options.requestIntervalMs??500
 need(Number.isSafeInteger(duration)&&duration>0&&duration<=85000,'invalid source deadline')
 need(Number.isSafeInteger(interval)&&interval>=0&&interval<=60000&&(interval>=500||options.fetchImpl),'invalid native host pacing')
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(problem('source deadline exceeded')),duration)
 const signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal,fetchImpl=options.fetchImpl||globalThis.fetch
 const receipts=[],lastReads=new Map(),allowed=new Set([legacyProfile.home,legacyProfile.board]);let reads=0,total=0,profile=null
 const read=async url=>{
  signal.throwIfAborted();need(allowed.has(url)&&(!profile||Object.hasOwn(profile.assets,url))&&++reads<=30,'unbound native URL or request limit')
  const origin=new URL(url).origin,wait=Math.max(0,interval-(performance.now()-(lastReads.get(origin)??-Infinity)))
  if(wait)await delay(wait,undefined,{signal});lastReads.set(origin,performance.now())
  const packet=await boundedDeclaredPublicRead(url,{signal,timeoutMs:15000,overflowError:problem('native streaming byte bound'),fetchImpl:async(value,init)=>{
   const response=await fetchImpl(value,{...init,cache:'no-store',credentials:'omit'});let bytes=0
   const body=response.body===null?null:{cancel:reason=>response.body.cancel(reason),getReader(){const reader=response.body.getReader();return{
    async read(){const part=await reader.read();if(!part.done){need(types.isUint8Array(part.value),'native chunk must be bytes');need(part.value.byteLength<=4000000-bytes&&part.value.byteLength<=16000000-total,'native streaming byte bound');bytes+=part.value.byteLength;total+=part.value.byteLength}return part},
    cancel:reason=>reader.cancel(reason),releaseLock:()=>reader.releaseLock()}}}
   return{status:response.status,url:response.url,headers:response.headers,body}
  }})
  const bytes=Buffer.from(packet.bodyBase64,'base64'),digest=sha(bytes)
  receipts.push({requestedURL:url,...packet,bodySHA256:digest})
  need(packet.status===200&&packet.url===url,'native HTTP status or final URL changed')
  // Select one exact private deployment from the first whole homepage. Keep
  // that cohort fixed for all role, dependency, stylesheet and closing reads.
  if(!profile)profile=one(reviewedProfiles.filter(candidate=>candidate.home===url&&candidate.board===legacyProfile.board&&candidate.assets[url]?.bytes===bytes.length&&candidate.assets[url]?.sha256===digest),'reviewed coherent native deployment')
  const expected=profile.assets[url]
  need((packet.headers['content-type']||'').split(';')[0].trim().toLowerCase()===expected.mime,'native response MIME changed')
  need(bytes.length===expected.bytes&&digest===expected.sha256,'whole current native document/program/style changed')
  try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{throw problem('invalid native UTF-8')}
 }
 const pass=async()=>{
  const home=await read(legacyProfile.home)
  const pages=new Map([[profile.home,home],[profile.board,await read(profile.board)]]),html=pages.get(profile.board)
  const doc=readNativeDocument(normalizeNativeAttributeBoundaries(html)),entries=doc.nodes(n=>n.tag==='script'&&n.attrs.type==='module'&&n.attrs.src)
  const entry=one(entries,'active own module entry');need(new URL(entry.attrs.src,profile.board).href===profile.mainURL,'current own module declaration changed')
  need(doc.nodes(n=>n.tag==='div'&&n.attrs.id==='root').length===1&&!doc.nodes(n=>n.tag==='base').length,'own native mount/base changed')
  allowed.add(profile.mainURL);const main=await read(profile.mainURL);pages.set(profile.mainURL,main)
  const careerRelative=new URL(profile.careersURL).pathname.split('/').at(-1)
  need(main.includes('import("./'+careerRelative+'")')&&main.includes('path:"/careers"')&&main.includes(' Shivaami Cloud Services. All rights reserved.'),'own active native careers route or employer declaration changed')
  allowed.add(profile.careersURL);const career=await read(profile.careersURL);pages.set(profile.careersURL,career)
  const models=nativeArrays(career,profile);need(same(models.imports,profile.careerImports),'native complete controller imports changed')
  const styles=doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='stylesheet').map(n=>new URL(n.attrs.href,profile.board).href)
  for(const url of[...new Set([...models.imports,...styles])]){
   need(Object.hasOwn(profile.assets,url),'unreviewed declared native import or style');allowed.add(url)
   if(!pages.has(url))pages.set(url,await read(url))
  }
  need(pages.size===Object.keys(profile.assets).length,'native whole active dependency cohort changed')
  return models
 }
 try{
  const opening=await pass(),closing=await pass();need(same(opening,closing),'closing full role/country/common hiring criteria changed');signal.throwIfAborted()
  const holds=opening.roles.filter(r=>r.location!=='Mumbai, India').map(r=>({title:r.title,reason:'native-work-country-unresolved',originalNativeRole:r}))
  const selected=opening.roles.filter(r=>r.location==='Mumbai, India')
  const jobs=selected.map(role=>{
   const description=role.description+'\nExperience: '+role.experience+'\n'+role.location+'\n\nWhy Join Shivaami?\n'+opening.benefits.map(b=>b.title+'\n'+b.description).join('\n\n')
   return{source:SOURCE,company:COMPANY,title:role.title,jobId:null,requisitionId:null,sourceNativeIdentifier:null,sourceCanonicalRoleURL:null,
    sourceUrl:profile.board,link:profile.board,applyUrl:profile.board,country:'India',city:'Mumbai',location:role.location,employmentType:null,remoteStatus:null,
    jobDescription:description,sourceDescription:description,experienceRequired:role.experience,sourceNativeRole:structuredClone(role),sourceNativeCommonBenefits:structuredClone(opening.benefits),
    sourceNativeIdentity:{kind:'current-native-form-profile-title',value:role.title},sourceNativeEmployerBinding:{configuredCorporateHomepage:profile.home,configuredCareers:profile.board,originalCompany:COMPANY,currentOwnFooter:'Shivaami Cloud Services. All rights reserved.'},
    sourceNativeApplication:{url:profile.board,selectedProfile:role.title,selectionMethod:'current-own-Apply-Now-selects-the-same-native-role-title',submissionPerformed:false,renderedApplicationQualified:false},
    postingDate:null,firstEverPostedAt:null,closingDate:null,sourcePublicationDateUnavailable:true,sourceDetailComplete:true,sourceNativeClosingReconciled:true,
    sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,sourceRenderedApplicationQualified:false,scrapedAt:observedAt}
  })
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{source:SOURCE,originalResponses:receipts,nativeRows:opening.roles,closingNativeRows:closing.roles,commonBenefits:opening.benefits,holds,sourceScopeComplete:false,lifecycleCleanupAllowed:false,applicationSubmitted:false}})
  attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:opening.roles.length,observedVacancyCount:opening.roles.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:profile.board,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,reportedTotal:null,indiaFacetCount:null,pagesFetched:reads,verifiedAt:observedAt,reason:'current-own-native-role-models-full-common-criteria-and-form-profile-closing-reconciled;city-only-role-held;company-inventory-and-zero-unqualified'})
 }catch(error){
  if(options.signal?.aborted)throw options.signal.reason
  if(error&&typeof error==='object'&&Object.isExtensible(error))try{Object.defineProperty(error,'sourceAudit',{value:{source:SOURCE,originalResponses:receipts,sourceScopeComplete:false,lifecycleCleanupAllowed:false},enumerable:true,configurable:true})}catch{}
  throw error
 }finally{clearTimeout(timer)}
}
