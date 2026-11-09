import {createHash} from 'node:crypto'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {nativeText,qualifiedFirstPartyHTML} from '../../scraper-support/native-sources/firstPartyNativeHtml.js'
import {boundedDeclaredPublicGet} from '../../scraper-support/native-sources/boundedDeclaredPublicGet.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {getValidIndiaCityForJob} from '../../src/utils/publicJobLocationScope.js'

const SOURCE='movate',HOME='https://www.movate.com/careers-at-movate/',INDEX='https://www.movate.com/careers/latest-job-openings/'
const PROGRAMS=new Map([
 ['https://www.movate.com/wp-content/plugins/movate-careers/build/blocks/job-filters/view.js','6d48d60a5190dd36efcbb0b1c92e9c1941eecf2f0acdeeb9a7d6d34fe60d2202'],
 ['https://www.movate.com/wp-content/plugins/movate-careers/build/blocks/job-results/view.js','df656eb4ea43299693de70efa226292abdcac5bfef4882d0d0e91dcc02747f78'],
])
const labels=['experience required(yrs)','qualification','employment type','location','primary skill','secondary skill','job description']
const failure=message=>firstPartyFailure(SOURCE,message,{nativeAuthorityFailure:true})
const need=(ok,message)=>{if(!ok)throw failure(message)}
const text=node=>nativeText(node).replace(/\s+/g,' ').trim()
const hasClass=(node,name)=>(node.attrs.class??'').split(/\s+/).includes(name)
const within=(node,predicate)=>[...(predicate(node)&&!node.inert?[node]:[]),...(node.children??[]).filter(child=>typeof child!=='string'&&!child.inert).flatMap(child=>within(child,predicate))]
const one=(nodes,label)=>{need(nodes.length===1,'Missing or ambiguous '+label);return nodes[0]}
const sha=value=>createHash('sha256').update(value).digest('hex')
function canonical(html,url){
 const document=qualifiedFirstPartyHTML(html,url,failure)
 need(document.title.includes('Movate'),'Native employer title changed')
}
function corporate(html){
 const doc=readNativeDocument(html);canonical(html,HOME)
 need(doc.nodes(node=>node.tag==='a'&&!node.inert&&node.attrs.href===INDEX).length>0,'Missing current corporate India recruiting handoff')
}
function declaredPrograms(html){
 const doc=readNativeDocument(html)
 const scripts=doc.nodes(node=>node.tag==='script'&&!node.inert&&node.attrs.src?.includes('/wp-content/plugins/movate-careers/'))
 need(scripts.length===PROGRAMS.size&&scripts.every(node=>PROGRAMS.has(node.attrs.src)&&[undefined,'','text/javascript','application/javascript','module'].includes(node.attrs.type)),'Native recruiting client program declarations changed')
 for(const url of PROGRAMS.keys())need(scripts.filter(node=>node.attrs.src===url).length===1,'Ambiguous native recruiting client program')
}
function pageURL(raw,page){
 const url=new URL(raw,INDEX)
 need(url.origin==='https://www.movate.com'&&url.pathname==='/careers/latest-job-openings/'&&!url.hash&&!url.username&&!url.password&&!url.port,'Native pagination URL identity changed')
 need([...url.searchParams.keys()].every(key=>['job_page','mvc_partial'].includes(key))&&url.searchParams.get('job_page')===String(page)
  &&(!url.searchParams.has('mvc_partial')||url.searchParams.get('mvc_partial')==='1'),'Filtered or unexpected native pagination')
 // The reviewed publisher client adds this rendering-only parameter to the
 // exact public pagination URL. Its response is the complete original region.
 url.searchParams.set('mvc_partial','1')
 return url.href
}
function readPage(html,page,{full=false}={}){
 const doc=readNativeDocument(html)
 if(full){canonical(html,INDEX);declaredPrograms(html)}
 const region=one(doc.nodes(node=>hasClass(node,'wp-block-movate-careers-job-results')&&!node.inert),'native results region')
 need(region.attrs['data-mvc-country']==='India'&&region.attrs['data-mvc-country-slug']==='india','Native country selection changed')
 const count=text(one(within(region,node=>hasClass(node,'mvc-results__count')),'native count')).match(/^(\d+) openings? found$/)
 const total=count?Number(count[1]):null
 need(Number.isSafeInteger(total)&&total>0&&total<=5000,'Native results count unavailable; no empty inventory inferred')
 const active=within(region,node=>node.attrs['aria-current']==='page')
 need(active.length===1&&text(active[0])==='Page '+page,'Native pagination page identity changed')
 const cards=within(region,node=>node.tag==='article'&&hasClass(node,'mvc-card'))
 need(cards.length>0&&cards.length<=10,'Native row count changed')
 const records=cards.map(card=>{
  need(!within(card,node=>['script','iframe','object','embed','form'].includes(node.tag)||Object.keys(node.attrs).some(key=>/^on/i.test(key))).length,'New delegated native role program')
  const title=text(one(within(card,node=>hasClass(node,'mvc-card__title')),'native role title'))
  const ref=text(one(within(card,node=>hasClass(node,'mvc-card__ref')),'native role reference')).match(/^RRF-\s*(\d+)$/)
  need(title&&ref,'Missing native role identity')
  const id=ref[1],apply=one(within(card,node=>node.tag==='a'&&hasClass(node,'mvc-card__apply')),'native role entry')
  const url=new URL(apply.attrs.href,INDEX)
  need(url.origin==='https://www.movate.com'&&new RegExp('^/careers/job/'+id+'-[a-z\\d-]+/$').test(url.pathname)&&!url.search&&!url.hash&&!url.username&&!url.password&&!url.port,'Native role entry identity changed')
  const fields={}
  for(const field of within(card,node=>hasClass(node,'mvc-card__field'))){
   const label=text(one(within(field,node=>node.tag==='dt'),'native criterion label')).replace(/:$/,'').toLowerCase()
   need(labels.includes(label)&&!Object.hasOwn(fields,label),'New or duplicate native criteria field')
   fields[label]=text(one(within(field,node=>node.tag==='dd'&&!hasClass(node,'mvc-card__more')),'native criterion value'))
  }
  need(labels.every(label=>Object.hasOwn(fields,label)),'Incomplete native published criteria fields')
  need(/(?:^|,)\s*India\s*$/i.test(fields.location),'Native role country is not explicit India')
  return{id,title,url:url.href,fields,nativePage:page}
 })
 const next=within(region,node=>node.tag==='a'&&hasClass(node,'mvc-pagination__next'))
 need(next.length<=1,'Ambiguous native next page')
 if(next.length)need(next[0].attrs.rel==='next'&&cards.length===10,'Native pagination relation changed')
 return{records,total,next:next.length?pageURL(next[0].attrs.href,page+1):null}
}

export async function runCurrentMovate(options={}){
 const {fetchImpl=globalThis.fetch,maxJobs=null}=options
 const timeoutMs=options.timeoutMs??180000
 need(Number.isSafeInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=600000,'Invalid native source deadline')
 need(maxJobs===null||maxJobs===Infinity||Number.isSafeInteger(maxJobs)&&maxJobs>=0,'Invalid native job cap')
 const signal=AbortSignal.any([AbortSignal.timeout(timeoutMs),...(options.signal?[options.signal]:[])])
 const checkedAt=typeof options.now==='function'?options.now():options.now??new Date().toISOString()
 need(typeof checkedAt==='string'&&Number.isFinite(Date.parse(checkedAt)),'Invalid native check time')
 let requests=0
 async function read(url,program=false){
  signal.throwIfAborted();requests++
  const response=await boundedDeclaredPublicGet(url,{fetchImpl,signal,overflowError:failure('Native response exceeds bounded entity size')})
  need(response.status===200&&response.url===url,'Native HTTP status or final URL changed')
  const mime=response.headers['content-type']??''
  need(program?/^(?:text|application)\/(?:javascript|ecmascript)(?:;|$)/i.test(mime):/^text\/html(?:;|$)/i.test(mime),'Native entity content type changed')
  return new TextDecoder('utf-8',{fatal:true}).decode(Buffer.from(response.bodyBase64,'base64'))
 }
 async function programs(){for(const[url,digest]of PROGRAMS)need(sha(await read(url,true))===digest,'Native recruiting client program requires review')}
 async function collect(){
  corporate(await read(HOME))
  const first=await read(INDEX);declaredPrograms(first);await programs()
  let current=readPage(first,1,{full:true}),page=1,total=current.total
  const records=[],ids=new Set()
  for(;;){
   need(current.total===total,'Native count changed between pages')
   for(const row of current.records){need(!ids.has(row.id),'Duplicate native role reference across pages');ids.add(row.id);records.push(row)}
   need(records.length<=total,'Native records exceed reported count')
   if(!current.next){need(records.length===total,'Incomplete native terminal count');break}
   need(page<100,'Native pagination exceeds bounded source scope')
   current=readPage(await read(current.next),++page)
  }
  return{records,total,pages:page}
 }
 const opening=await collect(),closing=await collect()
 need(JSON.stringify(opening)===JSON.stringify(closing),'Native closing inventory or full criteria changed')
 const missing=opening.records.filter(row=>!row.fields['job description']||/^(?:not provided|not available|n\/a|na)$/i.test(row.fields['job description'])).map(row=>row.id)
 let jobs=opening.records.filter(row=>!missing.includes(row.id)).map(row=>{
  const fields=row.fields,location=fields.location
  const description=labels.filter(label=>!['location','employment type'].includes(label)).map(label=>label+':\n'+fields[label]).join('\n\n')
  return{source:SOURCE,company:'Movate',legalEmployer:null,title:row.title,jobId:row.id,requisitionId:row.id,sourceNativeJobId:row.id,
   location,city:getValidIndiaCityForJob({location})??null,state:null,country:'India',department:null,
   sourceUrl:row.url,applyUrl:row.url,link:row.url,applicationUrlIsGeneric:false,applicationVisited:false,
   employmentType:fields['employment type']||null,experienceRequired:fields['experience required(yrs)']||null,minimumQualification:fields.qualification||null,
   preferredQualification:null,requiredSkills:[fields['primary skill'],fields['secondary skill']].filter(Boolean),postingDate:null,closingDate:null,
   jobDescription:description,sourceDescription:description,sourceDetailComplete:true,sourceDetailStatus:'complete-published-native-criteria',sourceNativeJobRecord:row,
   sourceEmployerScope:'current-first-party-India-careers-channel',sourceScopeComplete:false,lifecycleCleanupAllowed:false,scrapedAt:checkedAt}
 })
 const capped=maxJobs!==null&&maxJobs!==Infinity&&maxJobs<jobs.length
 if(capped)jobs=jobs.slice(0,maxJobs)
 const complete=!missing.length&&!capped
 for(const job of jobs)job.sourceListingComplete=complete
 attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:opening.records.length,observedVacancyCount:opening.records.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
 return attachInventoryEvidence(jobs,{status:complete?'complete-inventory':'coverage-gap',surface:INDEX,firstParty:true,listingComplete:complete,pagesFetched:requests,
  reportedTotal:opening.total,indiaFacetCount:opening.records.length,verifiedAt:checkedAt,
  reason:'current-unfiltered-native-India-pages-and-all-published-criteria-reconciled-at-closing;whole-company-scope-unqualified;missing-criteria-ids:'+missing.join(',')+(capped?';caller-cap':'')})
}
