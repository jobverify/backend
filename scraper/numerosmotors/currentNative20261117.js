import {createHash} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import {setTimeout as delay} from 'node:timers/promises'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {requireNativeHttpResponse} from '../../scraper-support/shared/nativeHttpResponse.js'
import {disposeResponseBody} from '../../scraper-support/shared/responseBodyDisposal.js'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const SOURCE='numerosmotors',HOME='https://numerosmotors.com/',CAREERS=HOME+'careers/',POSITIONS=HOME+'open-positions/'
const CSS=HOME+'wp-content/litespeed/ucss/c5820cd43ed430de48aa9adb89a66cc2.css?ver=9f908',JS=HOME+'wp-content/litespeed/js/16735a319a0d4534cfe017d1d7981ecb.js?ver=9f908'
const PROGRAM=[{url:CSS,kind:'stylesheet',sha256:'959a70e574164fe47d64f9cad930b506dac282e43cf8504940c1c6cacdf149f6'},{url:JS,kind:'program',sha256:'47fe8ebb2850843370625959b8c018c51bb4b7955adfafc5bbab6fdd41fe3be9'}]
const viewports=['widescreen','desktop','laptop','tablet_extra','tablet','mobile_extra','mobile']
const fail=message=>firstPartyFailure(SOURCE,message),need=(ok,message)=>{if(!ok)throw fail(message)},sha=b=>createHash('sha256').update(b).digest('hex')
const holds=['native-role-country-unpublished;corporate-Bengaluru-and-title-cities-not-role-country-proof','title-and-experience-only;full-native-job-criteria-unavailable','native-visibility-and-activation-unqualified;responsive-hidden-cards-not-confirmed-vacancies','generic-resume-popup;own-role-application-rendering-unqualified','native-posting-date-unpublished','employer-wide-inventory-scope-unproved']
function authority(html,url){
 const doc=readNativeDocument(html),root=doc.nodes(n=>n.tag==='root')[0],head=activeHead(html),canonical=doc.nodes(n=>n.tag==='link'&&(n.attrs.rel??'').split(/\s+/).includes('canonical'))
 const titles=url===HOME?['Home page - Numeros Motors','We Are Inventors - Section','Connect with Trusted Dealers - Numeros','FAQ - Have Questions?']:url===CAREERS?['Careers - Numeros Motors']:['Open Positions - Numeros Motors']
 need(isDeepStrictEqual(head.titles,titles)&&canonical.length===1&&canonical[0].attrs.href===url&&!doc.nodes(n=>n.tag==='base').length,'current exact corporate publisher title/canonical/base changed')
 const links=doc.nodes(n=>n.tag==='a'&&typeof n.attrs.href==='string').map(n=>({attrs:n.attrs,text:doc.text(n)}))
 if(url===HOME)need(links.some(l=>new URL(l.attrs.href,HOME).href===CAREERS&&l.text==='Careers'),'current corporate careers declaration unavailable')
 if(url===CAREERS)need(links.filter(l=>l.text==='Click to See Open Positions & Apply'&&[POSITIONS,POSITIONS.slice(0,-1)].includes(new URL(l.attrs.href,CAREERS).href)).length===1,'current own positions handoff changed')
 return {doc,root,head,canonical:canonical[0],links}
}
function positions(html){
 const {doc,root,head,canonical,links}=authority(html,POSITIONS),pages=doc.nodes(n=>n.attrs['data-elementor-type']==='wp-page'&&n.attrs['data-elementor-id']==='13323')
 need(pages.length===1,'current native WordPress publisher identity changed')
 const page=pages[0],heading=n=>n.tag==='h4'&&doc.hasClass(n,'elementor-icon-box-title'),all=doc.nodes(heading,page),sections=doc.nodes(n=>n.tag==='section'&&doc.nodes(heading,n).length>0,page),seen=new Set()
 need(sections.length>0&&sections.length<=100&&sections.length===all.length,'complete native authored card cohort unavailable or ambiguous')
 const cards=sections.map(section=>{
  const id=section.attrs['data-id'],titles=doc.nodes(heading,section),briefs=doc.nodes(n=>n.tag==='p'&&doc.hasClass(n,'elementor-icon-box-description'),section),triggers=doc.nodes(n=>doc.hasClass(n,'popmake-14016'),section),apply=doc.nodes(n=>n.tag==='a'&&doc.text(n)==='Apply Now',section)
  need(/^[a-f0-9]{7}$/.test(id??'')&&!seen.has(id)&&titles.length===1&&briefs.length===1&&triggers.length===1&&apply.length===1,'native card/trigger identity or full section binding changed');seen.add(id)
  const title=doc.text(titles[0]),brief=doc.text(briefs[0]);need(title&&title.length<=500&&brief&&brief.length<=2000,'native title/experience brief unavailable')
  const classes=(section.attrs.class??'').split(/\s+/)
  return {nativeSectionId:id,title,nativeBriefText:doc.text(section),nativeExperienceText:brief,allConfiguredViewportClassesHidden:viewports.every(v=>classes.includes('elementor-hidden-'+v)),nativeSectionModel:section}
 })
 const popups=doc.nodes(n=>n.attrs.id==='pum-14016'),popupPrograms=doc.nodes(n=>n.tag==='script'&&n.attrs.id==='popup-maker-site-js-extra'),forms=popups.length===1?doc.nodes(n=>n.tag==='form',popups[0]):[]
 need(popups.length===1&&forms.length===1&&popupPrograms.length===1,'complete declared generic career popup unavailable')
 const fields=doc.nodes(n=>n.tag==='input'&&n.attrs.name==='your-subject',forms[0]),formIDs=doc.nodes(n=>n.tag==='input'&&n.attrs.name==='_wpcf7',forms[0])
 need(forms[0].attrs.action==='/open-positions/#wpcf7-f13986-o1'&&forms[0].attrs.method==='post'&&fields.length===1&&fields[0].attrs.value===''&&formIDs.length===1&&formIDs[0].attrs.value==='13986','own generic resume form identity changed')
 need(doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='stylesheet'&&n.attrs['data-optimized']==='2'&&n.attrs.href===CSS).length===1&&doc.nodes(n=>n.tag==='script'&&n.attrs['data-optimized']==='1'&&n.attrs['data-src']===JS).length===1,'exact native stylesheet/program declaration changed')
 return {head,canonical,links,nativeWordPressPageId:'13323',cards,application:{popupModel:popups[0],formModel:forms[0],positionFieldModel:fields[0],inlinePopupProgram:popupPrograms[0]},wholeRawPublisherModel:root}
}
export async function readCurrentNumeros(options={}){
 options.signal?.throwIfAborted();need(!options.fetchText&&!options.fetchJson&&!options.fetchPage,'original HTTP metadata required; body-only callbacks cannot certify current native cards')
 const sourceMs=options.sourceTimeoutMs??90000,readMs=options.requestTimeoutMs??15000,interval=options.requestIntervalMs??500,maxJobs=options.maxJobs??100
 need(Number.isSafeInteger(sourceMs)&&sourceMs>0&&sourceMs<=180000&&Number.isSafeInteger(readMs)&&readMs>0&&readMs<=15000&&Number.isSafeInteger(interval)&&interval>=0&&interval<=5000&&(options.fetchImpl||interval>=500)&&Number.isSafeInteger(maxJobs)&&maxJobs>=0&&maxJobs<=100,'invalid native limits')
 const jobs=[],verifiedAt=typeof options.now==='function'?options.now():new Date().toISOString();need(Number.isFinite(Date.parse(verifiedAt)),'invalid observation clock')
 const inventory=(reason,reads)=>attachInventoryEvidence(jobs,{status:'coverage-gap',surface:POSITIONS,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:reads,reportedTotal:null,indiaFacetCount:null,verifiedAt,reason})
 if(maxJobs===0)return inventory('caller-zero-cap;native-inventory-unobserved',0)
 const owner=new AbortController(),started=performance.now(),reason=new DOMException('Numeros native source deadline exceeded','TimeoutError'),timer=setTimeout(()=>owner.abort(reason),sourceMs),signal=options.signal?AbortSignal.any([options.signal,owner.signal]):owner.signal,receipts=[]
 let next=0,total=0
 const check=()=>{options.signal?.throwIfAborted();if(performance.now()-started>=sourceMs&&!owner.signal.aborted)owner.abort(reason);signal.throwIfAborted()}
 const read=async url=>{
  check();need([HOME,CAREERS,POSITIONS,CSS,JS].includes(url)&&receipts.length<10,'unbound or excessive native read')
  if(next>performance.now())try{await delay(next-performance.now(),undefined,{signal})}catch(error){check();throw error}
  check();next=performance.now()+interval
  const receipt={requestedURL:url,method:'GET',requestedAt:new Date().toISOString(),bodyComplete:false};receipts.push(receipt);let observedHTTPError
  try{
   const response=await boundedDeclaredPublicRead(url,{signal,timeoutMs:readMs,overflowError:fail('original native16MiB response ceiling exceeded'),fetchImpl:async(requested,init)=>{
    const acquired=await(options.fetchImpl??globalThis.fetch)(requested,{...init,credentials:'omit',cache:'no-store'})
    try{
     options.signal?.throwIfAborted();Object.assign(receipt,{status:acquired.status,finalURL:acquired.url,headers:Object.fromEntries(acquired.headers)})
     try{await requireNativeHttpResponse({status:acquired.status,url:acquired.url,headers:acquired.headers,body:null},requested,{context:'Numeros current native read',signal:init.signal,callerSignal:options.signal??null})}
     catch(error){observedHTTPError=error;throw error}
     return acquired
    }catch(error){disposeResponseBody(acquired,{bestEffort:true}).catch(()=>{});throw error}
   }})
   check();const bytes=Buffer.from(response.bodyBase64,'base64');total+=bytes.length;Object.assign(receipt,{bodyComplete:true,bodyBytes:bytes.length,bodySHA256:sha(bytes)})
   need(total<=32*1024*1024,'aggregate native32MiB byte ceiling exceeded')
   const mime=response.headers['content-type']??'',pattern=url===CSS?/^text\/css(?:;|$)/i:url===JS?/^(?:application|text)\/(?:x-)?(?:java|ecma)script(?:;|$)/i:/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i
   need(pattern.test(mime),'original native MIME changed');return {text:new TextDecoder('utf8',{fatal:true}).decode(bytes),sha256:receipt.bodySHA256}
  }catch(error){options.signal?.throwIfAborted();if(observedHTTPError)throw observedHTTPError;check();throw error}
  finally{receipt.completedAt=new Date().toISOString()}
 }
 const readAssets=async()=>{const models=[];for(const p of PROGRAM){const original=await read(p.url);need(original.sha256===p.sha256,'whole declared native '+p.kind+' changed');models.push({url:p.url,sha256:original.sha256})}return models}
 const readPages=async()=>{
  const home=authority((await read(HOME)).text,HOME),career=authority((await read(CAREERS)).text,CAREERS),current=positions((await read(POSITIONS)).text)
  return {home:{head:home.head,canonical:home.canonical,links:home.links,wholeRawPublisherModel:home.root},careers:{head:career.head,canonical:career.canonical,links:career.links,wholeRawPublisherModel:career.root},...current}
 }
 try{
  const opening=await readPages(),programs=await readAssets(),closingPrograms=await readAssets(),closing=await readPages()
  need(isDeepStrictEqual(opening.cards,closing.cards),'whole raw authored card cohort changed at closing')
  need(isDeepStrictEqual(opening.application,closing.application),'complete native popup/form model changed at closing')
  const rawFullPublisherModelsClosingReconciled=isDeepStrictEqual(opening,closing)&&isDeepStrictEqual(programs,closingPrograms)
  const observations=opening.cards.map(card=>({...structuredClone(card),source:SOURCE,company:'Numeros Motors',jobId:'numeros-13323-'+card.nativeSectionId,country:null,location:null,city:null,sourceUrl:POSITIONS,applyUrl:POSITIONS,
   jobDescription:null,sourceDetailComplete:false,sourceDetailStatus:'native-title-experience-brief-only',sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,recordKind:'hiring-signals',qualificationHolds:[...holds,...(rawFullPublisherModelsClosingReconciled?[]:['whole-raw-publisher-model-closing-unqualified'])]}))
  const audit={source:SOURCE,recordKind:'hiring-signals',observedRecordCount:observations.length,observedVacancyCount:0,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,lifecycleCleanupAllowed:false,
   observationScope:'all-authored-native-card-sections;includes-hidden-briefs;no-confirmed-current-vacancy-or-country-count',observations,opening,closing,programs,closingPrograms,completeRawCardsClosingReconciled:true,completePopupClosingReconciled:true,
   rawFullPublisherModelsClosingReconciled,closingQualified:false,excludedClosingPaths:[],qualificationHolds:holds,reader:{requests:receipts.length,decodedBytes:total,sourceTimeoutMs:sourceMs,requestTimeoutMs:readMs,requestIntervalMs:interval,receipts}}
  attachSourceObservationEvidence(jobs,audit);Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  inventory('authored-title-experience-hiring-signals-only;visibility/country/full-criteria/application/company-scope-and-closing-unqualified',receipts.length)
  check();return jobs
 }finally{clearTimeout(timer);owner.abort()}
}
