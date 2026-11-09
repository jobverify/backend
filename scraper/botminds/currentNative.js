import {activeHead, extractActiveDescription, readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {declaresBotmindsPublicApi,runBotmindsPublicApi} from './currentPublicApi.js'

export const CURRENT_CAREERS_URL='https://www.botminds.ai/careers'
const clean=value=>typeof value==='string'?value.replace(/\s+/g,' ').trim():''
const check=(ok,message)=>{if(!ok)throw Error('Botminds native: '+message)}
const descendants=(node,predicate)=>!node||typeof node==='string'||node.inert?[]:[...(predicate(node)?[node]:[]),...node.children.flatMap(child=>descendants(child,predicate))]
const only=(values,label)=>{check(values.length===1,'expected one '+label);return values[0]}
const jsonLd=document=>document.nodes(node=>node.tag==='script'&&node.attrs.type==='application/ld+json').flatMap(node=>{
 let value;try{value=JSON.parse(node.raw)}catch{throw Error('Botminds native: invalid public structured metadata')}
 return Array.isArray(value)?value:value['@graph']||[value]
})
const identity=(html,url)=>{
 const document=readNativeDocument(html),canonical=only(document.nodes(node=>node.tag==='link'&&node.attrs.rel==='canonical'),'canonical URL')
 check(canonical.attrs.href===url,'native canonical posting identity changed')
 check(activeHead(html).metas.some(meta=>meta.property==='og:site_name'&&meta.content==='Botminds'),'native employer identity changed')
 return document
}
const readHub=html=>{
 const document=identity(html,CURRENT_CAREERS_URL),metadata=jsonLd(document)
 check(metadata.some(row=>row['@type']==='Organization'&&row.name==='Botminds'&&row.url==='https://www.botminds.ai'),'official careers employer identity changed')
 const cards=document.nodes(node=>node.tag==='a'&&/^\/careers\/[a-z0-9-]+$/.test(node.attrs.href||'')&&node.attrs.href!=='/careers/apply')
 check(cards.length>0&&cards.length<=200,'current native role cards are missing or exceed the public board budget')
 const rows=cards.map(card=>{
  const headings=descendants(card,node=>/^h[23]$/.test(node.tag)),title=clean(document.text(only(headings,'native role card title'))),url=new URL(card.attrs.href,CURRENT_CAREERS_URL).href
  check(title,'empty native role title');return{id:card.attrs.href.split('/').at(-1),title,url}
 })
 check(new Set(rows.map(row=>row.id)).size===rows.length,'duplicate native role identity')
 check(!document.nodes(node=>['iframe','object','button'].includes(node.tag)&&/load|more|jobs|roles|openings/i.test(document.text(node)+' '+(node.attrs.src||''))).length,'unqualified additional native listing channel')
 return rows
}
const regions=new Intl.DisplayNames(['en'],{type:'region',fallback:'none'})
const nativeCountry=value=>{
 const code=typeof value==='string'?value:typeof value?.name==='string'?value.name:''
 if(code==='India')return'India'
 if(!/^[A-Z]{2}$/.test(code)||['ZZ','XA','XB','UN','EU','EZ','QO'].includes(code))return null
 return regions.of(code)||null
}
const detail=(html,listing)=>{
 const document=identity(html,listing.url),article=only(document.nodes(node=>node.tag==='article'),'role article')
 const heading=only(descendants(article,node=>node.tag==='h1'),'visible role heading'),schema=only(jsonLd(document).filter(row=>row['@type']==='JobPosting'),'public JobPosting')
 check(clean(document.text(heading))===listing.title&&schema.title===listing.title&&schema.url===listing.url,'visible and structured role titles or URLs conflict')
 check(schema.hiringOrganization?.['@type']==='Organization'&&schema.hiringOrganization.name==='Botminds'&&schema.hiringOrganization.sameAs==='https://www.botminds.ai','structured hiring employer conflicts')
 const prose=only(descendants(article,node=>document.hasClass(node,'prose')),'full visible role criteria')
 const description=extractActiveDescription(document.text(prose))
 check(description?.length>=800&&descendants(prose,node=>node.tag==='h2').some(node=>/What you.ll do/.test(document.text(node)))
  &&descendants(prose,node=>node.tag==='h2').some(node=>document.text(node)==='What you bring'),'full visible responsibilities and qualifications are unavailable')
 const apply=only(descendants(article,node=>node.tag==='a'&&node.attrs.href==='/careers/apply?role='+listing.id),'same-role application link')
 check(clean(document.text(apply))==='Apply for this role','native application identity changed')
 const date=clean(schema.datePosted),time=only(descendants(article,node=>node.tag==='time'),'visible publication date')
 check(/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date))&&time.attrs.datetime===date+'T00:00:00.000Z','native visible and structured publication dates conflict')
 const location=schema.jobLocation?.address
 check(schema.jobLocation?.['@type']==='Place'&&location?.['@type']==='PostalAddress','native worksite model changed')
 const country=nativeCountry(location.addressCountry),locality=clean(location.addressLocality)
 check(locality,'native role worksite locality missing')
 const job={source:'botminds',company:'Botminds',jobId:listing.id,requisitionId:null,title:listing.title,department:null,
  country,city:/\+|;/.test(locality)?null:locality,location:[locality,country].filter(Boolean).join(', '),sourceUrl:listing.url,
  applyUrl:new URL(apply.attrs.href,CURRENT_CAREERS_URL).href,link:listing.url,employmentType:schema.employmentType==='FULL_TIME'?'Full-time':null,
  postingDate:date,closingDate:null,experienceRequired:null,minimumQualification:null,preferredQualification:null,requiredSkills:[],remoteStatus:null,
  sourceNativeJobPosting:structuredClone(schema),sourceNativeSchemaSummary:clean(schema.description),sourceNativeDetailHTML:html,
  sourceCountryEvidence:country?'Same-canonical Botminds JobPosting publishes explicit addressCountry.':null,
  sourceDetailComplete:true,sourceListingComplete:false,sourceCompanyWideScopeComplete:false,jobDescription:description,sourceDescription:description}
 return{job,model:JSON.stringify({schema,description,apply:job.applyUrl})}
}

export async function runCurrentBotminds(options={}){
 const timeout=Number.isSafeInteger(options.timeoutMs)&&options.timeoutMs>0?options.timeoutMs:90000
 const signal=AbortSignal.any([AbortSignal.timeout(timeout),...(options.signal?[options.signal]:[])])
 check(options.maxJobs==null||Number.isSafeInteger(options.maxJobs)&&options.maxJobs>=0,'invalid result cap')
 const wait=value=>new Promise((resolve,reject)=>{let done=false;const finish=(fn,result)=>{if(done)return;done=true;signal.removeEventListener('abort',abort);fn(result)},abort=()=>finish(reject,signal.reason);signal.addEventListener('abort',abort,{once:true});Promise.resolve(value).then(value=>finish(resolve,value),error=>finish(reject,error));if(signal.aborted)abort()})
 let requests=0
 const read=async url=>{
  signal.throwIfAborted();requests++
  const result=await wait(Promise.resolve().then(async()=>{
   if(options.fetchText)return options.fetchText(url,{signal})
   const requestSignal=AbortSignal.any([signal,AbortSignal.timeout(20000)]),response=await fetch(url,{signal:requestSignal,redirect:'manual',headers:{'User-Agent':'Mozilla/5.0',Accept:'text/html'}})
   check(response.status===200&&(!response.url||response.url===url),'HTTP status or final posting identity changed at '+url)
   const html=await response.text();requestSignal.throwIfAborted();return html
  }))
  signal.throwIfAborted();check(typeof result==='string'&&result.length<=1000000,'invalid or oversized public HTML');return result
 }
 const initialHTML=await read(CURRENT_CAREERS_URL)
 if(declaresBotmindsPublicApi(initialHTML))return runBotmindsPublicApi(initialHTML,options)
 const opening=readHub(initialHTML),results=new Map(),failures=[]
 for(const listing of opening){try{results.set(listing.id,detail(await read(listing.url),listing))}catch(error){signal.throwIfAborted();failures.push({stage:'native-detail',nativeJobId:listing.id,message:error.message})}}
 const closing=readHub(await read(CURRENT_CAREERS_URL)),closingByID=new Map(closing.map(row=>[row.id,row])),qualified=[]
 for(const listing of opening){const first=results.get(listing.id);if(!first)continue
  try{check(closingByID.has(listing.id)&&JSON.stringify(closingByID.get(listing.id))===JSON.stringify(listing),'native role removed or changed at closing')
   const last=detail(await read(listing.url),listing);check(first.model===last.model,'full native criteria changed at closing');qualified.push(first.job)
  }catch(error){signal.throwIfAborted();failures.push({stage:'closing-detail',nativeJobId:listing.id,message:error.message})}
 }
 const signature=rows=>JSON.stringify([...rows].sort((a,b)=>a.id.localeCompare(b.id)))
 const stable=signature(opening)===signature(closing),observedDetails=[...results.values()].map(value=>value.job)
 const unknown=observedDetails.filter(job=>!job.country),exclusions=qualified.filter(job=>job.country&&job.country!=='India').map(job=>({id:job.jobId,country:job.country,reason:'explicit native non-India worksite'}))
 const allJobs=qualified.filter(job=>job.country==='India'),jobs=options.maxJobs==null?allJobs:allJobs.slice(0,options.maxJobs)
 const complete=stable&&!failures.length&&!unknown.length&&jobs.length===allJobs.length
 const audit={source:'botminds',observedListingCount:opening.length,observedIndiaListingCount:observedDetails.filter(job=>job.country==='India').length,
  candidateDetails:opening.length,extractedDetailJobs:jobs.length,unknownCountryListingCount:unknown.length,nonIndiaListingCount:exclusions.length,
  opening,closing,closingInventoryMatches:stable,listingPaginationComplete:true,sourceScopeComplete:complete,sourceDeclaredBoardScopeComplete:complete,
  sourceCompanyWideScopeComplete:false,failures,exclusions,observedDetails,jobs:jobs.map(job=>({id:job.jobId}))}
 for(const job of jobs)Object.assign(job,{scrapedAt:new Date().toISOString(),sourceListingComplete:complete,sourceDeclaredBoardScopeComplete:complete})
 if(jobs.length)jobs[0].nativeCollectionEvidence={...audit,observedDetails:observedDetails.map(job=>({id:job.jobId,country:job.country,sourceUrl:job.sourceUrl}))}
 attachInventoryEvidence(jobs,{firstParty:true,surface:CURRENT_CAREERS_URL,status:complete?'complete-inventory':'coverage-gap',listingComplete:complete,
  reportedTotal:opening.length,indiaFacetCount:unknown.length?null:allJobs.length,pagesFetched:requests,verifiedAt:new Date().toISOString(),
  reason:`Current declared Botminds server-rendered board; all public role links/full visible criteria/explicit native countries and original dates; closing full models match=${stable}; detail failures=${failures.length}; country gaps=${unknown.length}; company-wide scope remains unknown`})
 if(options.onAudit)await wait(Promise.resolve().then(()=>options.onAudit(audit)))
 signal.throwIfAborted();return jobs
}
