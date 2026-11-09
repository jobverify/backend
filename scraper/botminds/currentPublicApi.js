import {createHash} from 'node:crypto'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const ORIGIN='https://www.botminds.ai',HUB=ORIGIN+'/careers',API=ORIGIN+'/api/jobs'
const programs={
 '/_astro/index.astro_astro_type_script_index_0_lang.qeH_4dqN.js':'aefcd3cc79d2ddda88f82d19e2c13ed673fffe55150ebf46faa14f8a88af73e0',
 '/_astro/jobs.DJ2Uc_2G.js':'902392df437cb768b4eb47b6f7205bb08830ffd7a4822a71507f3add33521d91',
 '/_astro/job-post.astro_astro_type_script_index_0_lang.CUhHac-2.js':'1d3c15f4ce4c9aef7e0874168440be8f029708e003ea24138b063e04e3b8ba9c',
}
const hubProgram=Object.keys(programs)[0],roleProgram=Object.keys(programs)[2]
const need=(ok,message)=>{if(!ok)throw Object.assign(Error('Botminds current public API: '+message),{abortRetries:true,failureKind:'parser_or_contract_error'})}
const sha=body=>createHash('sha256').update(body).digest('hex')
const stable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v)
const documentAt=(html,program,role=false)=>{
 const doc=readNativeDocument(html),head=activeHead(html)
 need(head.metas.some(m=>m.property==='og:site_name'&&m.content==='Botminds'),'employer identity changed')
 const org=doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').some(n=>{try{const m=JSON.parse(n.raw);return m['@type']==='Organization'&&m.name==='Botminds'&&m.url===ORIGIN}catch{return false}})
 need(org,'native employer Organization missing')
 const declared=doc.nodes(n=>n.tag==='script'&&n.attrs.src===program&&n.attrs.type==='module')
 need(declared.length===1,'declared public client program changed')
 if(role)need(doc.nodes(n=>n.attrs.id==='jp-body').length===1&&doc.nodes(n=>n.tag==='h1'&&doc.text(n)==='Open role').length===1,'native role renderer container changed')
 else need(doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'&&n.attrs.href===HUB).length===1&&doc.nodes(n=>n.attrs.id==='jobs').length===1,'canonical public inventory container changed')
 return doc
}
export const declaresBotmindsPublicApi=html=>readNativeDocument(html).nodes(n=>n.tag==='script'&&n.attrs.src===hubProgram&&n.attrs.type==='module').length===1
const date=value=>typeof value==='string'&&/^\d{4}-\d\d-\d\d$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value
const names=new Intl.DisplayNames(['en'],{type:'region',fallback:'none'})
const country=code=>typeof code==='string'&&/^[A-Z]{2}$/.test(code)&&!['ZZ','XA','XB','EU','UN','QO'].includes(code)?names.of(code)||null:null
const readFeed=payload=>{
 need(payload&&Object.keys(payload).length===1&&Array.isArray(payload.items)&&payload.items.length<=200,'public full inventory envelope changed')
 const keys=['slug','title','summary','department','country','city','workplace','employment','experience','pay','featured','datePosted','updatedAt','body'],ids=new Set()
 for(const row of payload.items){
  need(row&&Object.keys(row).every(k=>keys.includes(k))&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug||'')&&!ids.has(row.slug)&&typeof row.title==='string'&&row.title.trim(),'missing or duplicate role identity')
  need(typeof row.body==='string'&&row.body.length>=800&&/^## What you.ll do$/m.test(row.body)&&/^## (?:What you bring|Who we.re looking for)$/m.test(row.body),'full native responsibilities and criteria unavailable')
  need(date(row.datePosted)&&typeof row.updatedAt==='string'&&Number.isFinite(Date.parse(row.updatedAt)),'original native publication date missing or malformed')
  need(['FULL_TIME','PART_TIME','CONTRACTOR','INTERN'].includes(row.employment)&&typeof row.city==='string'&&typeof row.country==='string'&&typeof row.featured==='boolean','native employment or worksite model changed')
  ids.add(row.slug)
 }
 return payload.items
}
export async function runBotmindsPublicApi(initialHTML,options={}){
 const signal=AbortSignal.any([AbortSignal.timeout(options.timeoutMs??90000),...(options.signal?[options.signal]:[])]),receipts=[]
 const read=async(url,kind='html')=>{
  signal.throwIfAborted();const response=await (options.fetchImpl||fetch)(url,{redirect:'manual',signal:AbortSignal.any([signal,AbortSignal.timeout(20000)]),headers:{'User-Agent':'JobverifyScraper/1.0',Accept:kind==='json'?'application/json':kind==='js'?'text/javascript,application/javascript':'text/html'}})
  if(response.status!==200){await response.body?.cancel();throw Object.assign(Error('Botminds public HTTP '+response.status),{status:response.status,abortRetries:true,failureKind:[401,403,406,429].includes(response.status)?'blocked_or_access_denied':'network_or_timeout'})}
  need(response.url===url,'public response URL identity changed')
  need((kind==='json'?/^application\/json\b/i:kind==='js'?/^(?:text|application)\/javascript\b/i:/^text\/html\b/i).test(response.headers.get('content-type')||''),'native '+kind+' MIME changed')
  const body=await response.text();signal.throwIfAborted();need(Buffer.byteLength(body)<=1000000,'public response budget exceeded')
  receipts.push({url,status:response.status,sha256:sha(body)});return kind==='json'?JSON.parse(body):body
 }
 documentAt(initialHTML,hubProgram)
 for(const [program,digest]of Object.entries(programs)){const body=await read(ORIGIN+program,'js');need(sha(body)===digest,'unreviewed complete public renderer/client program')}
 const opening=readFeed(await read(API,'json'))
 const details=async()=>{
  for(const row of opening){documentAt(await read(HUB+'/'+row.slug),roleProgram,true)
   const payload=await read(API+'?slug='+encodeURIComponent(row.slug),'json')
   need(payload&&Object.keys(payload).length===1&&stable(payload.job)===stable(row),'listing and native detail role identity, country or full criteria changed')
  }
 }
 await details();await details()
 const closing=readFeed(await read(API,'json'));need(stable(opening)===stable(closing),'closing full native inventory or criteria changed')
 documentAt(await read(HUB),hubProgram)
 const unknown=opening.filter(row=>!country(row.country)),selected=opening.filter(row=>country(row.country)==='India')
 const cap=options.maxJobs??selected.length;need(Number.isSafeInteger(cap)&&cap>=0,'invalid caller result cap')
 const complete=!unknown.length&&cap>=selected.length
 const jobs=selected.slice(0,cap).map(row=>({source:'botminds',company:'Botminds',jobId:row.slug,requisitionId:null,title:row.title,
  sourceUrl:HUB+'/'+row.slug,applyUrl:HUB+'/apply?role='+encodeURIComponent(row.slug),link:HUB+'/'+row.slug,
  country:'India',city:row.city||null,location:[row.city,'India'].filter(Boolean).join(', '),department:row.department||null,
  employmentType:{FULL_TIME:'Full-time',PART_TIME:'Part-time',CONTRACTOR:'Contract',INTERN:'Internship'}[row.employment],
  workplaceType:{onsite:'On-site',hybrid:'Hybrid',remote:'Remote'}[row.workplace]||null,experienceRequired:row.experience||null,
  postingDate:row.datePosted,closingDate:null,jobDescription:row.body,sourceDescription:row.body,
  sourceNativeApiRecord:structuredClone(row),sourceCountryEvidence:'role-owned public API country; exact native renderer schema country binding',
  sourceDetailComplete:true,sourceListingComplete:complete,sourceScopeComplete:false,lifecycleCleanupAllowed:false,scrapedAt:new Date().toISOString()}))
 const audit={source:'botminds',nativeRoleCount:opening.length,nativeIndiaRoleCount:selected.length,unresolvedNativeCountries:unknown.map(r=>r.slug),
  opening,closing,closingFullCriteriaReconciled:true,publicRoleDetailPasses:2,receipts,sourceScopeComplete:false,lifecycleCleanupAllowed:false}
 if(jobs.length)jobs[0].nativeCollectionEvidence=audit
 options.onAudit?.(audit)
 return attachInventoryEvidence(jobs,{status:complete?'complete-inventory':'coverage-gap',surface:API,firstParty:true,listingComplete:complete,
  reportedTotal:opening.length,indiaFacetCount:unknown.length?null:selected.length,pagesFetched:receipts.length+1,verifiedAt:new Date().toISOString(),
  reason:'current-declared-public-client-and-complete-native-role-criteria;two-detail-passes-and-closing-feed;company-scope-unqualified'})
}
