import { createHash } from 'node:crypto'
import { createVerifiedFirstPartyKekaScraper } from '../../scraper-support/shared/verifiedFirstPartyKeka.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'

const root = 'https://algoworks.keka.com/careers/'
const identifier = 'c1623220-7738-4bff-ba91-5a9f0bbe01fc'
const official = 'https://www.algoworks.com/careers/'
const active = `${root}api/embedjobs/default/active/${identifier}`
const hash = value => createHash('sha256').update(value).digest('hex')
const decode = value => String(value ?? '').replace(/&#x([\da-f]+);/gi, (_, v) => String.fromCodePoint(parseInt(v,16)))
  .replace(/&#(\d+);/g, (_,v)=>String.fromCodePoint(Number(v))).replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&')
  .replace(/&quot;/gi,'"').replace(/&apos;|&#39;|&rsquo;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')
const text = value => decode(decode(value)).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,' ')
  .replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim()
// These exceptions belong to exact public roles and exact immutable descriptions.
// They cannot supply a country or city for any other job, or survive a changed JD.
const exceptions = new Map([
 ['92037',{title:'Senior Fullstack Engineer',sha256:'283d0527e6b8a96796ffa5d33d07702c58692044da746dd5c3d90ac02fc3d76e',role:'Senior Full Stack Developer',location:'India, Remote',city:'Remote'}],
 ['90535',{title:'Senior Developer',sha256:'df3f3ab42d2305a88fbce262efa0ca29f454959c0e4858aabe88daaabaa3e975',role:'Senior Developer',location:'India',city:null}],
 ['81923',{title:'Lead Engineer',sha256:'3c62d1a762d97cff51eb807735abc2323fddc59abdfdcf8d302561fda968682b',role:'Lead Engineer',location:'India, Remote',city:'Remote'}],
])
const fail = message => { throw new Error(`Algoworks native inventory: ${message}`) }
const descriptionWorkplace = job => {
 if(typeof job.description!=='string' || /<(?:style|link)\b/i.test(job.description)) fail(`unreviewed workplace header for ${job.id}`)
 const document=readNativeDocument(job.description), blockTags=new Set(['div','p','li','h1','h2','h3','h4','h5','h6','td','th'])
 const hasBlock=node=>node.children.some(child=>typeof child!=='string'&&!child.inert&&(blockTags.has(child.tag)||hasBlock(child)))
 const blocks=document.nodes(node=>blockTags.has(node.tag)&&!hasBlock(node)).filter(node=>document.text(node))
 const lines=blocks.map(node=>document.text(node)), header=lines.slice(0,3)
 const role=header[0]?.match(/^Role:\s*(.+)$/i), workplace=header[1]?.match(/^Location:\s*(India(?:,\s*Remote)?)$/i)
 const roleLines=lines.filter(line=>/^Role\s*:/i.test(line))
 const workplaceLines=lines.filter(line=>/^(?:(?:Job\s+|Work\s+)?Location|Workplace)\s*:/i.test(line))
 const tree=document.nodes(node=>node.tag==='root')[0]
 const presentation=node=>Object.hasOwn(node.attrs,'class')||Object.hasOwn(node.attrs,'style')||Object.hasOwn(node.attrs,'id')
   ||node.children.some(child=>typeof child!=='string'&&!child.inert&&presentation(child))
 if(!role||role[1]!==text(job.title)||!workplace||!/^Experience:\s*\S/i.test(header[2]||'')
   ||roleLines.length!==1||workplaceLines.length!==1||blocks.slice(0,3).some(presentation)
   ||!document.text(tree).startsWith(header.join(' '))) fail(`unresolved or ambiguous role workplace header for ${job.id}`)
 const remote=/,\s*Remote$/i.test(workplace[1]), location=remote?'India, Remote':'India'
 return {location,city:remote?'Remote':null,evidence:{kind:'explicit-native-role-workplace-header',nativeRole:role[1],nativeLocation:workplace[1],
   nativeField:'description.Role/Location',structuredLocationsMissing:true}}
}
const config = { source:'algoworkstechnologies', companyName:'Algoworks Technologies', officialUrl:official,
  handoffType:'embedded-script', handoffUrl:`${root}api/embedjobs/js/${identifier}`, kekaRootUrl:root,
  identifier, portalName:'default', portalIdentity:{name:'Algoworks Technologies Private Limited',shortName:'Algoworks Technologies Private Limited',domain:'algoworks.keka.com'} }

export async function runNativeInventory({ fetchImpl=fetch, signal, maxJobs, maxPages }={}) {
 signal?.throwIfAborted()
 if (maxJobs != null || maxPages != null) fail('inventory caps and page limits are unsupported')
 const request = async url => {
  signal?.throwIfAborted()
  const timeout=AbortSignal.timeout(20000)
  const r=await fetchImpl(url,{signal:signal?AbortSignal.any([signal,timeout]):timeout,headers:{'User-Agent':'JobverifyScraper/1.0',Accept:'application/json,text/html,application/javascript'}})
  if(r.status!==200 || r.url!==url) fail(`HTTP or redirect identity for ${url}`)
  const body=await r.text(); signal?.throwIfAborted(); timeout.throwIfAborted(); return body
 }
 let raw, rawBody, special=[]
 const jobs=await createVerifiedFirstPartyKekaScraper(config).run({signal,fetchImpl:async url=>{
  const body=await request(url)
  if(url!==active) return new Response(body,{status:200})
  rawBody=body
  raw=JSON.parse(body)
  if(!Array.isArray(raw)) fail('unexpected active inventory envelope')
  const seen=new Set()
  for(const job of raw) {
   const id=String(job?.id ?? '')
   if(!/^[1-9]\d*$/.test(id)||seen.has(id)) fail('invalid or duplicate raw job identity')
   seen.add(id)
   if(!Array.isArray(job.jobLocations)) fail(`missing geography array for ${id}`)
   if(!job.jobLocations.length) {
    let rule=exceptions.get(id)
    const prefix=text(job.description).match(/^Role:\s*(.*?)\s+Location:\s*(.*?)\s+Experience:/i)
    if(rule) {
     if(job.title!==rule.title || typeof job.description!=='string' || hash(job.description)!==rule.sha256
       || !prefix || prefix[1]!==rule.role || prefix[2]!==rule.location) fail(`unresolved role geography for ${id}`)
    } else rule=descriptionWorkplace(job)
    special.push({job,rule})
   }
  }
  // The shared strict engine still validates all normal location/country pairs.
  // Only verified role-owned country headers or retained exact-role evidence bypass its city-required schema.
  return new Response(JSON.stringify(raw.filter(job=>job.jobLocations.length)),{status:200})
 }})
 const group=JSON.parse(await request(`${root}api/embedjobs/grouplinkstatus/${identifier}`))
 if(!group || group.isGroupLinked!==false) fail('unresolved grouped employer scope')
 const board=JSON.parse(await request(`${root}api/jobs/default/active`))
 if(!Array.isArray(board)||JSON.stringify(board)!==JSON.stringify(raw)) fail('board and embedded full inventories disagree')
 for(const {job,rule} of special) {
  if(job.skillNames!=null && (!Array.isArray(job.skillNames)||job.skillNames.some(s=>typeof s!=='string'||!s.trim()))) fail('invalid exception skills')
  if(job.publishedOn && !Number.isFinite(Date.parse(job.publishedOn))) fail('invalid exception posting date')
  jobs.push({source:config.source,company:config.companyName,companyCareerPage:official,companyDomain:'algoworks.com',atsPlatform:'keka',
   jobId:String(job.id),requisitionId:String(job.jobNumber||job.id),title:job.title,location:rule.location,locations:[rule.location],city:rule.city,state:null,country:'India',
   sourceUrl:`${root}jobdetails/${job.id}`,applyUrl:`${root}jobdetails/${job.id}`,link:`${root}jobdetails/${job.id}`,
   jobDescription:text(job.description),experienceRequired:job.experience||null,department:job.departmentName||null,
   employmentType:Number(job.jobType)===2?'Full Time':null,requiredSkills:job.skillNames||[],postingDate:job.publishedOn?new Date(job.publishedOn).toISOString():null,
   closingDate:null,publicExperienceChecked:true,sourceListingComplete:true,scrapedAt:new Date().toISOString(),sourceCountryEvidence:rule.evidence||'exact-role-description-location-v1'})
 }
 for(const job of jobs) {
  const native=raw.find(row=>String(row.id)===job.jobId)
  const html=await request(job.sourceUrl)
  const document=readNativeDocument(html)
  // This server-rendered Keka surface puts scalar identity on active elements,
  // rather than in inline scripts. Hidden/template fallback content is excluded.
  const ids=document.nodes(node=>Object.hasOwn(node.attrs,'selectedjobid')).map(node=>node.attrs.selectedjobid)
  const titles=document.nodes(node=>node.tag==='h1')
  const descriptions=document.nodes(node=>document.hasClass(node,'job-description-container'))
  if(!ids.length||ids.some(id=>! /^[1-9]\d*$/.test(id)||id!==job.jobId)||titles.length!==1||descriptions.length!==1
    ||text(document.text(titles[0]))!==text(native.title)||text(document.text(descriptions[0]))!==text(native.description)) fail(`detail identity or description disagreement for ${job.jobId}`)
  job.sourceNativeInventorySha256=hash(rawBody)
  job.sourceNativeDescriptionSha256=hash(native.description)
  job.sourceDetailComplete=text(native.description).length>=80
  if(!job.sourceDetailComplete) job.sourceDetailFailureKind='limited-source-content'
 }
 // A detail traversal must not certify jobs removed or replaced during the read.
 const closingRaw=JSON.parse(await request(active))
 const closingBoard=JSON.parse(await request(`${root}api/jobs/default/active`))
 if(!Array.isArray(closingRaw)||!Array.isArray(closingBoard)||JSON.stringify(closingRaw)!==JSON.stringify(raw)
   ||JSON.stringify(closingBoard)!==JSON.stringify(raw)) fail('current full inventory changed during detail hydration')
 signal?.throwIfAborted()
 return attachInventoryEvidence(jobs,{status:raw.length?'complete-inventory':'verified-empty',surface:active,firstParty:true,
  listingComplete:true,pagesFetched:1,reportedTotal:raw.length,indiaFacetCount:jobs.length,verifiedAt:new Date().toISOString(),reason:'official-keka-embedded-full-array-board-reconciliation-and-native-details'})
}
