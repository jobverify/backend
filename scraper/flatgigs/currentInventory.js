import { createHash } from 'node:crypto'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { plainHTML } from '../../scraper-support/native-sources/jobPostingData.js'
import { boundedDeclaredPublicGet } from '../../scraper-support/native-sources/boundedDeclaredPublicGet.js'
import { readLiteralModel } from '../../scraper-support/native-sources/literalModel.js'
import { accountMatches, pageIdentity, publicURLs, validatePair, geography, projectJob, equal, codeValid } from '../../scraper-support/native-sources/publicWorkableSources/nativeData.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

const profile = Object.freeze({source:'flatgigs',companyName:'Flatgigs',tenant:'flatgigs',domain:'flatgigs.com',accountId:542477,accountUid:'533b83d2-079b-4b89-89fa-069a189e0a6d'})
const home='https://flatgigs.com/',urls=publicURLs(profile),hash=v=>createHash('sha256').update(v).digest('hex')
const need=(ok,message)=>{if(!ok)throw Error('Flatgigs current native: '+message)}
const wait=(start,signal)=>new Promise((resolve,reject)=>{
 let settled=false
 const finish=(fn,value)=>{if(settled)return;settled=true;signal.removeEventListener('abort',abort);fn(value)},abort=()=>finish(reject,signal.reason)
 signal.addEventListener('abort',abort,{once:true});if(signal.aborted)return abort()
 Promise.resolve().then(()=>{signal.throwIfAborted();return start()}).then(value=>finish(resolve,value),error=>finish(reject,error))
})
const json=page=>readLiteralModel(page.originalText).value
const compact=v=>v.normalize('NFKC').replace(/[^\p{L}\p{N}]/gu,'').toLowerCase()
function markdownPair(detail,page,own) {
 const u=publicURLs(profile,detail.shortcode),d=readNativeDocument(own.originalText)
 const declarations=d.nodes(n=>n.tag==='link'&&n.attrs.rel==='alternate'&&n.attrs.type==='text/markdown')
 need(declarations.length===1&&declarations[0].attrs.href===u.markdown,'own full Markdown declaration changed')
 const raw=page.originalText
 need(raw.startsWith('# '+detail.title+'\n')&&raw.split(/\r?\n/).some(l=>l.startsWith('> Flatgigs · ')&&l.endsWith('Posted '+detail.published.slice(0,10))),'own Markdown publisher/title/date differs')
 for(const [key,label]of [['description','Description'],['requirements','Requirements'],['benefits','Benefits']]){
  const hits=[...raw.matchAll(new RegExp('^## '+label+'\\r?\\n','gm'))];need(hits.length<=1,'ambiguous Markdown '+key)
  let section=hits.length?raw.slice(hits[0].index+hits[0][0].length):''
  const end=section.search(/^## (?:Description|Requirements|Benefits|Apply)\r?$|^---\s*$/m);if(end>=0)section=section.slice(0,end)
  const plain=section.replace(/!?\[([^\]]*)\]\([^)]*\)/g,'$1').replace(/\\([\\`*_[\]{}()#+.!-])/g,'$1')
  need(compact(plain)===compact(plainHTML(detail[key]||'')),'own Markdown/native '+key+' differs')
 }
 const applies=[...raw.matchAll(/^\[Apply at Flatgigs\]\(([^)]+)\)$/gm)]
 need(applies.length===1&&applies[0][1]===u.own+'/apply','own Markdown application identity changed')
}

// The retired /career/ widget remains a separate historical reader. Current
// discovery starts at the active corporate handoff; widgets only select which
// tenant-owned full records to acquire. They cannot supply the criteria alone.
export async function collectCurrentFlatgigs(options={}) {
 const signal=AbortSignal.any([AbortSignal.timeout(180000),...(options.signal?[options.signal]:[])])
 signal.throwIfAborted()
 need(!(options.fetchText||options.fetchJson)||options.fetchPage||options.fetchImpl,'original response transport required')
 const max=options.maxJobs==null||options.maxJobs===Infinity?null:options.maxJobs
 need(max===null||Number.isSafeInteger(max)&&max>=0,'invalid maxJobs')
 const observedAt=new Date(typeof options.now==='function'?await wait(options.now,signal):options.now??Date.now()).toISOString(),packets=[]
 const read=async(url,type)=>{
  const startedAt=new Date().toISOString(),requestSignal=AbortSignal.any([signal,AbortSignal.timeout(options.timeoutMs??20000)])
  const init={method:'GET',redirect:'manual',credentials:'omit',signal:requestSignal}
  const p=await wait(()=>options.fetchPage?options.fetchPage(url,init):boundedDeclaredPublicGet(url,{signal:requestSignal,fetchImpl:(u,r)=>(options.fetchImpl||fetch)(u,{...r,credentials:'omit'}),overflowError:Error('Flatgigs current native: oversized original')}),requestSignal)
  need(p?.status===200,'HTTP '+p?.status+' at '+url);need(p.url===url,'redirect or missing original URL')
  const bytes=typeof p.bodyBase64==='string'?Buffer.from(p.bodyBase64,'base64'):Buffer.from(p.body??'')
  const originalText=bytes.toString('utf8');need(bytes.length>0&&bytes.length<=16*1024*1024&&Buffer.from(originalText).equals(bytes),'missing, invalid or oversized original')
  const contentType=p.headers?.['content-type'];need(typeof contentType==='string'&&type.test(contentType),'native content type changed')
  const packet={url,status:p.status,headers:p.headers,startedAt,capturedAt:new Date().toISOString(),bodyBase64:bytes.toString('base64'),sha256:hash(bytes),originalText}
  packets.push(packet);return packet
 }
 const phases=[]
 for(const phase of ['opening','closing']){
  const primary=await read(home,/^text\/html/i)
  pageIdentity(primary,'Flatgigs · Talent for technology-first companies')
  const d=readVisibleNativeDocument(primary.originalText,{strict:true})
  need(d.nodes(n=>n.tag==='a'&&n.attrs.href===urls.board).some(n=>/Workable\s+Apply now/.test(d.text(n))),'active official recruiting handoff missing')
  const account=json(await read(urls.account,/^application\/json/i));need(accountMatches(profile,account),'reciprocal account identity changed')
  pageIdentity(await read(urls.board,/^text\/html/i),'Flatgigs - Current Openings')
  const listing=json(await read(urls.widget,/^application\/json/i))
  need(listing?.name==='Flatgigs'&&Array.isArray(listing.jobs)&&listing.jobs.length<=10000&&!listing.error&&listing.ok!==false&&listing.success!==false,'native inventory unavailable')
  const groups=new Map()
  for(const row of listing.jobs){need(codeValid(row?.shortcode),'malformed native posting');if(!groups.has(row.shortcode))groups.set(row.shortcode,[]);groups.get(row.shortcode).push(row)}
  const records=[]
  for(const [id,variants]of groups){
   // Remote and country labels alone cannot establish an India worksite.
   if(!variants.some(v=>v.country==='India'&&v.locations?.some(l=>l.country==='India'&&l.countryCode==='IN'&&l.hidden===false)))continue
   const u=publicURLs(profile,id),detail=json(await read(u.ownAPI,/^application\/json/i)),own=await read(u.own,/^text\/html/i)
   validatePair(profile,id,variants,detail,own)
   need(/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/.test(detail.published)&&new Date(detail.published).toISOString()===detail.published&&detail.published<=observedAt,'native publication is invalid or future')
   const md=await read(u.markdown,/^text\/markdown/i);markdownPair(detail,md,own)
   const allGeography=geography(detail);need(!allGeography.unresolved&&allGeography.countries.includes('India'),'native own India worksite unqualified')
   records.push({id,listingVariants:variants,originalNative:detail,own,markdown:md,geography:allGeography})
  }
  phases.push({phase,listing,records,observedNativeRecords:groups.size,account})
 }
 const [opening,closing]=phases
 need(equal(opening.listing,closing.listing),'opening/closing native inventory changed')
 need(opening.records.length===closing.records.length,'opening/closing selected roles changed')
 for(const r of opening.records){const c=closing.records.find(v=>v.id===r.id);need(c&&equal(r.originalNative,c.originalNative)&&r.markdown.originalText===c.markdown.originalText,'opening/closing full native criteria changed')}
 const jobs=opening.records.map(row=>{
  const g=row.geography,india=g.locations.filter(l=>l.country==='India'),place=india.length===1?india[0]:null
  const selected={...g,country:'India',countries:['India'],locations:india,city:place?.city??null,state:place?.state??null,location:india.map(l=>l.location).join(' | ')}
  const job=projectJob(profile,{...row,geography:selected},observedAt),c=closing.records.find(v=>v.id===row.id)
  return {...job,sourceDescription:job.jobDescription,sourceDetailComplete:true,sourceDetailStatus:'complete',sourceListingComplete:false,nativePublisher:'Flatgigs',nativeLegalEmployer:null,legalEmployer:null,nativeSameModeClosingQualified:true,nativeCurrentAvailabilityQualified:true,
   sourceCountryEvidence:{method:'explicit-native-own-worksite-and-listing',country:'India',inference:false,postingId:row.id},nativeAllGeography:g,
   nativeRawEvidence:{listing:row.listingVariants,detail:row.originalNative,ownHTML:row.own,markdown:row.markdown,closingListing:c.listingVariants,closingDetail:c.originalNative,closingOwnHTML:c.own,closingMarkdown:c.markdown}}
 })
 const selected=max===null?jobs:jobs.slice(0,max),report={source:'flatgigs',status:'partial',observedNativeRecords:opening.observedNativeRecords,countrySelected:jobs.length,returnedCount:selected.length,closingMatches:true,fullNativeDetails:jobs.length,reciprocalPublisherBinding:true,legalEmployerQualified:false,companyGlobalTotal:null,companyIndiaTotal:null,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,packets}
 for(const key of ['sourceScopeComplete','sourceListingComplete','lifecycleCleanupAllowed'])Object.defineProperty(selected,key,{value:false})
 attachSourceObservationEvidence(selected,{source:'flatgigs',recordKind:'vacancy-rows',observedRecordCount:opening.observedNativeRecords,observedVacancyCount:opening.observedNativeRecords,sourceScopeComplete:false})
 Object.defineProperty(selected,'sourceAudit',{value:report})
 attachInventoryEvidence(selected,{status:'coverage-gap',surface:urls.board,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:packets.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:null,reason:'current declared publisher own-role pairs; selected India observations only; end-client legal employer and company scope unverified'})
 if(options.onRecords)await wait(()=>options.onRecords(structuredClone(opening.records)),signal)
 if(options.onReport)await wait(()=>options.onReport(structuredClone(report)),signal)
 signal.throwIfAborted();return selected
}
