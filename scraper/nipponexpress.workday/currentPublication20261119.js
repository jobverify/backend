import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {setTimeout as delay} from 'node:timers/promises'
import {nativeCountryName,nativeLocationCountryName,nativeDate} from '../../scraper-support/shared/nativeJobPosting.js'
import {findExplicitNativeClosure} from '../../scraper-support/utils/sourceAvailability.js'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const source='nipponexpress',company='Nippon Express',origin='https://www.nipponexpress.com'
const home=origin+'/',careers=origin+'/careers/',listing=origin+'/careers/jobs/',contact=origin+'/form/special/global_career_south_asia/'
const norm=value=>String(value??'').replace(/\s+/g,' ').trim()
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const need=(ok,message)=>{if(!ok)throw Object.assign(Error('[nipponexpress] current publication: '+message),{abortRetries:true,failureKind:'parser_or_contract_error'})}
const one=(rows,label)=>{need(rows.length===1,'unique '+label+' unavailable');return rows[0]}
const key=row=>JSON.stringify([row.title,row.fields.Company,row.fields.Country,row.application?.url])
const employerMatches=value=>norm(value).replace(/\.$/,'').toUpperCase()==='NIPPON EXPRESS (INDIA) PRIVATE LIMITED'
const path=value=>new URL(value,origin).href.replace(/\/$/,'')
const live=node=>!node.inactive
const descendants=(node,predicate)=>!live(node)?[]:[...(predicate(node)?[node]:[]),...node.children.filter(x=>typeof x!=='string').flatMap(x=>descendants(x,predicate))]

function declaresLink(html,from,to){
 const d=document(html)
 need(!d.nodes(n=>n.tag==='base').length,'unqualified publisher base URL')
 need(d.nodes(n=>n.tag==='a'&&n.attrs.href).some(n=>{
  try{const u=new URL(n.attrs.href,from);return !u.username&&!u.password&&!u.search&&!u.hash&&path(u.href)===path(to)}catch{return false}
 }),'current own careers handoff unavailable')
}

export function readNipponPublishedCards(html){
 const d=document(html)
 need(!d.nodes(n=>n.tag==='base').length,'unqualified listing base URL')
 need(d.nodes(n=>/^h[1-2]$/.test(n.tag)).some(n=>d.text(n)==='Career Search'),'own current vacancy listing unavailable')
 const nodes=d.nodes(n=>d.hasClass(n,'cardJob'))
 need(nodes.length>0&&nodes.length<=1000,'native publication cards unavailable; zero not certified')
 return nodes.map(node=>{
  const titles=descendants(node,n=>d.hasClass(n,'cardJobTtl')),fields={},fieldRows=[]
  let malformed=titles.length!==1
  for(const row of descendants(node,n=>d.hasClass(n,'cardJobInfoRow'))){
   const heads=descendants(row,n=>d.hasClass(n,'cardJobInfoHead')),values=descendants(row,n=>d.hasClass(n,'cardJobInfoTxt'))
   if(heads.length!==1||values.length!==1){malformed=true;continue}
   const label=d.text(heads[0]),value=d.text(values[0]);if(Object.hasOwn(fields,label))malformed=true
   fields[label]=value;fieldRows.push({label,value,originalHTML:d.outer(row)})
  }
  const descriptions=descendants(node,n=>d.hasClass(n,'cardJobTxt')),anchors=descendants(node,n=>n.tag==='a'&&n.attrs.href)
  let application=null
  if(anchors.length===1){const a=anchors[0];try{application={url:new URL(a.attrs.href,listing).href,label:d.text(a),attrs:a.attrs,disabled:Object.hasOwn(a.attrs,'disabled')||a.attrs['aria-disabled']==='true'}}catch{malformed=true}}
  return{title:titles.length===1?d.text(titles[0]):null,fields,fieldRows,description:descriptions.map(d.text).filter(Boolean).join('\n\n')||null,
   originalDescriptionHTML:descriptions.map(d.outer),application,originalHTML:d.outer(node),scopedText:d.text(node),malformed}
 })
}

function contactHandoff(html){
 const d=document(html),id='webform-submission-global-career-south-asia-add-form'
 need(d.nodes(n=>/^h[1-2]$/.test(n.tag)&&d.text(n)==='Recruitment Inquiries').length===1,'native recruitment contact heading unavailable')
 const form=one(d.nodes(n=>n.tag==='form'&&n.attrs.id===id),'native recruitment contact form')
 need(form.attrs.method==='post'&&new URL(form.attrs.action,contact).href===contact,'native contact form target changed')
 need(!Object.hasOwn(form.attrs,'disabled')&&form.attrs['aria-disabled']!=='true'&&!d.nodes(n=>n.tag==='fieldset'&&Object.hasOwn(n.attrs,'disabled'),form).length,'native contact form disabled')
 const privacy=one(d.nodes(n=>n.tag==='input'&&n.attrs.name==='privacy_agree',form),'native consent gate')
 const next=one(d.nodes(n=>n.tag==='button'&&n.attrs.type==='submit'&&n.attrs.name==='op',form),'native consent continuation')
 need(privacy.attrs.type==='checkbox'&&Object.hasOwn(privacy.attrs,'required')&&!Object.hasOwn(privacy.attrs,'disabled')&&privacy.attrs['aria-disabled']!=='true'&&!Object.hasOwn(next.attrs,'disabled')&&next.attrs['aria-disabled']!=='true','native contact consent gate disabled')
 need(!findExplicitNativeClosure([d.text(form)]),'native recruitment contact closed')
 return{url:contact,nativeFormId:id,method:'post',nativeTarget:contact,consentControl:{name:privacy.attrs.name,type:privacy.attrs.type,required:true},
  continuation:{name:next.attrs.name,type:next.attrs.type,label:d.text(next)},kind:'publisher-declared-regional-recruitment-contact-consent-gate',
  rolePreselectionVerified:false,fullControlsQualified:false,opaqueFormStateClosingVerified:false,backendActivationVerified:false,applicationSubmitted:false}
}

function scopedConstraints(row,now){
 need(!findExplicitNativeClosure([row.scopedText]),'native role explicitly closed')
 const dates={publications:[],expiries:[]}
 const constraint=(label,value)=>{
  if(/^(?:status|job status|publication status|availability)$/i.test(label))need(/^(?:open|active|published|available)$/i.test(value),'native publication status unavailable')
  if(/^(?:closing date|application deadline|valid through|expiry date|expiration date)$/i.test(label)&&value){
   const date=nativeDate(value,{required:true});need(date.exact?Date.parse(date.iso)>=+now:date.iso.slice(0,10)>=now.toISOString().slice(0,10),'native role expired');dates.expiries.push({label,...date})
  }
  if(/^(?:date posted|posted date|publication date|published date)$/i.test(label)&&value){const date=nativeDate(value,{required:true});need(Date.parse(date.iso)<=+now,'native publication in future');dates.publications.push({label,...date})}
  if(/^(?:(?:job|work|workplace)\s+)?country$/i.test(label))need(nativeCountryName(value)==='India'||label==='Country'&&nativeLocationCountryName(value)==='India','native additional country conflict')
  if(/^(?:(?:job|work)\s+)?(?:workplace|location)$/i.test(label)){const country=nativeLocationCountryName(value);need(!country||country==='India','native additional workplace conflict')}
  if(/^(?:company|company name|employer|legal employer|hiring organization)$/i.test(label))need(employerMatches(value),'native additional employer conflict')
 }
 for(const [label,value] of Object.entries(row.fields))constraint(label,value)
 const d=document((row.originalDescriptionHTML||[]).join('\n'))
 for(const value of d.nodes(n=>['p','li','h1','h2','h3','h4','strong','b'].includes(n.tag)).map(d.text)){
  const labelled=/^([^:]{1,40})\s*:\s*(.+)$/.exec(value);if(labelled)constraint(norm(labelled[1]),norm(labelled[2]))
  const country=/^(?:(?:job|work|workplace)\s+)?country\s*:\s*(.+)$/i.exec(value)
  if(country)need(nativeCountryName(country[1])==='India','native criteria country conflict')
  const place=/^(?:(?:job|work)\s+)?(?:location|workplace)\s*:\s*(.+)$/i.exec(value)
  if(place){const country=nativeLocationCountryName(place[1]);need(!country||country==='India','native criteria workplace conflict')}
  const employer=/^(?:employer|hiring organization|legal employer|company(?: name)?)\s*:\s*(.+)$/i.exec(value)
  if(employer)need(employerMatches(employer[1]),'native criteria employer conflict')
 }
 dates.expiries.sort((a,b)=>a.iso.localeCompare(b.iso));dates.publications.sort((a,b)=>a.iso.localeCompare(b.iso));return dates
}

export function projectNipponPublishedCard(row,{handoff,observedAt=new Date().toISOString()}={}){
 const now=new Date(observedAt);need(Number.isFinite(+now),'invalid observation clock')
 need(row&&!row.malformed&&norm(row.title)&&norm(row.fields?.Category)&&norm(row.fields.Country)&&norm(row.fields.Company),'native role fields malformed or unavailable')
 need(employerMatches(row.fields.Company),'native employer outside exact configured Nippon Express India scope')
 const location=row.fields.Country
 need(nativeLocationCountryName(location)==='India','native job workplace outside verified India scope')
 for(const part of location.split(/[,;/|&]|\s+and\s+/i)){
  const country=nativeCountryName(norm(part));need(!country||country==='India','native mixed-country workplace')
  need(!/^(?:USA|U\.?S\.?A?\.?|United States of America)$/i.test(norm(part)),'native foreign workplace country')
 }
 need(row.application?.url===contact&&row.application.label==='Contact'&&!row.application.disabled&&handoff?.url===contact,'native current role Contact handoff unavailable')
 const dates=scopedConstraints(row,now)
 return{source,company,title:row.title,jobId:null,requisitionId:null,nativeHiringOrganization:row.fields.Company,nativeLegalEmployer:row.fields.Company,
  country:'India',location,city:null,state:null,department:row.fields.Category,sourceUrl:listing,applyUrl:contact,link:listing,
  sourceDescription:row.description,jobDescription:row.description,sourceNativeCard:row,sourceNativeWorkplaceField:{label:'Country',value:location},
  sourceNativeIdentity:{kind:'publisher-authored-title-employer-workplace-and-contact-tuple',title:row.title,employer:row.fields.Company,workplace:location,nativeJobId:null},
  sourceNativeApplication:handoff,nativeRolePreselectionVerified:false,backendApplicationActivationVerified:false,applicationSubmitted:false,
  postingDate:dates.publications[0]?.raw??null,closingDate:dates.expiries[0]?.raw??null,sourceNativeDates:dates,
  sourceDetailComplete:false,sourceDetailStatus:'partial',sourceDetailFailureKind:'authored-vacancy-card-and-regional-Contact-gate-only-full-criteria-and-application-controls-unverified',
  employmentType:null,experienceRequired:null,minimumQualification:null,preferredQualification:null,requiredSkills:[],
  sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,sourceCountryScopeUnresolved:false,scrapedAt:observedAt}
}

export async function runNipponCurrentPublication(options={}){
 options.signal?.throwIfAborted();need(!options.fetchText&&!options.fetchJson&&!options.fetchPage,'metadata-free callback transport unavailable')
 const nativeFetch=options.fetchImpl??globalThis.fetch,allowed=new Set([home,careers,listing,contact]),raw=[]
 const timeoutMs=options.timeoutMs??180000,interval=options.requestIntervalMs??1000
 need(Number.isSafeInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=180000&&Number.isSafeInteger(interval)&&interval>=0&&interval<=10000,'invalid bounded source limits')
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(Error('Nippon source deadline exceeded')),timeoutMs)
 const io={signal:options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal,close(){clearTimeout(timer);controller.abort()}}
 let requests=0,bytes=0,lastRead=0
 const read=async url=>{
  io.signal.throwIfAborted();need(allowed.has(url)&&++requests<=8,'request outside bounded current first-party contract')
  const wait=interval-(Date.now()-lastRead);if(wait>0)await delay(wait,undefined,{signal:io.signal});lastRead=Date.now()
  const packet=await boundedDeclaredPublicRead(url,{signal:io.signal,timeoutMs:20000,overflowError:Error('Nippon response hard byte limit'),fetchImpl:async(u,init)=>{
   const r=await nativeFetch(u,{...init,credentials:'omit'})
   try{
    need(r?.url===u&&r.redirected===false&&Number.isInteger(r.status)&&r.headers?.get&&r.body,'native HTTP metadata unavailable')
    if(r.status!==200)throw Object.assign(Error('Nippon current public handoff HTTP '+r.status),{status:r.status,publicReadFailure:true})
    need(/^text\/html(?:\s*;|$)/i.test(r.headers.get('content-type')??''),'native HTML MIME unavailable')
    return r
   }catch(error){try{Promise.resolve(r?.body?.cancel(error)).catch(()=>{})}catch{}throw error}
  }})
  const body=Buffer.from(packet.bodyBase64,'base64');bytes+=body.length
  // The shared reader caps streamed bodies at16MiB; these smaller publication
  // limits apply after that bounded read, before decoding/parsing.
  need(body.length<=1024*1024&&bytes<=8*1024*1024,'native publication byte cap exceeded')
  const html=new TextDecoder('utf-8',{fatal:true}).decode(body);raw.push({url,originalHTML:html});return html
 }
 const phase=async()=>{
  declaresLink(await read(home),home,careers)
  declaresLink(await read(careers),careers,listing)
  const cards=readNipponPublishedCards(await read(listing)),handoff=contactHandoff(await read(contact))
  return{cards,handoff}
 }
 try{
  const opening=await phase(),closing=await phase(),jobs=[],held=[],observedAt=(options.now??(()=>new Date().toISOString()))()
  const opened=new Map(),closed=new Map()
  for(const row of opening.cards)opened.set(key(row),(opened.get(key(row))??[]).concat(row))
  for(const row of closing.cards)closed.set(key(row),(closed.get(key(row))??[]).concat(row))
  for(const row of opening.cards){try{
   need(opened.get(key(row)).length===1&&closed.get(key(row))?.length===1,'native publication tuple changed or duplicate identity ambiguous')
   const current=closed.get(key(row))[0];need(equal(row,current),'native closing whole authored card changed')
   const job=projectNipponPublishedCard(row,{handoff:opening.handoff,observedAt}),closingJob=projectNipponPublishedCard(current,{handoff:closing.handoff,observedAt})
   need(equal(job,closingJob),'native closing role/contact handoff changed');job.sourceClosingQualified=true;jobs.push(job)
  }catch(error){held.push({reason:error.message,originalCard:row,closingCards:closed.get(key(row))??[]})}}
  const audit={source,openingCards:opening.cards,closingCards:closing.cards,openingContactHandoff:opening.handoff,closingContactHandoff:closing.handoff,held,originalResponses:raw,
   sourceScopeComplete:false,companyIndiaTotal:null,companyGlobalTotal:null,lifecycleCleanupAllowed:false,allNativeJobIdsUnavailable:true,rolePreselectionVerified:false,backendApplicationActivationVerified:false,applicationSubmitted:false}
  const result=Number.isSafeInteger(options.maxJobs)&&options.maxJobs>=0?jobs.slice(0,options.maxJobs):jobs
  attachSourceObservationEvidence(result,{source,recordKind:'vacancy-rows',observedRecordCount:opening.cards.length,observedVacancyCount:opening.cards.length,sourceScopeComplete:false,companyIndiaTotal:null,companyGlobalTotal:null})
  Object.defineProperty(result,'nativeCollectionEvidence',{value:audit,configurable:true})
  if(options.onAudit){let listener;try{await Promise.race([Promise.resolve().then(()=>options.onAudit(structuredClone(audit))),new Promise((_,reject)=>{listener=()=>reject(io.signal.reason);io.signal.addEventListener('abort',listener,{once:true});if(io.signal.aborted)listener()})])}finally{if(listener)io.signal.removeEventListener('abort',listener)}}
  io.signal.throwIfAborted()
  return attachInventoryEvidence(result,{status:'coverage-gap',surface:listing,firstParty:true,pagesFetched:raw.length,listingComplete:false,reportedTotal:null,indiaFacetCount:null,verifiedAt:observedAt,
   reason:'current-own-exact-employer-India-vacancy-cards-and-declared-regional-Contact-gate-closing-qualified;full-criteria-native-IDs-application-controls-group-inventory-and-cleanup-unverified'})
 }finally{io.close()}
}
