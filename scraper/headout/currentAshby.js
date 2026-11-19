import {createHash} from 'node:crypto'
import {activeHead,readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {createPublishingGapAtsScraper} from '../../scraper-support/utils/publishingGapAts.js'
import {attachInventoryEvidence,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

export const CURRENT_HEADOUT_CLIENT='https://assets.headout.com/hobrandpages/_next/static/chunks/app/careers/page-ca49d493ce1106d7.js'
const ROUTE_CLIENT='https://assets.headout.com/hobrandpages/_next/static/chunks/14738-819489188d7a4ba4.js'
const CAREERS='https://www.headout.com/careers/',PUBLISHER='https://www.headout.com/brand-pages/api/open-roles/',NATIVE='https://api.ashbyhq.com/posting-api/job-board/headout'
const sha=value=>createHash('sha256').update(value).digest('hex')
const need=(ok,message)=>{if(!ok)throw Error('Headout current Ashby: '+message)}
const canonical=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item)
const normalized=rows=>canonical([...rows].sort((a,b)=>String(a.id??a.url).localeCompare(String(b.id??b.url))))
const declaration=html=>{
 const doc=readNativeDocument(html)
 need(activeHead(html).titles.some(t=>t==='Careers at Headout — Help the world head out')
  &&doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'&&n.attrs.href===CAREERS).length===1,'current official careers identity changed')
 for(const url of [CURRENT_HEADOUT_CLIENT,ROUTE_CLIENT])need(doc.nodes(n=>n.tag==='script'&&n.attrs.src===url
  &&!Object.hasOwn(n.attrs,'nomodule')&&['','module','text/javascript','application/javascript'].includes(n.attrs.type||'')).length===1,'current advertised jobs client handoff changed')
}
const roles=payload=>{
 need(payload&&canonical(Object.keys(payload))===canonical(['roles'])&&Array.isArray(payload.roles)&&payload.roles.length<=2000,'publisher roles envelope changed')
 const ids=new Set()
 for(const row of payload.roles){
  need(row&&typeof row.title==='string'&&row.title.trim()&&typeof row.team==='string'&&Array.isArray(row.locations)&&row.locations.length>0
   &&row.locations.every(value=>typeof value==='string'&&value.trim())&&typeof row.employmentType==='string'
   &&(row.workplaceType===null||typeof row.workplaceType==='string')
   &&/^https:\/\/jobs\.ashbyhq\.com\/headout\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(row.url)
   &&!ids.has(row.url),'publisher role identity changed')
  ids.add(row.url)
 }
 return payload.roles
}
const reconcile=(publisher,payload)=>{
 need(Array.isArray(payload?.jobs)&&payload.jobs.length===publisher.length,'publisher and native membership conflict')
 const byUrl=new Map(payload.jobs.map(row=>[row.jobUrl,row]))
 need(byUrl.size===payload.jobs.length&&publisher.every(row=>{const native=byUrl.get(row.url)
  return native?.isListed===true&&native.title===row.title&&native.department===row.team
   &&canonical([native.location,...(native.secondaryLocations||[]).map(location=>location.location)])===canonical(row.locations)
   &&native.applyUrl===row.url+'/application'
 }),'publisher and native title, location or public identity conflict')
}
const scopedPayload=payload=>{
 const value=structuredClone(payload)
 for(const row of value.jobs){
  // This is an explicit country in this role's own location label, reconciled
  // above with the current employer publisher. Preserve the untouched producer
  // record in the audit; the postal field below is only a mapper projection.
  if(row.location==='Remote (India)'&&row.address==null&&row.secondaryLocations?.length===0
   &&[null,true].includes(row.isRemote)&&[null,'Remote'].includes(row.workplaceType)){
   row.address={postalAddress:{addressCountry:'India'}}
   row.primaryCountryScopeEvidence={country:'India',method:'same-role-native-and-official-publisher-explicit-country-location',
    nativeLocation:row.location,publisherUrl:PUBLISHER,jobId:row.id}
  }
 }
 return value
}

export async function runCurrentHeadout({careersHtml,fetchText,fetchJson,signal,maxJobs=null}){
 declaration(careersHtml)
 // The first complete program calls /api/open-roles/ through module 91408.Q;
 // the second declares that helper's exact /brand-pages prefix. Both are data.
 need(sha(await fetchText(CURRENT_HEADOUT_CLIENT))==='34afeb68012af3d67ac7deb102eee769a68859ff5a376ab7eaf05d10faf94998','unreviewed jobs client contract')
 need(sha(await fetchText(ROUTE_CLIENT))==='5e873050f8e9fd728c1a239c0a0dc32dd2c0ffc0c7e0375f3daddccc8b98952d','unreviewed publisher route client contract')
 const publisher=roles(await fetchJson(PUBLISHER,{signal})),payload=await fetchJson(NATIVE,{signal})
 reconcile(publisher,payload)
 const jobs=await createPublishingGapAtsScraper({source:'headout',companyName:'Headout',companyDomain:'headout.com',
  companyCareerPage:CAREERS,atsPlatform:'ashby',boardToken:'headout',sourceScopeComplete:false}).run({signal,
   fetchJson:async url=>{need(url===NATIVE,'unadvertised native read');return scopedPayload(payload)}})
 const closingPublisher=roles(await fetchJson(PUBLISHER,{signal})),closingNative=await fetchJson(NATIVE,{signal})
 reconcile(closingPublisher,closingNative)
 need(normalized(publisher)===normalized(closingPublisher)&&normalized(payload.jobs)===normalized(closingNative.jobs),'public roles changed during extraction')
 declaration(await fetchText(CAREERS))
 const evidence=readInventoryEvidence(jobs),audit={...jobs.nativeCollectionEvidence,nativeRecords:structuredClone(payload.jobs),nativePayload:structuredClone(payload),publisherRoles:publisher,
  publisherUrl:PUBLISHER,currentDeclaredBoard:'headout',closingReconciled:true,sourceCompanyWideScopeComplete:false,lifecycleCleanupAllowed:false}
 const selected=Number.isFinite(maxJobs)?jobs.slice(0,maxJobs):jobs
 for(const job of selected)Object.assign(job,{atsPlatform:'ashby',sourceDetailComplete:true,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,
  ...(job.sourceNativeCountryEvidence?{nativeSourceRecord:structuredClone(payload.jobs.find(row=>row.id===job.jobId))}:{})})
 Object.defineProperty(selected,'nativeCollectionEvidence',{value:audit,configurable:true})
 attachInventoryEvidence(selected,{...evidence,status:'coverage-gap',listingComplete:false,lifecycleCleanupAllowed:false,
  reason:(evidence?.reason||'')+';current-first-party-publisher-and-native-Ashby-identity-reconciled;company-scope-unproved'+(selected.length!==jobs.length?';caller-cap':'')})
 signal?.throwIfAborted();return selected
}
