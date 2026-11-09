import {readNativeDocument} from '../../utils/activeNativeHtml.js'
import {requireNative,geography} from '../declaredJobFeeds/nativeData.js'
import {countryName} from '../jobPostingData.js'
const activeScript=node=>node.tag==='script'&&!Object.hasOwn(node.attrs,'nomodule')
 &&['','module','text/javascript','application/javascript'].includes((node.attrs.type||'').trim().toLowerCase())
const original=page=>page?.usable&&page.transportQualified&&typeof page.bodyBase64==='string'&&typeof page.originalText==='string'
export const currentNuxtRoutes=async(profile,pages,load,allowedURLs,result)=>{
 const declaration=profile.declaration,router=declaration.router,assets=[],routes=[]
 requireNative(pages.length===declaration.routes.length,'current native route chain changed')
 let routerPage
 for(const [index,page]of pages.entries()){
  const route=declaration.routes[index],doc=readNativeDocument(page.originalText),url=new URL(page.url)
  requireNative(url.pathname===route.path,'current native route path changed')
  requireNative(doc.nodes(n=>activeScript(n)&&n.attrs.src===router.scriptSpecifier).length===1,'active current native router changed')
  requireNative(doc.nodes(n=>n.tag==='link'&&(n.attrs.rel||'').split(/\s+/).includes('modulepreload')&&n.attrs.href===route.componentSpecifier).length===1,'current route component preload changed')
  const target=doc.nodes(n=>n.attrs.id===declaration.targetId)
  requireNative(target.length===1&&doc.nodes(n=>n.tag==='a'&&n.attrs.href==='#'+declaration.targetId).length>0,'current active native target/handoff changed')
  if(!routerPage){allowedURLs.add(router.scriptURL);routerPage=await load(router.scriptURL);assets.push(routerPage)}
  requireNative(original(routerPage)&&routerPage.bodySHA256===router.scriptSHA256,'current original router bytes changed')
  const name=new URL(route.scriptURL).pathname.split('/').at(-1)
  requireNative(routerPage.originalText.includes('name:`'+route.name+'`,path:`'+route.path+'`,component:()=>q(()=>import(`./'+name+'`)'),'current router/component ownership changed')
  allowedURLs.add(route.scriptURL);const component=await load(route.scriptURL);assets.push(component)
  requireNative(original(component)&&component.bodySHA256===route.scriptSHA256,'current original route component changed')
  requireNative(component.originalText.includes('accountName:`'+declaration.accountName+'`')&&component.originalText.includes(declaration.embed.scriptURL),'current route native account/embed declaration changed')
  routes.push({url:page.url,path:route.path,originalTargetAttributes:{...target[0].attrs},routerSHA256:routerPage.bodySHA256,componentSHA256:component.bodySHA256,nativeAccount:declaration.accountName})
 }
 allowedURLs.add(declaration.embed.scriptURL);const embed=await load(declaration.embed.scriptURL)
 result.originalNativeEmbedAsset=embed;result.nativeEmbedAssetAvailable=Boolean(original(embed))
 result.nativeEmbedRecordedBytesMatch=Boolean(original(embed)&&embed.bodySHA256===declaration.embed.scriptSHA256)
 result.originalNativeRouteAssets=assets;result.originalCurrentNativeRoutes=routes
 return true
}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const errorValue=value=>Array.isArray(value)?value.length>0:value&&typeof value==='object'?Object.keys(value).length>0:Boolean(value)
export const collectionEnvelopeError=value=>{
 if(!value||typeof value!=='object'||Array.isArray(value))return false
 if(errorValue(value.error)||errorValue(value.errors)||[value.ok,value.success].some(flag=>[false,0,'false','0'].includes(flag)))return true
 if(value.meta!=null){if(typeof value.meta!=='object'||Array.isArray(value.meta))return true;return collectionEnvelopeError(value.meta)}
 return false
}
export const groupedPostDeclarations=payload=>{
 const declarations={},titles=new Set();let complete=Array.isArray(payload)
 for(const group of Array.isArray(payload)?payload:[]){
  if(typeof group?.title!=='string'||!group.title||titles.has(group.title)||!Array.isArray(group.postings)||collectionEnvelopeError(group))complete=false
  titles.add(group?.title)
  for(const record of Array.isArray(group?.postings)?group.postings:[]){
   if(!uuid.test(record?.id)){complete=false;continue}
   if(declarations[record.id])complete=false
   ;(declarations[record.id]||=[]).push({groupTitle:group.title,originalRecord:record})
  }
 }
 return {declarations,complete}
}

const label=value=>typeof value==='string'?value.replace(/\s+/g,' ').trim():''
const specificWorksite=value=>{
 const name=label(value).replace(/[_-]+/g,' ')
 return Boolean(name)&&!(/\b(?:remote|global|worldwide|anywhere)\b/i.test(name)
  ||/^(?:hq(?: office)?|headquarters|head office|(?:main|corporate|regional) (?:office|hq|headquarters)|(?:unspecified|unknown|not specified|not available|not provided)(?: (?:worksites?|locations?))?|(?:worksite|location) (?:unspecified|unknown)|(?:multiple|various|all)(?: (?:worksites?|locations?|offices?|countries|regions))?|tbd|to be (?:determined|confirmed)|n[ /]*a|none|not applicable|international|apac|emea|amer|latam|anz(?: region)?)$/i.test(name))
}
export const corroborateCurrentWorksites=(profile,result,observations,history)=>{
 const current=result.nativePostIds.map(id=>observations.get(id)).filter(job=>job?.sourceNativePhase===result.phase&&job.sourceNativeDetailQualified)
 const index=new Map()
 for(const job of current){
  const record=job.sourceNativeRecord,name=label(record?.categories?.location),code=record?.country
  if(job.sourceNativeCountryConflict||!specificWorksite(name)||typeof code!=='string'||!/^[A-Z]{2}$/.test(code)||!countryName(code))continue
  const key=name.toLowerCase();if(!index.has(key))index.set(key,new Map())
  const countries=index.get(key);if(!countries.has(code))countries.set(code,[])
  countries.get(code).push(job.jobId)
 }
 for(const job of current){
  const record=job.sourceNativeRecord,schema=structuredClone(job.sourceNativeJobPosting),corroborations=[]
  const places=Array.isArray(schema.jobLocation)?schema.jobLocation:schema.jobLocation?[schema.jobLocation]:[]
  for(const name of record.categories?.allLocations||[]){
   if(label(name).toLowerCase()===label(record.categories?.location).toLowerCase())continue
   const countries=index.get(label(name).toLowerCase());if(!countries||countries.size!==1)continue
   const [code,ids]=[...countries][0]
   const matches=places.filter(place=>label((place.address?.postalAddress||place.address)?.addressLocality).toLowerCase()===label(name).toLowerCase())
   if(matches.some(place=>(place.address?.postalAddress||place.address).addressCountry!=null))continue
   if(matches.length){for(const place of matches)(place.address?.postalAddress||place.address).addressCountry=code}
   else places.push({'@type':'Place',address:{'@type':'PostalAddress',addressLocality:name,addressCountry:code}})
   corroborations.push({location:name,country:countryName(code),countryCode:code,nativePostingIds:[...ids]})
  }
  job.sourceNativeLocationCountryCorroborations=corroborations
  if(corroborations.length){
   schema.jobLocation=places;Object.assign(job,geography(profile,record,schema))
   job.sourceCurrentNativeRoleQualified=job.sourceCurrentNativePostingIdentityQualified&&!job.sourceNativeCountryConflict
  }
  const row=history.find(row=>row.id===job.jobId)
  if(row)row.current=structuredClone(job)
 }
}
