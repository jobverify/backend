import {createHash} from 'node:crypto'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {visibleDocument,visibleText,normalizeText,decodeLeaf} from './nativeVisibility.js'
export const SOURCE='autoformindia',COMPANY_NAME='AutoForm India',VERIFIED_AT='2026-11-03'
export const HOMEPAGE_URL='https://www.autoform.com/en/',CAREERS_HOME_URL='https://careers.autoform.com/en/'
export const JOBS_LANDING_URL=CAREERS_HOME_URL+'jobs/',JOB_SEARCH_URL=JOBS_LANDING_URL+'job-search/',JOBS_RSS_URL=CAREERS_HOME_URL+'jobs.rss'
export const CORPORATE_RSS_URL=HOMEPAGE_URL+'jobs.rss'
const CLIENT='/typo3temp/assets/vhs/vhs-assets-career-js.js',IAS='/typo3temp/assets/vhs/vhs-assets-iasf.js'
const CLIENT_SHA='92518f46693d6bc2986a11be88b425b9f0a2192fe04a6f9931d5256b7f5a4c47'
const IAS_SHA='5df6feb6e7fff9e294311eb67f8b5d78818dd4ab971e391172f8ff450fc758fa'
const need=(ok,why)=>{if(!ok)throw Error('AutoForm native: '+why)}
const norm=normalizeText,plain=html=>visibleText(html).text||''
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b),sorted=a=>[...a].sort()
const descriptionTokens=value=>JSON.stringify(String(value||'').match(/[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu)||[])
const countryNames=new Map(),regions=new Set(['europe','north america','south america','asia & pacific','asia and pacific','apac','emea'])
const display=new Intl.DisplayNames(['en'],{type:'region'})
for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){const code=String.fromCharCode(a,b),name=display.of(code);if(name&&name!==code&&!['ZZ','EU','UN','XA','XB','QO'].includes(code)){countryNames.set(name.toLowerCase(),name);countryNames.set(code.toLowerCase(),name)}}
for(const [alias,code] of [['the netherlands','NL'],['usa','US'],['uk','GB'],['united states of america','US'],['ind','IN']])countryNames.set(alias,display.of(code))
const country=v=>typeof v==='string'?countryNames.get(norm(v).toLowerCase())||null:null
const cityKey=v=>norm(v||'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase()
const descendants=(node,p)=>typeof node==='string'?[]:[...(p(node)?[node]:[]),...node.children.flatMap(c=>typeof c==='string'?[]:descendants(c,p))]
const isClass=(n,c)=>(n.attrs.class||'').split(/\s+/).includes(c)
const url=(href,base=JOB_SEARCH_URL)=>{const u=new URL(href,base);need(u.protocol==='https:'&&!u.username&&!u.password,'unsafe native URL');return u.href}
const roleUrl=href=>{const u=new URL(url(href));need(u.origin==='https://careers.autoform.com'&&/^\/en\/jobs\/job-search\/advertisement\/[^/]+\/$/.test(u.pathname)&&!u.search&&!u.hash,'foreign native posting URL');return u.href}
const document=html=>visibleDocument(html,n=>/^jobuid(?:-single)?-\d+$/.test(n.attrs.id||'')||n.attrs.itemprop==='articleBody'||isClass(n,'jobreference'))
const htmlTag=(name,block)=>String(block).match(new RegExp('<'+name+'\\b[^>]*>([\\s\\S]*?)</'+name+'>','i'))?.[1]??null
const xmlValue=s=>String(s??'').replace(/^\s*<!\[CDATA\[([\s\S]*)\]\]>\s*$/,'$1')
export function extractRssItems(xml){
 need(/<rss\b/i.test(xml)&&/<channel\b/i.test(xml)&&/TYPO3 EXT:news/.test(xml),'unverified native RSS envelope')
 const channel=htmlTag('channel',xml)
 const items=[...String(xml).matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map(([,block])=>{
  const rawDate=norm(xmlValue(htmlTag('pubDate',block)))||null
  const date=rawDate&&/(?:[+-]\d{4}\s*$|\b(?:GMT|UTC)\b)/.test(rawDate)?Date.parse(rawDate):NaN
  return{title:norm(decodeLeaf(xmlValue(htmlTag('title',block)))),sourceUrl:roleUrl(decodeLeaf(xmlValue(htmlTag('link',block))).trim()),
   rawPublication:rawDate,postingDate:Number.isFinite(date)?new Date(date).toISOString():null,
   categories:[...block.matchAll(/<category\b[^>]*>([\s\S]*?)<\/category>/gi)].map(m=>norm(decodeLeaf(xmlValue(m[1])))),
   descriptionHtml:xmlValue(htmlTag('content:encoded',block)||htmlTag('description',block)),guid:decodeLeaf(xmlValue(htmlTag('guid',block)))||null}
 })
 need(new Set(items.map(i=>i.sourceUrl)).size===items.length&&items.every(i=>i.title),'missing/duplicate RSS identity')
 return{items,channelTitle:plain(htmlTag('title',channel)),links:[...xml.matchAll(/<link>\s*([^<]+)<\/link>/g)].map(m=>decodeLeaf(m[1].trim()))}
}
function geographicLabel(d,node){
 const wraps=descendants(node,n=>isClass(n,'nowrapping')).filter(n=>descendants(n,i=>i.tag==='i'&&/fa-map-marker/.test(i.attrs.class||'')).length)
 if(wraps.length!==1)return{country:null,city:null,raw:null,countries:[],unresolved:true}
 const wrap=wraps[0],strong=descendants(wrap,n=>n.tag==='strong').map(n=>d.text(n)),labels=strong.map(s=>norm(s).replace(/:$/,''))
 const known=labels.map(country).filter(Boolean),raw=d.text(wrap),last=strong.at(-1)||''
 const city=norm(raw.slice(raw.lastIndexOf(last)+last.length).replace(/^\s*[,;:]\s*/,''))||null
 return{country:known.at(-1)||null,city,raw,countries:[...new Set(known)],unresolved:!known.length||labels.some(l=>!country(l)&&!regions.has(l.toLowerCase()))}
}
export function parseNativeListing(html,pageUrl=JOB_SEARCH_URL){
 const d=document(html),cards=d.nodes(n=>/^jobuid-\d+$/.test(n.attrs.id||'')),issues=[]
 if(d.unresolved)issues.push('listing-visibility-unresolved')
 const records=cards.map(n=>{
  const id=n.attrs.id.slice(7),links=descendants(n,a=>a.tag==='a'&&a.attrs.href?.includes('/advertisement/'))
  need(links.length===1,'native card link identity missing/ambiguous')
  return{id,title:d.text(links[0]),sourceUrl:roleUrl(links[0].attrs.href),geography:geographicLabel(d,n)}
 })
 need(new Set(records.map(r=>r.id)).size===records.length&&new Set(records.map(r=>r.sourceUrl)).size===records.length,'duplicate native listing identity')
 const pagination=d.nodes(n=>n.tag==='ul'&&isClass(n,'pagination'))
 const next=pagination.flatMap(n=>descendants(n,l=>l.tag==='li'&&isClass(l,'next')).flatMap(n=>descendants(n,a=>a.tag==='a'&&a.attrs.href)))
 need(next.length<=1,'ambiguous native next page')
 let nextUrl=next.length?url(next[0].attrs.href,pageUrl):null
 if(nextUrl)need(new URL(nextUrl).origin==='https://careers.autoform.com'&&new URL(nextUrl).pathname===new URL(pageUrl).pathname,'foreign native pagination')
 if(!records.length&&!/no (?:current )?(?:jobs|positions|vacancies)|no suitable (?:job|position)/i.test(plain(html)))issues.push('native-empty-state-unverified')
 return{url:pageUrl,records,next:nextUrl,issues}
}
function schemaObjects(html){
 const d=document(html)
 return d.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').flatMap(n=>{const v=JSON.parse(n.raw);return Array.isArray(v)?v:v['@graph']||[v]}).filter(s=>s['@type']==='JobPosting')
}
function localRssMinute(raw){
 const t=Date.parse(raw||''),m=String(raw||'').match(/([+-])(\d{2})(\d{2})\s*$/)
 if(!Number.isFinite(t)||!m)return null
 return new Date(t+(m[1]==='-'?-1:1)*(Number(m[2])*60+Number(m[3]))*60000).toISOString().slice(0,16)
}
export function parseNativeRole(html,listing,rss,asOf=new Date().toISOString()){
 const d=document(html),issues=[]
 const posting=d.nodes(n=>n.attrs.id==='jobuid-single-'+listing.id),schemas=schemaObjects(html)
 need(posting.length===1&&schemas.length===1,'native detail identity/schema missing')
 const node=posting[0],schema=schemas[0],head=descendants(node,n=>n.tag==='h1'),article=descendants(node,n=>n.attrs.itemprop==='articleBody')
 need(head.length===1,'native title boundary missing')
 const title=d.text(head[0]),reference=descendants(node,n=>isClass(n,'jobreference'))
 need(title===listing.title&&norm(schema.title)===title&&rss?.title===title,'native posting titles differ')
 need(schema.hiringOrganization?.name&&/^AutoForm\b/.test(schema.hiringOrganization.name)&&schema.identifier?.name===schema.hiringOrganization.name,'native employer identity differs')
 const req=typeof schema.identifier?.value==='string'?norm(schema.identifier.value):null
 need(req&&reference.length===1&&d.text(reference[0]).endsWith(req),'native formal requisition differs')
 const apply=descendants(node,n=>n.tag==='a'&&n.attrs.href?.includes('/jobs/application-form/'))
 need(apply.length===1,'native public application identity missing')
 const applyUrl=url(apply[0].attrs.href),au=new URL(applyUrl)
 need(au.origin==='https://careers.autoform.com'&&au.pathname==='/en/jobs/application-form/'&&au.searchParams.get('jobid')===listing.id,'native application posting identity differs')
 const canonical=d.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical').map(n=>n.attrs.href)
 need(canonical.length<=1&&(!canonical.length||roleUrl(canonical[0])===listing.sourceUrl),'native canonical role identity differs')
 const schemaDescription=typeof schema.description==='string'?visibleText(schema.description):{text:null,unresolved:true}
 const body=article.length===1?d.text(article[0]):''
 const descriptionFormattingOnly=Boolean(body&&schemaDescription.text&&schemaDescription.text!==body&&descriptionTokens(schemaDescription.text)===descriptionTokens(body))
 if(d.unresolved||schemaDescription.unresolved||body.length<300||schemaDescription.text!==body&&!descriptionFormattingOnly)issues.push('native-description-visibility-or-schema-differs')
 const geo=geographicLabel(d,node),nativeLocations=Array.isArray(schema.jobLocation)?schema.jobLocation:schema.jobLocation==null?[]:[schema.jobLocation],addresses=nativeLocations.map(l=>l?.address)
 if(nativeLocations.some(location=>!location||typeof location!=='object'||!location.address||typeof location.address!=='object'||Array.isArray(location.address)))issues.push('native-secondary-country-unresolved')
 let conflict=Boolean(geo.country&&listing.geography.country&&geo.country!==listing.geography.country)
 if(geo.unresolved||listing.geography.unresolved||!geo.country)issues.push('native-country-unresolved')
 const rawCountries=addresses.map(a=>a?.addressCountry).filter(v=>v!=null)
 if(rawCountries.some(c=>!country(typeof c==='object'?c.name:c)))issues.push('native-schema-country-unresolved')
 const schemaCountries=rawCountries.map(c=>country(typeof c==='object'?c.name:c)).filter(Boolean)
 // A countryless primary schema address can be bound to the visible role's
 // explicit country by its matching locality. A second explicit India address
 // must not erase that primary country or be mistaken for a contradiction.
 const primaryCountryFromVisible=addresses.some(a=>!a?.addressCountry&&a?.addressLocality&&geo.city&&cityKey(a.addressLocality)===cityKey(geo.city))
 if(schemaCountries.length&&!schemaCountries.includes(geo.country)&&!primaryCountryFromVisible)conflict=true
 for(const address of addresses)if(address&&!address.addressCountry&&(!address.addressLocality||!geo.city||cityKey(address.addressLocality)!==cityKey(geo.city)))issues.push('native-secondary-country-unresolved')
 if(addresses.length===1&&addresses[0]?.addressLocality&&geo.city&&cityKey(addresses[0].addressLocality)!==cityKey(geo.city))conflict=true
 for(const address of addresses)if(address&&Object.keys(address).some(k=>/countr|geograph|region|location|latitud|longitud|coordinate/i.test(k)&&!['addressCountry','addressLocality','addressRegion'].includes(k)))issues.push('unsupported-native-address-geography')
 if(conflict)issues.push('native-country-conflict')
 const nativeCountryInterpretations=[...new Set([...(listing.geography.countries||[]),...geo.countries,...schemaCountries])]
 const nativeCountryInterpretationsComplete=!d.unresolved&&!issues.some(issue=>['native-country-unresolved','native-schema-country-unresolved','native-secondary-country-unresolved','unsupported-native-address-geography'].includes(issue))
 let postingDate=rss.postingDate
 if(schema.datePosted&&rss.rawPublication&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(schema.datePosted)&&schema.datePosted!==localRssMinute(rss.rawPublication)){issues.push('native-publication-conflict');postingDate=null}
 if(rss.rawPublication&&!postingDate)issues.push('native-rss-publication-unresolved')
 const closingDate=schema.validThrough??null
 let sourceActive=true
 if(closingDate!==null){
  const day=typeof closingDate==='string'?closingDate.slice(0,10):'',dayTime=Date.parse(day+'T00:00:00Z')
  const validDay=Number.isFinite(dayTime)&&new Date(dayTime).toISOString().slice(0,10)===day
  if(validDay&&/^\d{4}-\d{2}-\d{2}$/.test(closingDate))sourceActive=closingDate>=asOf.slice(0,10)
  else if(validDay&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/i.test(closingDate)&&Number.isFinite(Date.parse(closingDate)))sourceActive=Date.parse(closingDate)>Date.parse(asOf)
  else issues.push('native-expiry-unresolved')
 }
 const sourceCountries=conflict?[]:[...new Set([geo.country,...schemaCountries].filter(Boolean))]
 const india=sourceCountries.includes('India'),indianAddress=addresses.find(a=>country(typeof a?.addressCountry==='object'?a.addressCountry.name:a?.addressCountry)==='India')
 const selectedCountry=conflict?null:india?'India':geo.country
 const selectedCity=india&&geo.country!=='India'?indianAddress?.addressLocality??null:geo.city
 const qualification=String(schema.description||'').match(/<h[1-6]\b[^>]*>\s*(?:Your [Pp]rofile|Requirements|Qualifications)\s*<\/h[1-6]>([\s\S]*?)(?=<h[1-6]\b|$)/i)?.[1]
 return{source:SOURCE,company:schema.hiringOrganization.name,officialBrandName:'AutoForm Engineering',legalEmployer:schema.hiringOrganization.name,
  title,jobId:listing.id,nativePostingId:listing.id,requisitionId:req,sourceUrl:listing.sourceUrl,nativeSeoCanonical:canonical[0]??null,applyUrl,link:applyUrl,
  country:selectedCountry,city:selectedCity,location:selectedCity&&selectedCountry?selectedCountry+': '+selectedCity:geo.raw,
  sourceCountries,nativeListingGeography:listing.geography,nativeDetailGeography:geo,nativeSchemaAddresses:addresses,
  sourceNativeCountryInterpretations:nativeCountryInterpretations,sourceNativeCountryInterpretationsComplete:nativeCountryInterpretationsComplete,
  sourceIndiaEligibilityClosingVerified:false,sourceNativeDescriptionFormattingOnly:descriptionFormattingOnly,
  nativeSchema:schema,sourceCountryConflict:conflict,nativeGeographyComplete:!issues.some(x=>/country|geography/.test(x)),
  postingDate,sourceRssPublication:rss.rawPublication,nativeSchemaDatePosted:schema.datePosted??null,
  sourcePublicationDatePrecision:postingDate?'second':'unknown',nativeSchemaPublicationPrecision:schema.datePosted?.length===16?'local-minute-without-offset':'native-raw',
  closingDate,sourceActive,sourceClosingDateIsExact:Boolean(closingDate&&!issues.includes('native-expiry-unresolved')&&/(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(closingDate)),
  nativeEmploymentType:schema.employmentType??null,employmentType:null,
  jobDescription:body,sourceDescription:body,sourceDescriptionHtml:schema.description??null,nativeRssDescriptionHtml:rss.descriptionHtml,
  minimumQualification:qualification?plain(qualification):null,preferredQualification:null,requiredSkills:[],
  sourceDetailComplete:issues.length===0,sourceIssues:[...new Set(issues)],
  applicationVisited:false,applicationSubmitted:false}
}
const defaultPage=async(href,{signal}={})=>{const requestSignal=AbortSignal.any([AbortSignal.timeout(30000),...(signal?[signal]:[])]),r=await fetch(href,{redirect:'manual',headers:{Accept:'text/html,application/rss+xml,application/javascript'},signal:requestSignal}),body=await r.text();requestSignal.throwIfAborted();return{url:r.url||href,status:r.status,body}}
function channels(html,base){
 const d=document(html),links=d.nodes(n=>n.tag==='a'&&n.attrs.href).flatMap(n=>{try{const u=new URL(n.attrs.href,base);u.hash='';return u.protocol==='https:'?[{href:u.href,text:d.text(n)}]:[]}catch{return []}})
 const feeds=d.nodes(n=>n.tag==='link'&&n.attrs.type==='application/rss+xml').map(n=>url(n.attrs.href,base)).filter(u=>/\/jobs\.rss$/.test(u))
 const pages=links.map(l=>l.href).filter(u=>u.startsWith(JOBS_LANDING_URL)&&!u.includes('/advertisement/')&&!u.includes('/application-form/')&&!u.includes('/unsolicited-application/'))
 const external=links.filter(l=>/career|job|workday|greenhouse|ashby|jobvite|lever\.co/i.test(l.href)&&!l.href.startsWith(CAREERS_HOME_URL)&&!l.href.includes('formingworld.com/')).map(l=>l.href)
 return{pages:sorted(new Set(pages)),feeds:sorted(new Set(feeds)),external:sorted(new Set(external)),careers:links.some(l=>l.href===CAREERS_HOME_URL)}
}
const recordSignature=j=>Object.fromEntries(Object.entries(j).filter(([k])=>!['sourceListingComplete','sourceScopeComplete','lifecycleCleanupAllowed','scrapedAt','sourceClosingVerified','sourceIndiaEligibilityClosingVerified'].includes(k)))
const workplaceSignature=j=>({id:j.jobId,title:j.title,sourceUrl:j.sourceUrl,requisitionId:j.requisitionId,legalEmployer:j.legalEmployer,applyUrl:j.applyUrl,
 listing:j.nativeListingGeography,detail:j.nativeDetailGeography,schema:j.nativeSchemaAddresses,countries:j.sourceNativeCountryInterpretations,complete:j.sourceNativeCountryInterpretationsComplete})
const rssIdentity=item=>item?{sourceUrl:item.sourceUrl,title:item.title,guid:item.guid}:null
export function createAutoFormIndiaScraper({now=()=>new Date().toISOString(),maxJobs=null}={}){
 return{async run({fetchPage,fetchText,onAudit,signal:callerSignal,timeoutMs=180000}={}){
  need(Number.isSafeInteger(timeoutMs)&&timeoutMs>0,'invalid source timeout')
  const signal=AbortSignal.any([AbortSignal.timeout(timeoutMs),...(callerSignal?[callerSignal]:[])])
  const wait=value=>new Promise((resolve,reject)=>{let done=false;const finish=(fn,result)=>{if(done)return;done=true;signal.removeEventListener('abort',abort);fn(result)},abort=()=>finish(reject,signal.reason);signal.addEventListener('abort',abort,{once:true});Promise.resolve(value).then(value=>finish(resolve,value),error=>finish(reject,error));if(signal.aborted)abort()})
  const calls=[],issues=[],asOf=new Date(now()).toISOString()
  const get=async href=>{
   signal?.throwIfAborted()
   const p=await wait(Promise.resolve().then(async()=>fetchPage?fetchPage(href,{signal:callerSignal||signal}):fetchText?{status:200,url:href,body:await fetchText(href,{signal:callerSignal||signal})}:defaultPage(href,{signal})))
   signal.throwIfAborted()
   need(!p.url||p.url===href,'native response URL changed')
   calls.push({url:href,status:p.status});const body=String(p.body??p.html??'')
   if([401,403,429].includes(p.status)||/<title>\s*(?:Attention Required|Verify you are human|Just a moment)|Sorry, you have been blocked/i.test(body))throw Object.assign(Error('AutoForm access denied HTTP '+p.status),{status:p.status})
   need(p.status===200,'HTTP '+p.status+' for '+href)
   return body
  }
  const openingHome=await get(HOMEPAGE_URL),homeScope=channels(openingHome,HOMEPAGE_URL)
  need(homeScope.careers,'current corporate employer careers handoff missing')
  if(homeScope.external.length)issues.push('additional-corporate-hiring-channel')
  const careerBody=await get(CAREERS_HOME_URL),careerScope=channels(careerBody,CAREERS_HOME_URL)
  need(careerScope.pages.includes(JOB_SEARCH_URL),'current careers search handoff missing')
  if(careerScope.external.length)issues.push('additional-careers-channel')
  const pages=new Map(),pending=[...careerScope.pages]
  while(pending.length){
   const href=pending.shift();if(pages.has(href))continue
   need(pages.size<50,'native listing cycle/page limit')
   const body=await get(href),scope=channels(body,href),listing=parseNativeListing(body,href)
   pages.set(href,{body,scope,listing})
   if(listing.next&&pages.has(listing.next))issues.push('native-pagination-cycle')
   for(const next of [...scope.pages,...(listing.next?[listing.next]:[])])if(!pages.has(next))pending.push(next)
   if(scope.external.length)issues.push('additional-listing-channel')
   if(href===JOB_SEARCH_URL)issues.push(...listing.issues)
  }
  need(pages.has(JOB_SEARCH_URL),'missing full native job search')
  const main=pages.get(JOB_SEARCH_URL),allListings=[...pages.values()].flatMap(p=>p.listing.records)
  const byUrl=new Map()
  for(const row of allListings){const old=byUrl.get(row.sourceUrl);if(old&&!eq(old,row))issues.push('native-peer-card-drift');byUrl.set(row.sourceUrl,row)}
  const feeds=sorted(new Set([...homeScope.feeds,...careerScope.feeds,...[...pages.values()].flatMap(p=>p.scope.feeds)])),feedSnapshots=new Map()
  need(feeds.includes(JOBS_RSS_URL),'advertised full native RSS missing')
  for(const href of feeds){need([JOBS_RSS_URL,CORPORATE_RSS_URL].includes(href),'unrecognized advertised native feed');feedSnapshots.set(href,extractRssItems(await get(href)))}
  const rss=feedSnapshots.get(JOBS_RSS_URL),rssByUrl=new Map(rss.items.map(i=>[i.sourceUrl,i]))
  if(!eq(sorted(byUrl.keys()),sorted(rssByUrl.keys())))issues.push('native-listing-rss-identities-differ')
  if(feedSnapshots.get(CORPORATE_RSS_URL)?.items.some(r=>!rssByUrl.has(r.sourceUrl)))issues.push('additional-corporate-feed-records')
  for(const client of [CLIENT,IAS]){
   const href=new URL(client,CAREERS_HOME_URL).href
   need(main.body.includes(client),'current declared native filter client missing')
   const code=await get(href)
   if(client===CLIENT&&createHash('sha256').update(code).digest('hex')!==CLIENT_SHA)issues.push('native-filter-client-unverified')
   if(client===IAS&&createHash('sha256').update(code).digest('hex')!==IAS_SHA)issues.push('native-secondary-client-unverified')
  }
  const nativeJobs=[],indiaScopeIssues=[...issues],scopeGap=why=>{issues.push(why);indiaScopeIssues.push(why)}
  for(const row of byUrl.values()){
   const item=rssByUrl.get(row.sourceUrl)
   if(!item){scopeGap('native-role-rss-missing');continue}
   try{const job=parseNativeRole(await get(row.sourceUrl),row,item,asOf);nativeJobs.push(job);issues.push(...job.sourceIssues)}
   catch(e){signal.throwIfAborted();if([401,403,429].includes(e.status)||/access denied/.test(e.message))throw e;scopeGap('native-detail-failed:'+row.id+':'+e.message)}
  }
  if(!eq(channels(await get(HOMEPAGE_URL),HOMEPAGE_URL),homeScope)||!eq(channels(await get(CAREERS_HOME_URL),CAREERS_HOME_URL),careerScope))scopeGap('closing-corporate-handoff-drift')
  const closingByUrl=new Map(),closingRssByUrl=new Map()
  for(const [href,opening] of pages){const body=await get(href),closing=parseNativeListing(body,href);for(const row of closing.records)closingByUrl.set(row.sourceUrl,row);if(!eq(closing,opening.listing)||!eq(channels(body,href),opening.scope))scopeGap('closing-native-listing-drift')}
  for(const [href,opening] of feedSnapshots){const closing=extractRssItems(await get(href));if(href===JOBS_RSS_URL)for(const item of closing.items)closingRssByUrl.set(item.sourceUrl,item);if(!eq(closing,opening))issues.push('closing-native-feed-drift');if(!eq(closing.items.map(rssIdentity),opening.items.map(rssIdentity)))indiaScopeIssues.push('closing-native-feed-identities-drift')}
  for(const client of [CLIENT,IAS]){const code=await get(new URL(client,CAREERS_HOME_URL).href);if(createHash('sha256').update(code).digest('hex')!==(client===CLIENT?CLIENT_SHA:IAS_SHA))scopeGap('closing-native-client-drift')}
  const withdraw=(job,why)=>{issues.push(why+':'+job.jobId);job.sourceDetailComplete=false;job.sourceClosingVerified=false;job.sourceIssues=[...new Set([...job.sourceIssues,why])]}
  const closingNativeJobs=[]
  for(const opening of nativeJobs){
   try{
    const closing=parseNativeRole(await get(opening.sourceUrl),byUrl.get(opening.sourceUrl),rssByUrl.get(opening.sourceUrl),asOf)
    closingNativeJobs.push(closing)
    opening.sourceIndiaEligibilityClosingVerified=eq(workplaceSignature(opening),workplaceSignature(closing))
      &&eq(closingByUrl.get(opening.sourceUrl),byUrl.get(opening.sourceUrl))&&eq(rssIdentity(closingRssByUrl.get(opening.sourceUrl)),rssIdentity(rssByUrl.get(opening.sourceUrl)))
    if(!eq(recordSignature(closing),recordSignature(opening)))withdraw(opening,'closing-native-detail-drift')
    else if(!eq(closingByUrl.get(opening.sourceUrl),byUrl.get(opening.sourceUrl))||!eq(closingRssByUrl.get(opening.sourceUrl),rssByUrl.get(opening.sourceUrl)))withdraw(opening,'closing-native-posting-membership-or-fields-drift')
    else opening.sourceClosingVerified=true
   }catch(e){signal.throwIfAborted();if([401,403,429].includes(e.status)||/access denied/.test(e.message))throw e;withdraw(opening,'closing-native-detail-failed')}
  }
  if(nativeJobs.length!==byUrl.size)scopeGap('native-full-details-incomplete')
  const activeNative=nativeJobs.filter(j=>j.sourceActive),india=activeNative.filter(j=>j.sourceDetailComplete&&j.sourceClosingVerified&&j.sourceCountries.includes('India')),capped=Number.isInteger(maxJobs)&&maxJobs>=0&&india.length>maxJobs
  if(capped)issues.push('output-capped-after-full-native-inventory')
  const uniqueIssues=sorted(new Set(issues)),complete=uniqueIssues.length===0
  const foreign=job=>job.sourceNativeCountryInterpretationsComplete&&job.sourceNativeCountryInterpretations.length>0&&job.sourceNativeCountryInterpretations.every(country=>country!=='India')&&job.sourceIndiaEligibilityClosingVerified
  const nonIndiaExclusions=nativeJobs.filter(foreign).map(job=>({id:job.jobId,countries:job.sourceNativeCountryInterpretations,exactForeignCountryConflict:job.sourceCountryConflict,reason:'Every current same-ID native workplace interpretation is explicitly non-India; opening/closing workplace and listing/RSS identities reconcile.'}))
  const unresolvedRoles=nativeJobs.filter(job=>!foreign(job)&&!(job.sourceDetailComplete&&job.sourceClosingVerified)).map(job=>({id:job.jobId,countries:job.sourceNativeCountryInterpretations,issues:job.sourceIssues}))
  const indiaComplete=indiaScopeIssues.length===0&&unresolvedRoles.length===0&&!capped
  const jobs=(capped?india.slice(0,maxJobs):india).map(j=>({...j,sourceListingComplete:indiaComplete,sourceDeclaredIndiaInventoryComplete:indiaComplete,sourceScopeComplete:complete,lifecycleCleanupAllowed:complete,scrapedAt:asOf}))
  if(onAudit)await wait(Promise.resolve().then(()=>onAudit({nativeJobs,closingNativeJobs,observedNative:byUrl.size,healthyNative:activeNative.filter(j=>j.sourceDetailComplete).length,india:india.length,returned:jobs.length,
   activeNative:activeNative.length,companyComplete:complete,wholeCompanyGlobal:complete?activeNative.length:null,wholeCompanyIndia:complete?india.length:null,issues:uniqueIssues,calls,
   sourceCompanyWideScopeComplete:false,sourceDeclaredIndiaInventoryComplete:indiaComplete,
   indiaEligibilityProof:{complete:indiaComplete,nonIndiaExclusions,unresolvedRoles,inventoryIssues:sorted(new Set(indiaScopeIssues))},
   pagination:{pages:pages.size,fullSearchTerminal:!main.listing.next,client:'public-filter-client-GET-and-advertised-next-links'},outputCapped:capped})))
  signal.throwIfAborted()
  return attachInventoryEvidence(jobs,{status:indiaComplete?byUrl.size?'complete-inventory':'verified-empty':'coverage-gap',surface:JOB_SEARCH_URL,
   firstParty:true,listingComplete:indiaComplete,pagesFetched:calls.length,reportedTotal:indiaComplete?byUrl.size:null,indiaFacetCount:indiaComplete?india.length:null,verifiedAt:asOf,
   reason:indiaComplete?'autoform-current-declared-India-inventory; all-native-listings-RSS-identities-and-closing-workplace-models-reconciled; each-role-fully-qualified-for-India-or-every-native-workplace-interpretation-explicitly-non-India; exact-global-detail-conflicts-retained:'+uniqueIssues.join(',')+'; company-wide-scope-unproved':uniqueIssues.join(';')+'; unresolved-India-interpretations:'+unresolvedRoles.map(row=>row.id).join(',')})
 }}
}
export const run=options=>createAutoFormIndiaScraper(options).run(options)
