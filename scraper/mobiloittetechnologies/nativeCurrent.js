import {createHash} from 'node:crypto'
import {types} from 'node:util'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {readNativeDocument,decodeNativeEntities,extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {normalizeNativeAttributeBoundaries} from '../../scraper-support/utils/nativeHtmlAttributes.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const SOURCE='mobiloittetechnologies',COMPANY='Mobiloitte Technologies',HOME='https://www.mobiloitte.com/',CAREERS=HOME+'careers'
const ORGANIZATION=HOME+'#organization',LEGAL='Mobiloitte Technologies India Pvt. Ltd.'
const USER_AGENT='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const schemaFields=new Set(['@context','@type','@id','title','description','datePosted','validThrough','employmentType','hiringOrganization','jobLocation','directApply','url'])
const unavailable=/\b(?:(?:(?:this|the)\s+)?(?:job|role|position|vacancy|opening|opportunity)\s+(?:(?:is|was|has(?:\s+been)?)\s+)?(?:(?:already|now|currently)\s+)*(?:closed|filled|withdrawn|cancelled|canceled|unavailable|not\s+available|no\s+longer\s+(?:available|active|open))|(?:no\s+longer|not(?:\s+currently)?)\s+accepting\s+(?:(?:any|new)\s+)?applications|(?:applications|recruitment|hiring)\s+(?:for\s+(?:(?:this|the)\s+)?(?:role|position|job|vacancy)\s+)?(?:(?:are|is|were|have\s+been|has\s+been)\s+)?(?:now\s+)?(?:closed|ended|stopped|suspended))\b/i
const clean=value=>typeof value==='string'?value.replace(/\s+/g,' ').trim():''
const sha=value=>createHash('sha256').update(value).digest('hex')
const problem=(message,kind='coverage_gap')=>Object.assign(Error('Mobiloitte native: '+message),{softFailure:true,abortRetries:true,failureKind:kind,sourceScopeComplete:false,lifecycleCleanupAllowed:false})
const need=(value,message)=>{if(!value)throw problem(message)}
const one=(values,label)=>{need(values.length===1,'missing or ambiguous '+label);return values[0]}
const hasClass=(node,name)=>(node.attrs.class||'').split(/\s+/).includes(name)
const within=(node,predicate)=>node.inert?[]:[...(predicate(node)?[node]:[]),...node.children.filter(child=>typeof child!=='string').flatMap(child=>within(child,predicate))]
const context=value=>typeof value==='string'&&/^https?:\/\/schema\.org\/?$/.test(value)
const checkedContext=(value,inherited,label)=>{const current=Object.hasOwn(value,'@context')?value['@context']:inherited;need(context(current),label+' context changed');return current}
const typed=(value,type,inherited,label)=>{need(value&&typeof value==='object'&&!Array.isArray(value)&&value['@type']===type,label+' schema type changed');return checkedContext(value,inherited,label)}
const documentOf=page=>readNativeDocument(normalizeNativeAttributeBoundaries(page.html))
const visible=page=>readVisibleNativeDocument(normalizeNativeAttributeBoundaries(page.html))
const canonical=(page,expected)=>{const doc=documentOf(page),node=one(doc.nodes(node=>node.tag==='link'&&node.attrs.rel==='canonical'),'canonical identity');let url;try{url=new URL(node.attrs.href).href}catch{}need(url===expected,'own canonical identity changed')}
function schemas(page){
  const rows=[]
  const add=(value,inherited)=>{
    if(Array.isArray(value)){need(value.length<=50,'schema array bound');value.forEach(row=>add(row,inherited));return}
    need(value&&typeof value==='object','schema object unavailable')
    const current=Object.hasOwn(value,'@context')?value['@context']:inherited
    if(Array.isArray(value['@graph'])){need(value['@graph'].length<=50,'schema graph bound');value['@graph'].forEach(row=>add(row,current))}
    if(value['@type'])rows.push({value,context:current})
  }
  for(const node of documentOf(page).nodes(node=>node.tag==='script'&&!Object.hasOwn(node.attrs,'src')&&(node.attrs.type||'').split(';')[0].trim().toLowerCase()==='application/ld+json')){
    need((node.raw||'').length<=200000,'schema read bound');let data
    try{data=JSON.parse(node.raw)}catch{throw problem('invalid native schema JSON')}
    add(data,null)
  }
  return rows
}
function publisher(page){
  canonical(page,page.url)
  const row=one(schemas(page).filter(row=>row.value['@id']===ORGANIZATION),'current publisher organization')
  typed(row.value,'Organization',row.context,'publisher')
  need(row.value.name==='Mobiloitte'&&row.value.url===HOME,'current publisher identity changed')
  return{organizationId:ORGANIZATION,name:row.value.name,url:row.value.url}
}
const activeLinks=(doc,base)=>doc.nodes(node=>node.tag==='a'&&node.attrs.href).flatMap(node=>{try{return[{node,url:new URL(node.attrs.href,base)}]}catch{return[]}})
function listing(page){
  const binding=publisher(page),doc=visible(page)
  need(doc.nodes(node=>node.tag==='h1'&&doc.text(node)==='Careers at Mobiloitte That Build Your Future').length===1,'current careers publisher heading changed')
  const cards=doc.nodes(node=>/^CurrentOpenings_jobCard__/.test((node.attrs.class||'').split(/\s+/).find(value=>value.startsWith('CurrentOpenings_jobCard__'))||'')),rows=[],seen=new Set()
  for(const card of cards){
    const title=clean(doc.text(one(within(card,node=>node.tag==='h3'),'visible listing role title')))
    const urls=[...new Set(within(card,node=>node.tag==='a'&&node.attrs.href).map(node=>new URL(node.attrs.href,page.url).href))]
    const url=one(urls,'own listing detail link'),match=url.match(/^https:\/\/www\.mobiloitte\.com\/careers\/(JOB\d{6})$/)
    need(match&&title&&!seen.has(match[1]),'current listing role identity or duplicate changed');seen.add(match[1])
    rows.push({id:match[1],url,title,nativeCard:structuredClone(card)})
  }
  const advertised=activeLinks(doc,page.url).filter(({url})=>url.origin===new URL(HOME).origin&&/^\/careers\/JOB\d{6}$/.test(url.pathname)).map(({url})=>url.href)
  need(rows.length>0&&rows.length<=32,'empty or unverified role inventory; no source zero proof')
  need(new Set(advertised).size===rows.length&&advertised.every(url=>rows.some(row=>row.url===url)),'active own role lead omitted from listing')
  return{binding,rows}
}
function date(value,label,now,future){
  need(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value),'native '+label+' date unavailable')
  const parsed=new Date(value)
  need(Number.isFinite(+parsed)&&parsed.toISOString()===value&&(future?+parsed>now:+parsed<=now),'native '+label+' date expired, invalid or future')
  return value
}
function role(page,row,binding,now){
  canonical(page,row.url)
  const native=one(schemas(page).filter(row=>row.value['@type']==='JobPosting'),'own JobPosting schema'),job=native.value,ctx=typed(job,'JobPosting',native.context,'own role')
  need(job.url===row.url&&job['@id']===row.url+'/#jobposting'&&clean(job.title)===row.title,'own role URL or title identity changed')
  need(Object.keys(job).every(key=>schemaFields.has(key)),'native schema criteria field requires review')
  const employerContext=typed(job.hiringOrganization,'Organization',ctx,'employer')
  need(context(employerContext)&&job.hiringOrganization.name===binding.name&&job.hiringOrganization['@id']===binding.organizationId&&job.hiringOrganization.sameAs===HOME.slice(0,-1),'native employer binding changed')
  const doc=visible(page),main=one(doc.nodes(node=>node.tag==='main'&&node.attrs.id==='main-content'&&hasClass(node,'job-detail-page-wrapper')),'visible own role main')
  need(!unavailable.test(doc.text(one(doc.nodes(node=>node.tag==='root'),'visible own role document'))),'native vacancy explicitly closed, filled or unavailable')
  const legalHeading=doc.text(one(within(main,node=>node.tag==='h1'),'visible legal employer heading'))
  need(legalHeading==='Apply For '+row.title+' At '+LEGAL,'visible title and legal employer heading changed')
  need(within(main,node=>node.tag==='button'&&/^Apply(?: Now)?$/.test(doc.text(node))).length>0&&job.directApply===true,'native application control unavailable')
  const placeContext=typed(job.jobLocation,'Place',ctx,'own country location'),address=job.jobLocation.address
  typed(address,'PostalAddress',placeContext,'own country address')
  need(address.addressCountry==='IN','own native country missing or foreign')
  need(typeof address.addressLocality==='string'&&clean(address.addressLocality),'own country locality unavailable')
  const criteriaColumn=one(within(main,node=>hasClass(node,'col-lg-8')),'visible full criteria column')
  const sections=within(criteriaColumn,node=>hasClass(node,'card-body')).map(card=>{
    const children=card.children.filter(child=>typeof child!=='string'&&!child.inert)
    need(children.length===2,'visible own criteria structure changed')
    const heading=doc.text(one(within(children[0],node=>node.tag==='h3'),'visible criteria heading'))
    return{heading,text:doc.text(children[1]),nativeContent:structuredClone(children[1])}
  })
  need(JSON.stringify(sections.map(section=>section.heading))===JSON.stringify(['Job Description','Requirements','Technical Skills','Experience Level']),'visible full criteria section contract changed')
  const schemaDescription=typeof job.description==='string'?clean(decodeNativeEntities(job.description)):''
  need(schemaDescription.length>=200&&extractActiveDescription(schemaDescription)&&sections[0].text===schemaDescription,'visible full description and own schema criteria disagree')
  need(sections.every(section=>section.text),'visible native criteria section empty')
  const postingDate=date(job.datePosted,'posting',now,false),closingDate=date(job.validThrough,'expiry',now,true)
  const locality=clean(address.addressLocality),city=/^remote$/i.test(locality)?null:locality
  return{title:row.title,company:COMPANY,source:SOURCE,jobId:row.id,requisitionId:null,sourceUrl:row.url,applyUrl:row.url,link:row.url,
    country:'India',city,location:[locality,clean(address.addressRegion),'India'].filter(Boolean).join(', '),
    jobDescription:sections.map(section=>section.heading+'\n'+section.text).join('\n\n'),sourceDescription:sections.map(section=>section.heading+'\n'+section.text).join('\n\n'),
    postingDate,closingDate,sourcePostedDateRaw:job.datePosted,sourcePostedDateIsExact:true,postingDatePrecision:'timestamp',firstEverPostedAt:null,
    employmentType:job.employmentType==='FULL_TIME'?'Full-time':null,remoteStatus:null,minimumQualification:null,preferredQualification:null,requiredSkills:[],
    nativeEmployer:job.hiringOrganization.name,nativeLegalEmployerHeading:legalHeading,nativeJobPosting:structuredClone(job),nativeVisibleCriteria:sections,nativeVisibleRoleText:doc.text(main),nativeListingRecord:row,
    nativeCountryEvidence:{method:'own-typed-JobPosting-jobLocation-PostalAddress-addressCountry',nativeCountryCode:address.addressCountry,nativeAddress:structuredClone(address),countryProofFromCityOrHQ:false},
    sourceOfficialBinding:{method:'current-same-host-corporate-careers-handoff-and-own-visible-legal-employer-heading',...binding,legalEmployer:LEGAL,originalCompany:COMPANY},
    sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,sourceDetailComplete:true}
}

export async function runMobiloitteNative(options={}){
  need(!options.fetchText||options.fetchImpl,'native HTTP metadata required; body-only overrides cannot qualify jobs')
  const duration=options.sourceDeadlineMs??85000
  need(Number.isSafeInteger(duration)&&duration>0&&duration<=85000,'invalid source deadline')
  const clock=typeof options.now==='function'?options.now():options.now??new Date().toISOString(),now=Date.parse(clock)
  need(Number.isFinite(now),'invalid observation clock')
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(problem('source deadline exceeded')),duration)
  const signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
  const fetchImpl=options.fetchImpl||globalThis.fetch,pages=[];let bytes=0,reads=0
  const read=async url=>{
    signal.throwIfAborted();need(++reads<=80&&/^https:\/\/www\.mobiloitte\.com\/(?:careers(?:\/JOB\d{6})?)?$/.test(url),'public read URL or count bound')
    const nativeFetch=async(value,init)=>{
      const response=await fetchImpl(value,{...init,cache:'no-store',credentials:'omit',headers:{...init.headers,'User-Agent':USER_AGENT}})
      const body=response.body===null?null:{cancel:reason=>response.body.cancel(reason),getReader(){
        const reader=response.body.getReader();let entityBytes=0
        return{async read(){const next=await reader.read();if(!next.done){need(types.isUint8Array(next.value),'native byte chunk type');need(next.value.byteLength<=4000000-entityBytes&&next.value.byteLength<=24000000-bytes,'native response byte bound');entityBytes+=next.value.byteLength;bytes+=next.value.byteLength}return next},cancel:reason=>reader.cancel(reason),releaseLock:()=>reader.releaseLock()}
      }}
      return{status:response.status,url:response.url,headers:response.headers,body}
    }
    const packet=await boundedDeclaredPublicRead(url,{fetchImpl:nativeFetch,signal,overflowError:problem('native response byte bound'),timeoutMs:15000})
    const body=Buffer.from(packet.bodyBase64,'base64'),html=new TextDecoder('utf-8',{fatal:true}).decode(body)
    pages.push({url,finalURL:packet.url,status:packet.status,bytes:body.length,bodySHA256:sha(body),body:html,checkedAt:new Date().toISOString()})
    if(packet.status!==200)throw problem('native HTTP '+packet.status,[401,403,429,451].includes(packet.status)?'blocked_or_access_denied':'upstream_unavailable')
    need(packet.url===url,'native public redirect changed')
    need(/^text\/html\b/i.test(packet.headers['content-type']||''),'native response MIME changed')
    return{url,html}
  }
  const publication=async()=>{
    const home=await read(HOME),binding=publisher(home),document=visible(home)
    need(activeLinks(document,HOME).some(({url})=>url.href===CAREERS),'current corporate careers handoff changed')
    const careers=await read(CAREERS),inventory=listing(careers)
    need(JSON.stringify(binding)===JSON.stringify(inventory.binding),'corporate and careers publisher changed')
    return inventory
  }
  try{
    const opening=await publication(),jobs=[]
    for(const row of opening.rows)jobs.push(role(await read(row.url),row,opening.binding,now))
    const closing=await publication()
    need(JSON.stringify(opening)===JSON.stringify(closing),'closing current publisher or listing changed')
    for(let index=0;index<jobs.length;index++){
      const checked=role(await read(closing.rows[index].url),closing.rows[index],closing.binding,now)
      need(JSON.stringify(jobs[index])===JSON.stringify(checked),'closing full own role context changed')
      jobs[index].sourceNativeClosingContext={publisherRechecked:true,listingRechecked:true,eachFullRoleRechecked:true}
      jobs[index].scrapedAt=new Date().toISOString()
    }
    jobs[0].nativeBatchEvidence={responses:pages,openingListing:opening,closingListing:closing,companyScopeComplete:false,lifecycleCleanupAllowed:false}
    return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:2,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason:'current-visible-native-role-positives;company-and-country-enumeration-scope-unknown;cleanup-forbidden'})
  }catch(error){
    if(error&&typeof error==='object')error.sourceAudit={source:SOURCE,originalResponses:pages,sourceScopeComplete:false,lifecycleCleanupAllowed:false}
    throw error
  }finally{clearTimeout(timer)}
}
