import {readRecruitmentConsumers} from './currentRenderer20261120.js'
import {createHash} from 'node:crypto'
import {decodeHTML} from 'entities'
import {extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {eightfoldDocument,readEightfoldDataCarrier,parseEightfoldJson} from '../../scraper-support/utils/recruitmentEightfoldData.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const OFFICIAL='https://www.st.com/content/st_com/en/about/careers/job-categories.html'
const ORIGIN='https://stmicroelectronics.eightfold.ai',DOMAIN='stmicroelectronics.com',SELECTED=ORIGIN+'/careers?location=India'
const MAP='https://www.st.com/etc.clientlibs/st-crew/components/editorial/crew-industrialization/map/clientlibs.min.3e446492e60150ec26f6161b30b040db.js'
const MAP_SHA='111cc410b1b340f78d3fb2cea118563c438873e201fdd0ebb39b027e6b8a1993'
const INLINE_SHA='3d3b5b9fee46cbc0e7bf9c76b0c2e957586783f5fce3e6a61aba8210f8287cce'
const sha=v=>createHash('sha256').update(v).digest('hex'),text=v=>typeof v==='string'?v.replace(/\s+/gu,' ').trim():''
const object=v=>v&&typeof v==='object'&&!Array.isArray(v)
const stable=value=>JSON.stringify(value,(_,v)=>object(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v)
const need=(ok,message)=>{if(!ok)throw Object.assign(new Error('[stmicroelectronics] '+message),{softFailure:true,abortRetries:true,failureKind:'surface_drift_or_fail_closed'})}
const classIs=(n,c)=>(n.attrs.class||'').split(/\s+/).includes(c)
const javascript=n=>!Object.hasOwn(n.attrs,'nomodule')&&/^(?:|(?:text|application)\/javascript)$/i.test(n.attrs.type||'')
const https=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash?u:null}catch{return null}}

function corporateOf(page){
 const parsed=eightfoldDocument(page.html),doc=parsed.document
 need(!parsed.entries.some(({node})=>node.tag==='base'),'corporate map base requires review')
 need(doc.nodes(n=>n.tag==='title').some(n=>/STMicroelectronics/.test(n.raw)),'corporate publisher identity changed')
 const firstEntry=parsed.entries.find(({node})=>classIs(node,'map')),first=firstEntry?.node
 need(first?.tag==='div'&&!first.inert&&!firstEntry.ancestors.some(n=>n.inert||['template','object','svg','math'].includes(n.tag)),'first corporate job map missing or unqualified')
 // The reviewed client consumes mobile country data to build its popup. The
 // data may be hidden by responsive CSS; the controlling map itself must be
 // the single visible map in the active corporate page.
 const visible=readVisibleNativeDocument(parsed.normalized,{strict:true})
 need(doc.nodes(n=>classIs(n,'map')).length===1&&visible.nodes(n=>classIs(n,'map')).length===1,'corporate job map stylesheet visibility changed')
 const styles=parsed.entries.filter(({node})=>node.tag==='style')
 // The popup anchor is created by the pinned map client. Pin the native
 // inline CSS too: additional rules could hide that future link even while
 // its map and script-consumed country data remain present.
 need(styles.length===1&&Object.keys(styles[0].node.attrs).length===0
  &&sha(styles[0].node.raw)==='49d8e95bd2f0ac878df153cc857d307fae4053d79841a6e6cec213f041af33eb','corporate popup stylesheet contract changed')
 const rows=parsed.entries.filter(({node:n,ancestors})=>n.tag==='div'&&classIs(n,'worldMap--mobile-country-1')
  &&n.attrs['data-country']==='India'&&ancestors.includes(first)&&!n.inert&&!ancestors.some(a=>a.inert))
 need(rows.length===1&&rows[0].node.attrs['data-link']===SELECTED&&doc.text(rows[0].node)==='India'
  &&rows[0].node.attrs['data-cta-text']==='Join one of our teams in India','current corporate India map handoff changed')
 const scripts=doc.nodes(n=>n.tag==='script'&&n.attrs.src&&new URL(n.attrs.src,page.url).href===MAP)
 const inline=doc.nodes(n=>n.tag==='script'&&!n.attrs.src&&/closestCTAMainButtonContainer/.test(n.raw||''))
 need(scripts.length===1&&javascript(scripts[0])&&inline.length===1&&javascript(inline[0])&&sha(inline[0].raw)===INLINE_SHA,'corporate map/CTA client contract changed')
 return {officialURL:OFFICIAL,declaredURL:SELECTED,mapClientURL:MAP,mapClientSHA256:MAP_SHA,
  inlineClientSHA256:INLINE_SHA,nativeAccount:DOMAIN}
}
function modelOf(page){
 const parsed=eightfoldDocument(page.html),m=readEightfoldDataCarrier(page.html,{id:'smartApplyData',mountId:'EFSmartApplyContainer'}).value
 need(!parsed.entries.some(({node})=>node.tag==='base'),'native base URL requires review')
 need(m.domain===DOMAIN&&m.branding?.companyName==='STMicroelectronics'&&m.excludePrivatePositions===true
  &&m.isUserAuthenticated===false&&m.isUserETXCandidate===false&&m.isDomainETX===false&&m.isPcsEnabled===true
  &&m.candidate?.enc_id===0&&m.candidate.email===''&&object(m.loggedInCandidate)&&Object.keys(m.loggedInCandidate).length===0,'native public account/employer changed')
 need(m.query?.query===''&&Number.isSafeInteger(m.count)&&m.count>=0&&m.count<=100000&&Array.isArray(m.positions)
  &&m.positions.length<=100&&m.positions.length<=m.count,'native public query/positions changed')
 const scripts=parsed.document.nodes(n=>n.tag==='script'&&/smartApply\./.test(n.attrs.src||''))
 need(scripts.length===1,'native classic renderer missing or ambiguous')
 need(javascript(scripts[0]),'native renderer execution mode changed')
 const renderer=https(new URL(scripts[0].attrs.src,ORIGIN).href)
 need(renderer?.origin===ORIGIN&&/^\/gen\/js\/smartApply\.[a-f\d]+\.js$/.test(renderer.pathname)&&!renderer.search,'native renderer authority changed')
 return {model:m,parsed,rendererURL:renderer.href}
}
const roleURL=row=>{
 need(object(row)&&Number.isSafeInteger(row.id)&&row.id>0&&text(row.name)&&row.posting_name===row.name
  &&text(row.ats_job_id)&&text(row.display_job_id)&&row.type==='ATS'&&row.isPrivate===false
  &&Number.isSafeInteger(row.t_create)&&row.t_create>0&&Number.isSafeInteger(row.t_update)&&row.t_update>=row.t_create,'native vacancy identity changed')
 need(row.canonicalPositionUrl===ORIGIN+'/careers/job/'+row.id,'native own vacancy URL changed')
 return row.canonicalPositionUrl
}
const india=row=>typeof row.location==='string'&&Array.isArray(row.locations)&&row.locations.length>0&&row.locations.length<=40
 &&row.locations.includes(row.location)&&row.locations.every(l=>typeof l==='string'&&/, India$/.test(l))
function selectedOf(page,renderer){
 const current=modelOf(page),m=current.model
 need(current.rendererURL===renderer&&m.user===''&&m.query.location==='India'&&m.query.pid===''
  &&Object.entries(m.query).filter(([k])=>!['query','location','pid'].includes(k)).every(([,v])=>Array.isArray(v)&&!v.length),'native selected India query changed')
 const ids=new Set();for(const row of m.positions){roleURL(row);need(!ids.has(row.id),'duplicate native selected vacancy');ids.add(row.id)}
 return current
}
// Every authored character must agree. Only native HTML list and blockquote
// structure may introduce its corresponding schema Markdown decoration.
function criteriaAgree(html,schema){
 const {entries}=eightfoldDocument(html),lists=new Set(),quotes=new Set(),spaces=new Set(),originalSpaces=new Set(),blocks=new Set();let authored=''
 const walk=(n,quoted=false)=>{if(n.inert||n.tag==='script')return
  quoted=quoted||n.tag==='blockquote';if(n.tag==='li')lists.add(authored.length)
  const block=['p','div','br','ul','ol','li','blockquote','h1','h2','h3','h4'].includes(n.tag)
  if(block){spaces.add(authored.length);blocks.add(authored.length);if(quoted)quotes.add(authored.length)}
  for(const c of n.children)if(typeof c!=='string')walk(c,quoted);else for(const char of decodeHTML(c))if(/\s/u.test(char)){spaces.add(authored.length);originalSpaces.add(authored.length)}else authored+=char
  if(block){spaces.add(authored.length);blocks.add(authored.length);if(quoted)quotes.add(authored.length)}
 };walk(entries[0].node)
 let a=0,b=0,spaceAt=-1
 while(a<authored.length||b<schema.length){
  if(/\s/u.test(schema[b]||'')){if(a!==0&&a!==authored.length&&!spaces.has(a))return false;spaceAt=a;b++;continue}
  if(a<authored.length&&authored[a]===schema[b]){if(originalSpaces.has(a)&&!blocks.has(a)&&/[\p{L}\p{N}]/u.test(authored[a-1]||'')&&/[\p{L}\p{N}]/u.test(authored[a])&&spaceAt!==a)return false;a++;b++;continue}
  if(lists.has(a)&&schema[b]==='*'){b++;continue}
  if(quotes.has(a)&&schema[b]==='>'&&/(?:^|\n)[ \t]*$/.test(schema.slice(Math.max(0,b-100),b))){b++;continue}
  if(a<authored.length&&schema[b]==='\\'&&schema[b+1]===authored[a]&&'+-.*_#|[]()'.includes(authored[a])){b++;continue}
  return false
 }return authored.length>=200
}
function roleOf(page,job,insights,row,renderer){
 need(roleURL(job)===roleURL(row)&&['name','posting_name','location','locations','department','business_unit','t_create','t_update','ats_job_id','display_job_id','id_locale','isPrivate']
  .every(k=>stable(job[k])===stable(row[k])),'native full role/listing identity changed')
 need(india(job)&&job.business_unit==='India Business Unit','native explicit India role scope changed')
 const current=modelOf(page),m=current.model
 need(current.rendererURL===renderer&&m.user==='Import '+DOMAIN&&m.query.pid===String(row.id)&&m.positions.length===1
  &&stable(m.positions[0])===stable(row),'native own public role/listing identity changed')
 need(Array.isArray(m.all_applicable_locations)&&m.all_applicable_locations.length===row.locations.length
  &&m.all_applicable_locations.every(l=>l.country==='IN'&&row.locations.includes(l.location))
  &&stable(m.all_applicable_locations.map(l=>l.location).sort())===stable([...row.locations].sort()),'native own typed India country changed')
 const postings=current.parsed.document.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json'&&!n.attrs.src).map(n=>parseEightfoldJson(n.raw))
 const p=postings.length===1?postings[0]:null
 need(p?.['@type']==='JobPosting'&&p.title===row.name&&p.hiringOrganization?.['@type']==='Organization'
  &&p.hiringOrganization.name==='STMicroelectronics'&&p.hiringOrganization.sameAs===DOMAIN,'native own schema employer/title changed')
 const url=https(p.url)
 need(url?.origin===ORIGIN&&url.searchParams.size===1&&url.searchParams.get('domain')===DOMAIN
  &&new RegExp('^/careers/job/'+row.id+'(?:-[a-z0-9-]+)?$').test(url.pathname),'native own schema role URL changed')
 const locations=Array.isArray(p.jobLocation)?p.jobLocation:[p.jobLocation]
 need(locations.length===row.locations.length&&locations.every(l=>l?.['@type']==='Place'&&l.address?.['@type']==='PostalAddress'
  &&l.address.addressCountry?.['@type']==='Country'&&l.address.addressCountry.name==='IN'),'native schema country changed')
 need(stable(locations.map(l=>[text(l.address.addressLocality).normalize('NFKC'),text(l.address.addressRegion).normalize('NFKC')]).sort())
  ===stable(m.all_applicable_locations.map(l=>[text(l.city).normalize('NFKC'),text(l.state).normalize('NFKC')]).sort()),'native schema worksite changed')
 need(typeof job.job_description==='string'&&(extractActiveDescription(job.job_description)?.length||0)>=200
  &&typeof p.description==='string'&&criteriaAgree(job.job_description,p.description),'native/schema authored criteria disagree')
 need(stable(job.custom_JD)==='{"enable":false}'&&object(job.preApplyInfoBanner)&&!Object.keys(job.preApplyInfoBanner).length,'native additional authored criteria require review')
 const population=['skills','companies','schools','degrees','experience_years','seniority','titles','num_veterans','work_categories']
 need(object(insights)&&Object.keys(insights).every(k=>population.includes(k))
  &&population.filter(k=>k!=='num_veterans'&&Object.hasOwn(insights,k)).every(k=>object(insights[k]))
  &&(insights.num_veterans===null||Number.isSafeInteger(insights.num_veterans)&&insights.num_veterans>=0),'native insights description/criteria override requires review')
 need(!Object.hasOwn(job,'apply_redirect_url')&&!Object.hasOwn(insights,'apply_redirect_url'),'native application mode changed')
 return {job,insights,posting:p,originalPublicPage:page}
}

export async function run(options={}){
 const now=options.now||new Date().toISOString();need(Number.isFinite(Date.parse(now)),'invalid observation time')
 const signal=AbortSignal.any([...(options.signal?[options.signal]:[]),AbortSignal.timeout(240000)])
 const receipts=[];let requests=0
 const read=async url=>{
  signal.throwIfAborted();need(++requests<=100,'public native request budget reached')
  const response=await (options.fetchImpl||globalThis.fetch)(url,{redirect:'manual',credentials:'omit',signal:AbortSignal.any([signal,AbortSignal.timeout(20000)]),headers:{Accept:'text/html,application/json,*/*','User-Agent':'Mozilla/5.0'}})
  const html=await response.text();signal.throwIfAborted()
  need(response.status===200&&response.url===url&&Buffer.byteLength(html)<=4*1024*1024,'native public GET identity/status changed')
  const page={url,status:response.status,html};receipts.push({...page,sha256:sha(html)});return page
 }
 const corporate=corporateOf(await read(OFFICIAL))
 need(sha((await read(MAP)).html)===MAP_SHA,'corporate map handoff client changed')
 const opening=modelOf(await read(SELECTED)),renderer=opening.rendererURL
 const rendererPage=await read(renderer),rendererConsumers=readRecruitmentConsumers(rendererPage.html)
 const selected=selectedOf(receipts.find(p=>p.url===SELECTED),renderer),rows=selected.model.positions
 const openURL=ORIGIN+'/api/apply/v2/jobs/open?pids='+rows.map(r=>r.id).join(',')+'&domain='+DOMAIN
 const readOpen=async()=>{const value=parseEightfoldJson((await read(openURL)).html)
  need(object(value)&&Object.keys(value).length===rows.length&&rows.every(r=>typeof value[r.id]==='boolean'),'native current-open response changed');return value}
 need(rows.length>0,'coverage-gap: selected native India observations empty')
 const open=await readOpen(),observations=[],staged=[],held=[]
 for(const row of rows){const record={originalListingRecord:row};observations.push(record)
  if(!india(row)||open[row.id]!==true){held.push({id:row.id,reason:'native explicit India/current-open scope unresolved'});continue}
  const url=roleURL(row),jobURL=ORIGIN+'/api/apply/v2/jobs/'+row.id+'?domain='+DOMAIN,insightURL=ORIGIN+'/api/apply/v2/jobs/'+row.id+'/insights?domain='+DOMAIN
  const page=await read(url),job=parseEightfoldJson((await read(jobURL)).html),insights=parseEightfoldJson((await read(insightURL)).html)
  Object.assign(record,{originalNativeRole:job,originalNativeInsights:insights,originalPublicPage:page})
  try{staged.push({row,url,jobURL,insightURL,detail:roleOf(page,job,insights,row,renderer)})}
  catch(error){if(!error.softFailure)throw error;held.push({id:row.id,reason:error.message})}
 }
 for(const item of staged){const page=await read(item.url),job=parseEightfoldJson((await read(item.jobURL)).html),insights=parseEightfoldJson((await read(item.insightURL)).html)
  const close=roleOf(page,job,insights,item.row,renderer)
  need(stable({job,insights,posting:close.posting})===stable({job:item.detail.job,insights:item.detail.insights,posting:item.detail.posting}),'closing native full role criteria changed')
 }
 const closingOpen=await readOpen(),closing=selectedOf(await read(SELECTED),renderer)
 need(stable(closing.model.positions)===stable(rows)&&closing.model.count===selected.model.count,'closing selected native membership changed')
 const closingRenderer=await read(renderer),closingConsumers=closingRenderer.html===rendererPage.html?rendererConsumers:readRecruitmentConsumers(closingRenderer.html)
 need(stable(closingConsumers)===stable(rendererConsumers)&&sha((await read(MAP)).html)===MAP_SHA
  &&stable(corporateOf(await read(OFFICIAL)))===stable(corporate),'closing native renderer/corporate handoff changed')
 const confirmed=staged.filter(item=>{if(closingOpen[item.row.id])return true;held.push({id:item.row.id,reason:'native role closed before publication'});return false})
 need(confirmed.length>0,'coverage-gap: no fully verified current native India roles')
 const jobs=confirmed.map(({row,detail})=>({source:'stmicroelectronics',company:'STMicroelectronics',title:row.name,jobId:String(row.id),requisitionId:row.display_job_id,
  sourceUrl:row.canonicalPositionUrl,applyUrl:row.canonicalPositionUrl,link:row.canonicalPositionUrl,country:'India',location:row.location,city:row.location.split(',')[0],department:row.department,
  jobDescription:detail.job.job_description,sourceDescription:detail.job.job_description,employmentType:detail.posting.employmentType,
  postingDate:null,closingDate:null,remoteStatus:null,sourcePublicationDateUnavailable:true,sourceNativeOpen:true,
  sourceNativeRecord:detail.job,sourceNativeInsights:detail.insights,sourceNativeJobPosting:detail.posting,sourceNativeEmployerHandoff:corporate,
  nativeDateSemantics:'native create/update and generated schema SEO dates retained; original publication and real application deadline unqualified',
  sourceDetailComplete:true,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,scrapedAt:now,
  companyCareerPage:OFFICIAL,companyDomain:'st.com',atsPlatform:'eightfold-classic'}))
 Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{source:'stmicroelectronics',rendererEvidence:{url:renderer,sha256:sha(rendererPage.html),closingSHA256:sha(closingRenderer.html),fullRawEqual:closingRenderer.html===rendererPage.html,consumers:rendererConsumers,browserExecutionEstablished:false},nativeRecords:observations,heldRecords:held,receipts,reportedSelectedTotal:selected.model.count,
  selectedRowsObserved:rows.length,nativeListingTruncated:rows.length<selected.model.count,sourceScopeComplete:false,lifecycleCleanupAllowed:false}})
 attachSourceObservationEvidence(jobs,{source:'stmicroelectronics',recordKind:'vacancy-rows',observedRecordCount:rows.length,observedVacancyCount:rows.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
 const output=attachInventoryEvidence(jobs,{status:'discovery-only',surface:SELECTED,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:requests,reportedTotal:null,indiaFacetCount:null,verifiedAt:now,
  reason:'current corporate map handoff; native own role/country/full criteria/current-open proof; bounded selected observations, whole-company scope unqualified'})
 options.signal?.throwIfAborted();signal.throwIfAborted();return output
}
export default run
