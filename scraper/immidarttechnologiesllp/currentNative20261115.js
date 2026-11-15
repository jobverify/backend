import {createHash} from 'node:crypto'
import {types} from 'node:util'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {normalizeNativeAttributeBoundaries} from '../../scraper-support/utils/nativeHtmlAttributes.js'
import {parseEightfoldJson} from '../../scraper-support/utils/recruitmentEightfoldData.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const SOURCE='immidarttechnologiesllp',COMPANY='Immidart Technologies LLP',HOME='https://www.immidart.com/',BOARD=HOME+'careers/'
const STYLES={
  '/_next/static/css/87bcb277bab06f01.css':'50194f20517aaaaaefa81533cfb70cc10a58c6d1951b25b84c8468398d672013',
  '/_next/static/css/0e04e154436d3aea.css':'d340158ae1f3f096915f0ea52e7e9db6f82eebf81a7d5594ea558fa74288c0be',
  '/_next/static/css/6880d2c2511f9024.css':'ff70d87cd2422c958dc5ae48ebdbf554b316156e2eb190e2c8068d7029b73676',
  '/_next/static/css/26aa352a8d0cdb5e.css':'367ccca83a4058d90eba10b6cb1bf5abc4ac3d67a95d92f8cc2146813d6f6236',
  '/_next/static/css/48903506319f37a5.css':'d2a79e7374f92fa42d150be44e82fcf3f043c5fe4ae41cc98dbe4f7dae173ac6',
}
const roleSections={
  'technical-architect':['About Immidart','Role details','Key responsibilities','Required skills','Good to have','How to apply'],
  'global-immigration-domain-consultant':['About Immidart','Experience','Key responsibilities','What you will do','What you bring','Nice to have'],
  'lead-product-analyst':["What you'll do","What you'll bring",'Good to have','Growth path','Role details'],
  'sales-manager-us':['About Immidart','Role details','Territory and customer focus','Territory strategy and pipeline ownership','Consultative enterprise selling','Demonstrations, proposals and commercial closure','Partnerships and market intelligence','Forecasting and operating discipline','Required skills and qualifications','Preferred experience','Key performance indicators'],
  'sales-executive-emea-apac':['About Immidart','Role details','Territory and customer focus','Account research and outreach','Lead qualification and follow-up','Sales conversations and demonstration support','Proposal and opportunity coordination','Regional and partner development','CRM and reporting','Required skills and qualifications','Preferred experience','Key performance indicators'],
}
const schemaIntroductions={
  'technical-architect':'aaf45f280d085da647d9afcaa435064816b388305f538d35c824c372cb1808b2',
  'global-immigration-domain-consultant':'d32736256efcb694f3903e7a8699fee84139efd7b6ab6f211f90b2c8e631edcb',
  'lead-product-analyst':'200a0f5f9ff6ebbd401a27833b42aa34e4e268fd68e273141a5ecec655b4988e',
  'sales-manager-us':'baa92e2ac7596bd163dad51b3b1ae8934594106d81e184383f3d004c89021d19',
  'sales-executive-emea-apac':'1885eceb6b61d60cd247d948b684dc80eb67897477cda0c85160621581eaba8c',
}
const schemaFields=new Set(['@context','@type','title','description','identifier','datePosted','validThrough','employmentType','hiringOrganization','jobLocation','applicantLocationRequirements','directApply'])
const unavailable=/\b(?:(?:(?:this|the)\s+)?(?:job|role|position|vacancy|opening|opportunity)\s+(?:(?:is|was|has(?:\s+been)?)\s+)?(?:(?:already|now|currently)\s+)*(?:closed|filled|withdrawn|cancelled|canceled|unavailable|not\s+available|no\s+longer\s+(?:available|active|open))|(?:no\s+longer|not(?:\s+currently)?)\s+accepting\s+(?:(?:any|new)\s+)?applications|(?:applications|recruitment|hiring)\s+(?:for\s+(?:(?:this|the)\s+)?(?:role|position|job|vacancy)\s+)?(?:(?:are|is|were|have\s+been|has\s+been)\s+)?(?:now\s+)?(?:closed|ended|stopped|suspended))\b/i
const sha=value=>createHash('sha256').update(value).digest('hex')
const problem=message=>Object.assign(Error('Immidart native: '+message),{softFailure:true,abortRetries:true,failureKind:'coverage_gap',sourceScopeComplete:false,lifecycleCleanupAllowed:false})
const need=(value,message)=>{if(!value)throw problem(message)}
const one=(values,label)=>{need(values.length===1,'missing or ambiguous '+label);return values[0]}
const hasClass=(node,name)=>(node.attrs.class||'').split(/\s+/).includes(name)
const within=(node,predicate)=>node.inert?[]:[...(predicate(node)?[node]:[]),...node.children.filter(child=>typeof child!=='string').flatMap(child=>within(child,predicate))]
const schemaContext=value=>typeof value==='string'&&/^https?:\/\/schema\.org\/?$/.test(value)
const typed=(value,type,inherited)=>{
  need(value&&typeof value==='object'&&!Array.isArray(value)&&value['@type']===type,'native '+type+' type changed')
  const context=Object.hasOwn(value,'@context')?value['@context']:inherited
  need(schemaContext(context),'native '+type+' schema context override');return context
}
const parsed=html=>readNativeDocument(normalizeNativeAttributeBoundaries(html))
const canonical=(doc,url)=>need(one(doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'own canonical').attrs.href===url,'own canonical changed')
function schemaRows(doc){
  return doc.nodes(n=>n.tag==='script'&&!Object.hasOwn(n.attrs,'src')&&(n.attrs.type||'').split(';')[0].trim().toLowerCase()==='application/ld+json').map(node=>{
    need(typeof node.raw==='string'&&node.raw.length<=200000,'native schema byte bound')
    let value;try{value=parseEightfoldJson(node.raw)}catch{throw problem('native schema JSON unreadable or ambiguous')}
    need(value&&typeof value==='object'&&!Array.isArray(value),'native schema object missing');return value
  })
}
function publication(page){
  canonical(page.raw,page.url)
  const employer=one(schemaRows(page.raw).filter(row=>row['@type']==='Organization'),'current publication employer')
  typed(employer,'Organization',null)
  need(employer.name===COMPANY&&employer.url===HOME.slice(0,-1),'current publication employer changed')
  return{company:employer.name,corporateURL:employer.url,canonical:page.url}
}
const links=(doc,node,base)=>within(node,n=>n.tag==='a'&&n.attrs.href).map(node=>({node,url:new URL(node.attrs.href,base).href}))
function navigation(page){
  publication(page)
  // The current stylesheet initially hides .reveal cards. Published active
  // anchors supply navigation only; own visible role documents supply proof.
  const main=one(page.raw.nodes(n=>n.tag==='main'&&n.attrs.id==='main'&&hasClass(n,'careers-page')),'current careers navigation')
  const rows=[],seen=new Set()
  for(const card of within(main,n=>n.tag==='article'&&hasClass(n,'careers-job-card'))){
    const title=page.raw.text(one(within(card,n=>n.tag==='h3'),'native lead title'))
    const leads=links(page.raw,card,page.url),detail=one(leads.filter(({node})=>page.raw.text(node)==='More Info'),'own detail lead')
    const match=detail.url.match(/^https:\/\/www\.immidart\.com\/careers\/([a-z0-9-]+)\/$/)
    need(match&&title&&!seen.has(detail.url),'native role lead identity changed');seen.add(detail.url)
    const apply=detail.url+'apply/'
    need(leads.length===2&&leads.some(({node,url})=>url===apply&&page.raw.text(node)==='Apply for this Position'),'native application lead changed')
    rows.push({url:detail.url,slug:match[1],title,apply,nativeLeadCard:structuredClone(card),navigationOnly:true,visibilityQualified:false})
  }
  need(rows.length>0&&rows.length<=16,'coverage-gap: current published role leads empty or unbounded')
  return rows
}
function nativeDate(value,now){
  need(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value),'native posting calendar unavailable')
  const parsed=Date.parse(value+'T00:00:00Z')
  need(Number.isFinite(parsed)&&new Date(parsed).toISOString().slice(0,10)===value&&value<=new Date(now).toISOString().slice(0,10),'native posting calendar invalid or future')
  return value
}
function localExpiry(value,now){
  // The native value has no timezone. Retain it verbatim and require it to
  // remain future across a conservative full-day offset; never publish it as
  // an asserted application deadline or silently interpret it as UTC.
  need(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value),'native local expiry unavailable')
  const parsed=Date.parse(value+':00.000Z')
  need(Number.isFinite(parsed)&&new Date(parsed).toISOString().slice(0,16)===value&&parsed-86400000>now,'native expiry invalid, elapsed or timezone-ambiguous')
}
function role(page,row,now){
  const employer=publication(page),posting=one(schemaRows(page.raw).filter(value=>value['@type']==='JobPosting'),'own JobPosting')
  const context=typed(posting,'JobPosting',null)
  // Current introductions are summaries, not the full authored criteria.
  // New schema fields or changed summaries require review rather than being
  // silently omitted from the visible full JD. Every raw field is retained.
  need(Object.keys(posting).every(key=>schemaFields.has(key)),'native schema criteria field requires review')
  if(Object.hasOwn(schemaIntroductions,row.slug))need(typeof posting.description==='string'&&sha(posting.description)===schemaIntroductions[row.slug],'native schema introduction/criteria changed; requires review')
  typed(posting.hiringOrganization,'Organization',context)
  need(posting.hiringOrganization.name===employer.company&&posting.hiringOrganization.sameAs===employer.corporateURL,'own employer identity changed')
  const place=typed(posting.jobLocation,'Place',context),address=posting.jobLocation.address
  typed(address,'PostalAddress',place)
  need(address.addressCountry==='IN'&&typeof address.addressLocality==='string'&&address.addressLocality.trim(),'own native work-country/locality missing or foreign')
  typed(posting.applicantLocationRequirements,'Country',context)
  need(posting.applicantLocationRequirements.name==='IN','native applicant country conflict')
  typed(posting.identifier,'PropertyValue',context)
  need(posting.identifier.name==='Immidart'&&typeof posting.identifier.value==='string'&&/^JOB-2026-[A-Z-]+$/.test(posting.identifier.value),'native identifier unavailable')
  need(posting.title===row.title&&posting.employmentType==='FULL_TIME'&&posting.directApply===true,'native title/employment/application changed')
  need(typeof posting.description==='string'&&posting.description.trim(),'native introduction missing')
  const posted=nativeDate(posting.datePosted,now);localExpiry(posting.validThrough,now)
  const main=one(page.visible.nodes(n=>n.tag==='main'&&hasClass(n,'career-detail')),'visible own main')
  need(page.visible.text(one(within(main,n=>n.tag==='h1'&&n.attrs.id==='career-detail-title'),'own visible title'))===row.title,'own visible title conflict')
  const metaNode=one(within(main,n=>n.tag==='ul'&&hasClass(n,'career-detail__meta')),'visible own placement')
  const facts=metaNode.children.filter(child=>typeof child!=='string')
  need(facts.length===4&&facts.every(node=>node.tag==='li'&&page.visible.text(node))&&page.visible.text(facts[3])==='Full-time','visible own employment unavailable')
  const meta=page.visible.text(metaNode),location=page.visible.text(facts[0])
  const apply=one(within(main,n=>n.tag==='a'&&n.attrs.href===new URL(row.apply).pathname),'own current application')
  need(apply.attrs['aria-label']==='Slide or click to Apply now'&&apply.attrs['data-slide-pill']==='true','own accessible application changed')
  const article=one(within(main,n=>n.tag==='article'&&hasClass(n,'career-detail__content')),'visible authored full role')
  const original=one(page.raw.nodes(n=>n.tag==='article'&&hasClass(n,'career-detail__content')),'original own authored role')
  const description=page.visible.text(article)
  need(description===page.raw.text(original),'native authored criteria hidden or incomplete')
  const ownRoot=one(page.visible.nodes(node=>node.tag==='root'),'visible own role document')
  need(!unavailable.test(page.visible.text(ownRoot)),'native vacancy explicitly closed, filled, unavailable or withdrawn')
  const expected=roleSections[row.slug]
  const observation={sourceUrl:row.url,title:row.title,nativePosting:posting,nativeAuthoredArticle:structuredClone(original),nativeAuthoredText:description,nativeOwnPlacement:location,nativeOwnMeta:meta,nativeEmployer:employer}
  if(!expected)return{held:true,reason:'native-full-authored-criteria-unqualified',...observation}
  const children=article.children.filter(child=>typeof child!=='string')
  need(children[0]?.tag==='p'&&hasClass(children[0],'career-detail__intro')&&page.visible.text(children[0]).length>=200,'native authored introduction incomplete')
  const blocks=children.slice(1)
  need(blocks.every(node=>node.tag==='div'&&hasClass(node,'career-detail__block'))&&blocks.length===expected.length,'native authored criteria block contract changed')
  for(let index=0;index<blocks.length;index++){
    const body=blocks[index].children.filter(child=>typeof child!=='string')
    need(body.length===2&&body[0].tag==='h2'&&page.visible.text(body[0])===expected[index]&&body[1].tag==='ul','native authored criteria headings changed')
    const criteria=body[1].children.filter(child=>typeof child!=='string')
    need(criteria.length>0&&criteria.every(node=>node.tag==='li'&&page.visible.text(node).length>0),'native authored criteria section empty: '+expected[index])
  }
  const all=node=>[node,...node.children.filter(child=>typeof child!=='string').flatMap(all)]
  need(description.length>=1000&&all(original).every(node=>!node.inert&&!Object.hasOwn(node,'raw')&&['article','p','div','h2','ul','li','a','span','strong','b','em','i','br'].includes(node.tag)),'native full criteria unavailable or unreviewed')
  return{held:false,observation,job:{source:SOURCE,company:COMPANY,title:row.title,jobId:row.slug,requisitionId:posting.identifier.value,
    sourceUrl:row.url,link:row.url,applyUrl:row.apply,country:'India',city:address.addressLocality,location,
    jobDescription:description,sourceDescription:description,postingDate:posted,closingDate:null,firstEverPostedAt:null,
    sourcePostedDateRaw:posting.datePosted,sourceDatePrecision:'calendar-date',sourceSchemaExpiryRaw:posting.validThrough,
    nativeDateSemantics:'native posted calendar assertion; timezone-free schema expiry retained, real application deadline and first publication unqualified',
    employmentType:posting.employmentType,remoteStatus:null,sourceNativeJobPosting:posting,sourceNativeFullArticle:observation.nativeAuthoredArticle,
    sourceNativeEmployerBinding:employer,sourceNativeCountryEvidence:{method:'own-schema-JobPosting-jobLocation-PostalAddress-addressCountry',nativeAddress:address,countryProofFromCityOrHQ:false},
    sourceNativeNavigationLead:row,sourceNativeOwnPlacement:location,sourceNativeOwnMeta:meta,sourceDetailComplete:true,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false}}
}

export async function runCurrentImmidart(options={}){
  need(!options.fetchText||options.fetchImpl,'native HTTP metadata required; legacy body-only input cannot qualify current jobs')
  const clock=typeof options.now==='function'?options.now():options.now??new Date().toISOString(),now=Date.parse(clock)
  need(Number.isFinite(now),'invalid observation clock')
  const duration=options.sourceDeadlineMs??85000
  need(Number.isSafeInteger(duration)&&duration>0&&duration<=85000,'invalid source deadline')
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(problem('source deadline exceeded')),duration)
  const signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
  const fetchImpl=options.fetchImpl||globalThis.fetch,allowed=new Set([HOME]),receipts=[],styles=new Map();let reads=0,totalBytes=0
  const read=async(url,kind='html')=>{
    signal.throwIfAborted();need(allowed.has(url)&&++reads<=60,'read outside declared URL/count bound')
    const nativeFetch=async(value,init)=>{
      const response=await fetchImpl(value,{...init,cache:'no-store',credentials:'omit'})
      const body=response.body===null?null:{cancel:reason=>response.body.cancel(reason),getReader(){
        const reader=response.body.getReader();let bytes=0
        return{async read(){const part=await reader.read();if(!part.done){need(types.isUint8Array(part.value),'native stream chunk type');need(part.value.byteLength<=4000000-bytes&&part.value.byteLength<=24000000-totalBytes,'native stream byte bound');bytes+=part.value.byteLength;totalBytes+=part.value.byteLength}return part},cancel:reason=>reader.cancel(reason),releaseLock:()=>reader.releaseLock()}
      }}
      return{status:response.status,url:response.url,headers:response.headers,body}
    }
    const packet=await boundedDeclaredPublicRead(url,{fetchImpl:nativeFetch,signal,timeoutMs:15000,overflowError:problem('native stream byte bound')})
    const bytes=Buffer.from(packet.bodyBase64,'base64'),html=new TextDecoder('utf-8',{fatal:true}).decode(bytes)
    const receipt={url:packet.url,requestedURL:url,status:packet.status,headers:packet.headers,body:html,bodySHA256:sha(bytes),bytes:bytes.length};receipts.push(receipt)
    need(packet.status===200,'public native HTTP '+packet.status);need(packet.url===url,'native final URL changed')
    const mime=(packet.headers['content-type']||'').split(';')[0].trim().toLowerCase()
    need(kind==='css'?mime==='text/css':['text/html','application/xhtml+xml'].includes(mime),'native response type changed')
    return{url,html}
  }
  const page=async url=>{
    const value=await read(url),raw=parsed(value.html)
    need(!raw.nodes(n=>n.tag==='base').length,'unreviewed native base')
    const css=raw.nodes(n=>n.tag==='link'&&n.attrs.rel==='stylesheet').map(n=>new URL(n.attrs.href,url))
    const expected=Object.keys(STYLES).slice(0,3)
    if(url!==HOME)expected.push(Object.keys(STYLES)[url===BOARD?3:4])
    need(css.length===expected.length&&css.every((entry,index)=>entry.origin===new URL(HOME).origin&&!entry.search&&!entry.hash&&entry.pathname===expected[index]),'native stylesheet declarations changed')
    for(const style of css){allowed.add(style.href);if(!styles.has(style.href)){const current=await read(style.href,'css');need(sha(current.html)===STYLES[style.pathname],'native stylesheet bytes changed');styles.set(style.href,current.html)}}
    const visible=readVisibleNativeDocument(normalizeNativeAttributeBoundaries(value.html).replace('</head>','<style>'+css.map(url=>styles.get(url.href)).join('\n')+'</style></head>'),{strict:true})
    return{...value,raw,visible}
  }
  const currentPublication=async()=>{
    const home=await page(HOME),binding=publication(home),root=one(home.visible.nodes(n=>n.tag==='root'),'visible corporate root')
    need(links(home.visible,root,HOME).some(({url})=>url===BOARD),'current visible corporate careers handoff changed')
    allowed.add(BOARD);const careers=await page(BOARD),leads=navigation(careers)
    return{binding,leads}
  }
  try{
    const opening=await currentPublication(),staged=[]
    for(const row of opening.leads){allowed.add(row.url);staged.push(role(await page(row.url),row,now))}
    const closing=await currentPublication()
    need(JSON.stringify(opening)===JSON.stringify(closing),'closing current publication or navigation changed')
    for(let index=0;index<staged.length;index++){
      const current=role(await page(closing.leads[index].url),closing.leads[index],now)
      need(JSON.stringify(current)===JSON.stringify(staged[index]),'closing full own role context changed')
    }
    for(const url of styles.keys()){const current=await read(url,'css');need(sha(current.html)===STYLES[new URL(url).pathname],'closing native stylesheet changed')}
    signal.throwIfAborted()
    const jobs=staged.filter(row=>!row.held).map(({job})=>({...job,scrapedAt:new Date().toISOString(),sourceNativeClosingContext:{corporateRechecked:true,navigationRechecked:true,allOwnRolesRechecked:true,stylesRechecked:true}}))
    need(jobs.length>0,'coverage-gap: no qualified full own roles; empty inventory remains unproved')
    const evidence={source:SOURCE,originalResponses:receipts,navigationLeads:opening.leads,navigationVisibilityQualified:false,
      heldRecords:staged.filter(row=>row.held),ownRoleObservations:staged.map(row=>row.held?row:row.observation),
      ownFullCriteriaClosingReconciled:true,corporateHandoffClosingReconciled:true,sourceScopeComplete:false,lifecycleCleanupAllowed:false}
    Object.defineProperty(jobs,'nativeCollectionEvidence',{value:evidence})
    attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:staged.length,observedVacancyCount:staged.length,
      sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
    return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:BOARD,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,
      reportedTotal:null,indiaFacetCount:null,pagesFetched:reads,verifiedAt:new Date().toISOString(),reason:'own visible full native role positives; published board anchors navigation only; overview-only roles held; company scope and empty inventory unqualified'})
  }catch(error){
    if(error&&typeof error==='object')error.sourceAudit={source:SOURCE,originalResponses:receipts,sourceScopeComplete:false,lifecycleCleanupAllowed:false}
    throw error
  }finally{clearTimeout(timer)}
}
