import {readFileSync}from'node:fs'
import {createHash}from'node:crypto'
import {isDeepStrictEqual}from'node:util'
import {parse}from'acorn'
import {activeHead,readNativeDocument}from'../../scraper-support/utils/activeNativeHtml.js'
import {readLiteralFlightRecords}from'../../scraper-support/utils/kulaFlight.js'
import {attachInventoryEvidence}from'../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence}from'../../scraper-support/utils/sourceObservationEvidence.js'
import {currentAmeyoTransport}from'./currentTransport20261117.js'
import {nativeCountryName}from'../../scraper-support/shared/nativeJobPosting.js'
const profiles=['./currentProfile20261117.json','./currentProfile20261120.json','./currentProfile20261125.json'].map(path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8')))
const sha=s=>createHash('sha256').update(s).digest('hex'),equal=isDeepStrictEqual
const check=(ok,message)=>{if(!ok)throw Object.assign(Error('Ameyo current native contract: '+message),{abortRetries:true,failureKind:'parser_or_contract_error',sourceScopeComplete:false,lifecycleCleanupAllowed:false})}
const one=(rows,label)=>{check(rows.length===1,'unique '+label);return rows[0]}
function literal(node,state={nodes:0},depth=0){
 check(++state.nodes<=15000&&depth<=8,'typed native SDK data bound')
 if(node.type==='Literal'){check(node.value===null||['string','number','boolean'].includes(typeof node.value),'closed native scalar');return node.value}
 if(node.type==='ArrayExpression'){check(node.elements.length<=200&&!node.elements.includes(null),'closed native array');return node.elements.map(n=>literal(n,state,depth+1))}
 check(node.type==='ObjectExpression'&&node.properties.length<=32,'closed native object');const out={},keys=new Set()
 for(const p of node.properties){check(p.type==='Property'&&!p.method&&!p.computed&&!p.shorthand&&p.kind==='init','literal native property');const key=p.key.type==='Identifier'?p.key.name:p.key.value
  check(typeof key==='string'&&!['__proto__','prototype','constructor'].includes(key)&&!keys.has(key),'unique safe native key');keys.add(key);out[key]=literal(p.value,state,depth+1)}
 return out
}
function sdk(source,profile){
 const ast=parse(source,{ecmaVersion:'latest'}),calls=[]
 const walk=n=>{if(!n||typeof n!=='object')return;if(n.type==='NewExpression'&&n.callee?.name==='Rbox')calls.push(n)
  for(const value of Object.values(n))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value)}
 walk(ast);const call=one(calls,'direct native Rbox constructor');check(call.arguments.length===2&&call.arguments.every(n=>n.type==='ArrayExpression'),'native constructor arguments')
 const [metadata,groups]=call.arguments.map(n=>literal(n));let skeleton=source
 for(const[index,n]of call.arguments.map((n,index)=>[index,n]).reverse())skeleton=skeleton.slice(0,n.start)+(index===0?'<NATIVE-OPENINGS>':'<NATIVE-GROUPS>')+skeleton.slice(n.end)
 check(sha(skeleton)===profile.sdkAPI.programSkeletonSHA256,'whole current SDK program profile changed')
 check(metadata.length>0&&metadata.length<=100&&groups.length>0&&groups.length<=20,'bounded native inventory/groups')
 const ids=new Set(),grouped=new Set()
 for(const row of metadata){check(row&&Number.isSafeInteger(row.id)&&row.id>0&&!ids.has(row.id)&&typeof row.title==='string'&&row.title.trim()
  &&typeof row.company_name==='string'&&row.company_name.trim()&&row.location&&typeof row.location==='object'&&!Array.isArray(row.location),'native metadata identity/employer/workplace');ids.add(row.id)}
 for(const group of groups){check(equal(Object.keys(group).sort(),['display_text','openings'])&&typeof group.display_text==='string'&&Array.isArray(group.openings),'native group model')
  for(const id of group.openings){check(ids.has(id)&&!grouped.has(id)&&metadata.find(row=>row.id===id).team===group.display_text,'complete native group membership');grouped.add(id)}}
 check(ids.size===grouped.size,'whole native groups cover every row')
 return{metadata,groups,programSkeletonSHA256:sha(skeleton)}
}
function careers(html,profile){
 check(equal(activeHead(html).titles,['Careers | Exotel']),'current careers title')
 const records=readLiteralFlightRecords(html),imports=[...records].filter(([,r])=>r.raw.startsWith('I')&&JSON.parse(r.raw.slice(1))[0]===profile.module.id)
 const[key]=one(imports,'current Recruiterbox module declaration'),refs=[]
 const walk=value=>{if(!value||typeof value!=='object')return;if(Array.isArray(value)&&value[0]==='$'&&value[1]==='$L'+key)refs.push(value[3]);Object.values(value).forEach(walk)}
 for(const record of records.values())walk(record.value)
 check(refs.length===1&&equal(refs[0],profile.module.props),'active current native tenant handoff')
}
export async function runCurrentAmeyo(options={}){
 options.signal?.throwIfAborted()
 let profile=profiles[0],selectedProfile=null
 const allowed=new Set(profiles.flatMap(profile=>[profile.primary.url,profile.product.url,profile.careers.url,...profile.assets.map(p=>p.url),profile.sdkAPI.url,profile.sdkRenderer.url,profile.nativeInventoryURL]))
 const io=currentAmeyoTransport({...options,allowedURL:url=>allowed.has(url)}),now=new Date().toISOString()
 const exact=async(entry,kind='html')=>{const p=await io.read(entry.url,kind);check(p.status===entry.status&&p.bodyBytes===entry.bytes&&p.bodySHA256===entry.sha256,'finite current original profile '+entry.url);return p}
 const round=async()=>{
  await exact(profile.primary);const product=await io.read(profile.product.url)
  const candidate=profiles.find(profile=>product.status===profile.product.status&&product.bodyBytes===profile.product.bytes&&product.bodySHA256===profile.product.sha256)
  check(candidate&&(!selectedProfile||candidate===selectedProfile),'finite current original profile '+profile.product.url)
  profile=candidate;selectedProfile=candidate;const doc=readNativeDocument(product.text)
  check(equal(activeHead(product.text).titles,['Ameyo Contact Center by Exotel'])&&doc.nodes(n=>n.tag==='a'&&n.attrs.href==='/about-us/careers/'&&doc.text(n)==='Careers').length>0,'current Ameyo product to parent careers handoff')
  const page=await exact(profile.careers);careers(page.text,profile)
  for(const asset of profile.assets)await exact(asset,'js')
  const script=await io.read(profile.sdkAPI.url,'js'),native=sdk(script.text,profile);await exact(profile.sdkRenderer,'js')
  const fullRows=(await io.read(profile.nativeInventoryURL,'json')).value
  check(Array.isArray(fullRows)&&fullRows.length===native.metadata.length,'complete native published inventory')
  const views=fullRows.map(row=>{check(row&&typeof row.description==='string'&&Array.isArray(row.application_fields)
   &&(!Object.hasOwn(row,'application_acknowledgement_enabled')||typeof row.application_acknowledgement_enabled==='boolean'),'retained full native criteria/application model')
   const{description,application_fields,application_acknowledgement_enabled,...metadata}=row;return metadata})
  check(equal(views,native.metadata),'entire declared SDK/API native metadata binding')
  return{...native,fullRows}
 }
 try{
  const opening=await round(),closing=await round();check(equal(opening,closing),'closing full native criteria/application/group model changed')
  // The actual feed employer is Exotel. A group careers handoff does not
  // establish an Ameyo relationship for any individual role, even if its JD
  // mentions the product. Retain evidence and emit no relabelled jobs.
  const jobs=[]
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:profile.careers.url,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,
   pagesFetched:io.receipts.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:now,reason:'current-parent-feed-observed;per-role-Ameyo-employer-or-product-relationship-unverified'})
  attachSourceObservationEvidence(jobs,{source:'ameyo',recordKind:'vacancy-rows',observedRecordCount:opening.fullRows.length,observedVacancyCount:opening.fullRows.length,
   sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{configurable:true,value:{...jobs.nativeCollectionEvidence,source:'ameyo',observedListingCount:opening.fullRows.length,
   candidateDetails:opening.fullRows.length,extractedDetailJobs:0,excludedDetailJobs:0,exclusions:[],
   failures:opening.fullRows.map(row=>({stage:'native-detail',id:row.id,actualEmployer:row.company_name,reason:'Ameyo-per-role-employer-or-product-relationship-unverified'})),
   nativeOpeningInventory:opening,nativeClosingInventory:closing,nativeActualEmployers:[...new Set(opening.fullRows.map(row=>row.company_name))],
   nativeDeclaredIndiaRows:opening.fullRows.filter(row=>nativeCountryName(row.location.country)==='India').length,
   nativeCountryUnqualifiedRows:opening.fullRows.filter(row=>!nativeCountryName(row.location.country)).length,
   nativeDeclaredForeignRows:opening.fullRows.filter(row=>nativeCountryName(row.location.country)&&nativeCountryName(row.location.country)!=='India').length,
   nativeFullCriteriaBodiesRetained:true,nativeApplicationFieldsRetained:true,publicEligibility:null,applicationVisited:false,
   companyGlobalTotal:null,companyIndiaTotal:null,listingPaginationComplete:true,closingInventoryMatches:true,closingFullNativeInventoryMatch:true,
   retainedResponses:io.receipts,sourceScopeComplete:false,browserEquivalenceComplete:false,lifecycleCleanupAllowed:false}})
  return jobs
 }finally{io.close()}
}
