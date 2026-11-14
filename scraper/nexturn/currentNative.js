import {createHash} from 'node:crypto'
import {createCurrentNativeReader} from '../../scraper-support/native-sources/boundedCurrentNativeRead20261106.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {canonicalNativeRecord} from '../../scraper-support/native-sources/collectCurrentOriginalRecords20261106.js'
import {readOriginalNativeCriteria} from '../../scraper-support/native-sources/currentNativeCriteria20261106.js'
import {nativeLines,comparable} from '../../scraper-support/native-sources/firstPartyNativeHtml.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

export const CURRENT_CANONICAL_ORIGIN='https://a207918b5adcafa5a3d5c8da94245572-1614464718.ap-south-1.elb.amazonaws.com'
const HOME='https://nexturn.com/',CAREERS=HOME+'careers/'
const canonicalOrigins=[HOME.slice(0,-1),'https://www.nexturn.com',CURRENT_CANONICAL_ORIGIN,'https://ec2-65-0-158-166.ap-south-1.compute.amazonaws.com','https://3.7.208.225','https://13.202.106.64']
const indiaLocations=new Set(['India, Hyderabad','India, Hyderabad (Hybrid)','India, Mumbai/Gurgaon','India, Mumbai/Gurgoan','India, Mumbai (must be ready to travel every day)','India, Remote','India, Hyderabad (Hybrid/Remote)','India, Bangalore (Hybrid)','India, Hyderabad / Chennai / Trivandrum / Remote','India, Hyderabad & Bangalore (Hybrid)','India, Hyderabad & Remote','India, Bangalore/Remote','India, Gurugram (Hybrid)'])
const fail=(message,fields={})=>firstPartyFailure('nexturn',message,fields)
const need=(ok,message)=>{if(!ok)throw fail(message,{nativeAuthorityFailure:true})}
const same=(a,b)=>canonicalNativeRecord(a)===canonicalNativeRecord(b)
function roleURL(url){try{const p=new URL(url);return p.origin==='https://nexturn.com'&&/^\/job\/[a-z0-9]+(?:-[a-z0-9]+)*\/$/.test(p.pathname)&&!p.search&&!p.hash}catch{return false}}
const descendants=node=>[node,...node.children.filter(child=>typeof child!=='string').flatMap(descendants)]
function ownedDocument(html){
 const raw=readNativeDocument(html),root=raw.nodes(node=>node.tag==='root')[0],nodes=descendants(root),elements=node=>node.children.filter(child=>typeof child!=='string')
 const one=tag=>{const matches=nodes.filter(node=>node.tag===tag);need(matches.length===1,'Missing or ambiguous native document '+tag);return matches[0]}
 const document=one('html'),head=one('head'),body=one('body')
 need(elements(root).includes(document)&&elements(document).includes(head)&&elements(document).includes(body),'Native head/body ownership changed')
 const visible=readVisibleNativeDocument(html,{strict:true})
 need(['html','head','body'].every(tag=>visible.nodes(node=>node.tag===tag).length===1),'Native document is hidden or inert')
 need(!nodes.some(node=>node.tag==='base'),'Unreviewed native document base')
 return {raw,nodes,head,body,visible}
}
function visibleCriteria(owned,heading){
 const boundaries=owned.visible.nodes(node=>node.tag==='div'&&node.attrs.class==='apply-btn-container text-left')
 need(boundaries.length===1,'Missing or ambiguous active native application boundary')
 let started=false,ended=false
 const slice=node=>{
  if(node===boundaries[0]){ended=true;return null}
  if(node===heading)started=true
  if(typeof node==='string')return started&&!ended?node:null
  if(ended)return null
  const children=node.children.map(slice).filter(child=>child!==null)
  return children.length||node===heading?{...node,children}:null
 }
 const scope=slice(owned.visible.nodes(node=>node.tag==='body')[0])
 need(started&&ended&&scope,'Native criteria and application boundary ownership changed')
 return nativeLines(scope).join('\n')
}
export function readNexTurnListing(spec,html){
 ownedDocument(html)
 need(spec.careersSignal(html),'Current official native listing identity changed')
 // These exact collapsed cards are discovery candidates. Each selected role
 // must still qualify from its active full original detail on both reads.
 const candidates=html.replace(/<div\s+class="col-12 col-md-6 job_post_thumb show_hide" id=job_post_thumb_[1-9]\d* style=display:none;>/g,tag=>tag.replace(' style=display:none;',''))
 const owned=ownedDocument(candidates),bodyNodes=new Set(descendants(owned.visible.nodes(node=>node.tag==='body')[0]))
 const declared=owned.visible.nodes(node=>node.tag==='div'&&/^job_post_thumb_\d+$/.test(node.attrs.id??'')&&bodyNodes.has(node))
 const blocks=[...html.matchAll(/<div\b[^>]*id=(["']?)job_post_thumb_\d+\1[^>]*>/gi)]
 const rows=spec.cards(html)
 need(declared.length===blocks.length,'Native listing candidates are hidden, inert or outside the owned body')
 need(blocks.length>0&&blocks.length<=100&&rows.length===blocks.length&&new Set(rows.map(row=>row.sourceUrl)).size===rows.length,'Native listing rows missing, duplicated or excessive')
 need(rows.every(row=>roleURL(row.sourceUrl)&&row.title&&row.location&&row.experienceRequired&&row.minimumQualification),'Incomplete original native listing row')
 return rows
}
export function readNexTurnDetail(spec,html,row){
 const owned=ownedDocument(html),links=owned.nodes.filter(n=>n.tag==='link'),canonical=links.filter(n=>n.attrs.rel==='canonical')
 need(canonical.length===1&&!canonical[0].inert&&owned.head.children.includes(canonical[0]),'Missing or ambiguous native canonical')
 const headings=owned.visible.nodes(n=>n.tag==='h1'&&n.attrs.class==='section-title'),bodyNodes=new Set(descendants(owned.visible.nodes(n=>n.tag==='body')[0]))
 need(headings.length===1&&bodyNodes.has(headings[0])&&owned.visible.text(headings[0])===row.title,'Original native role heading is hidden, inert or outside the owned body')
 const path=new URL(row.sourceUrl).pathname
 need(canonicalOrigins.some(origin=>canonical[0].attrs.href===origin+path),'Unreviewed native canonical identity or path')
 need(spec.detailSignal(html,row.sourceUrl),'Current official native full-detail markers changed')
 const starts=[...html.matchAll(/<h1\b[^>]*class="section-title"[^>]*>/g)]
 need(starts.length===1,'Ambiguous native role heading')
 const start=starts[0].index,tail=html.slice(start),boundaries=[...tail.matchAll(/<div\s+class="apply-btn-container text-left">/g)]
 need(boundaries.length===1,'Native role criteria boundary changed')
 const fragment=tail.slice(0,boundaries[0].index)
 const applicationBoundary=/^(<div\s+class="apply-btn-container text-left">[\s\S]*?<\/button><\/div><\/div><\/section>)<footer\s/.exec(tail.slice(boundaries[0].index))
 need(applicationBoundary&&createHash('sha256').update(applicationBoundary[1]).digest('hex')==='5699e9c1a96a2e37bf06ed20d50b8c2fc89b1569e1175a2c8277aeb8a52eb751','Additional native detail section requires review')
 const criteria=readOriginalNativeCriteria(fragment,fail)
 need(criteria.sourceDetailComplete,'Native full original criteria unavailable')
 need(comparable(visibleCriteria(owned,headings[0]))===comparable(criteria.sourceDescription),'Original native criteria are hidden or incomplete in document context')
 const detail=spec.detail(fragment.replace(/Work\s+Experience:/g,'Work Experience:'),row.sourceUrl)
 need(detail.title===row.title&&detail.location===row.location&&detail.experienceRequired===row.experienceRequired&&detail.minimumQualification===row.minimumQualification,'Native listing/detail title, geography or criterion mismatch')
 need(detail.requirements&&detail.minimumQualification&&detail.jobDescription,'Original native full criteria sections missing')
 need(!/\b(?:this (?:job|role|position) (?:is |has been )?(?:closed|filled|expired)|applications? (?:are )?closed|no longer accepting applications)\b/i.test(criteria.sourceDescription),'Native closed role notice')
 const short=links.filter(n=>n.attrs.rel==='shortlink')
 need(short.length===1&&!short[0].inert&&owned.head.children.includes(short[0])&&/^https:\/\/nexturn\.com\/\?p=[1-9]\d*$/.test(short[0].attrs.href),'Original native WordPress role ID missing')
 return {detail,criteria,nativeId:new URL(short[0].attrs.href).searchParams.get('p'),nativeCanonical:canonical[0].attrs.href}
}
export async function runCurrentNexTurn(spec,options={}){
 options.signal?.throwIfAborted()
 const maxJobs=options.maxJobs??100;need(Number.isSafeInteger(maxJobs)&&maxJobs>0&&maxJobs<=100,'Invalid native output limit')
 const observedAt=(options.now??(()=>new Date().toISOString()))();need(typeof observedAt==='string'&&Number.isFinite(Date.parse(observedAt)),'Invalid observation clock')
 const learned=new Set(),reader=createCurrentNativeReader(options,{source:'nexturn',admitted:[[HOME,'html'],[CAREERS,'html']],learnedURL:url=>learned.has(url)})
 const corporate=async()=>need(spec.homeSignal((await reader.read(HOME)).body),'Current official employer homepage changed')
 const facts=new Map(),holds=[],nativeIds=new Set()
 try{
  await corporate()
  const opening=readNexTurnListing(spec,(await reader.read(CAREERS)).body)
  for(const row of opening){
   if(!indiaLocations.has(row.location)){holds.push({url:row.sourceUrl,reason:row.location==='USA, Remote'?'native-foreign-country':'native-country-unqualified'});continue}
   learned.add(row.sourceUrl);reader.allow(row.sourceUrl,'html')
   const detail=readNexTurnDetail(spec,(await reader.read(row.sourceUrl)).body,row)
   need(!nativeIds.has(detail.nativeId),'Duplicate original native WordPress role ID');nativeIds.add(detail.nativeId)
   facts.set(row.sourceUrl,{row,...detail})
  }
  const closing=readNexTurnListing(spec,(await reader.read(CAREERS)).body),closed=new Map(closing.map(row=>[row.sourceUrl,row])),stable=[]
  for(const [url,fact]of facts){
   const row=closed.get(url)
   if(!row||!same(row,fact.row)){holds.push({url,reason:'native-listing-record-changed-at-closing'});continue}
   const last=readNexTurnDetail(spec,(await reader.read(url)).body,row)
   if(!same(last,factWithoutRow(fact))){holds.push({url,reason:'native-full-original-criteria-changed-at-closing'});continue}
   stable.push({...last.criteria,title:last.detail.title,company:'NexTurn',source:'nexturn',country:'India',location:last.detail.location,
    city:null,experienceRequired:last.detail.experienceRequired,minimumQualification:last.detail.minimumQualification,
    sourceNativeCriteria:{requirements:last.detail.requirements,qualifications:last.detail.minimumQualification,description:last.detail.jobDescription},
    sourceUrl:url,applyUrl:url,link:url,jobId:spec.id(url),requisitionId:null,sourceNativeJobId:last.nativeId,sourceNativeCanonical:last.nativeCanonical,
    postingDate:null,closingDate:null,sourceClosingReconciled:true,sourceScopeComplete:false,lifecycleCleanupAllowed:false,
    sourceEmployerScope:'same-origin-official-careers-list-and-original-detail',activationVerified:false,scrapedAt:observedAt})
  }
  await corporate()
  const jobs=stable.slice(0,maxJobs),audit={source:'nexturn',recordKind:'vacancy-rows',observedRecordCount:opening.length,observedVacancyCount:opening.length,
   sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,lifecycleCleanupAllowed:false,originalOpeningRecords:opening,originalClosingRecords:closing,
   openingClosingListingMatch:same(opening,closing),returnedCount:jobs.length,holds,outputLimited:stable.length>maxJobs,reader:reader.stats(),observationTime:observedAt}
  attachSourceObservationEvidence(jobs,audit);Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,reportedTotal:null,indiaFacetCount:null,
   pagesFetched:audit.reader.requests,verifiedAt:observedAt,reason:'exact-official-India-full-criteria-and-closing-details-reconciled;unknown-geography-and-company-scope-held'})
  need(Buffer.byteLength(JSON.stringify({jobs,audit}))<=8*1024*1024,'Native output byte budget exceeded')
  reader.check();return jobs
 }finally{reader.close()}
}
function factWithoutRow({row:ignored,...fact}){return fact}
