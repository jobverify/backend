import {createHash} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {currentReader,nativeUnavailable} from './currentRead20261120.js'
import {
 page,need,one,norm,all,disabled,props,authoredLines,constraints,schemas,
 schemaIdentity,schemaPlaces,scalarFields,projection,mergeObservation,nativeCountryName,
} from './currentFacts20261120.js'

const ORIGIN='https://www.sew.ai',LANDING=ORIGIN+'/sew-career'
const C={source:'smartenergywater',company:'Smart Energy Water',publisher:'SEW.AI',employer:'SEW'}
const cls=(n,c)=>(n.attrs.class??'').split(/\s+/).includes(c)
const normalizedKey=k=>String(k).replace(/^data[-_:]/i,'').replace(/[-_\s]/g,'').toLowerCase()
function parents(root){const result=new Map();function visit(n){for(const child of n.children)if(typeof child!=='string'){result.set(child,n);visit(child)}}visit(root);return result}
function ancestry(node,parentMap){const result=[];for(let n=node;n;n=parentMap.get(n))result.push({tag:n.tag,attrs:structuredClone(n.attrs),children:[],inactive:n.inactive??false});return result}
function ownedURL(value,base){const u=new URL(value,base);need(u.origin===ORIGIN&&u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&!u.hash,'native public role/application leaves current own origin');return u.href}
function activeOwners(nodes){for(const n of nodes)need(!n.inactive&&!n.inert&&!disabled(n),'actual native title/application/owner disabled or hidden')}
function countriesWritten(value){
 const words=norm(value).replace(/[^\p{L}\p{N}\s]/gu,' ').split(/\s+/).filter(Boolean),result=[]
 for(let at=0;at<words.length;at++)for(let size=Math.min(6,words.length-at);size>0;size--){const phrase=words.slice(at,at+size).join(' '),country=phrase.length>2?nativeCountryName(phrase):null;if(country){result.push(country);at+=size-1;break}}
 return [...new Set(result)]
}
export function currentPublisher(html){
 const p=page(html,LANDING),d=p.raw;need(/SEW/i.test(p.title)&&/Career/i.test(p.title),'current own SEW careers publisher missing')
 const declarations=d.nodes(n=>n.tag==='a'&&/^See Current Openings(?:\s|$)/.test(d.text(n)))
 const destinations=declarations.map(n=>ownedURL(n.attrs.href,LANDING));need(new Set(destinations).size===1&&destinations.length>0,'own current openings declaration unavailable or ambiguous')
 const parentMap=parents(d.root);for(const n of declarations)activeOwners(ancestry(n,parentMap))
 return{publisher:C.publisher,authority:LANDING,listingURL:destinations[0],legalEmployingEntity:null,nativeCurrentDeclaration:declarations.map(n=>({text:d.text(n),attributes:structuredClone(n.attrs)}))}
}
export function currentListing(html,url){
 const p=page(html,url),d=p.raw;need(/SEW/i.test(p.title)&&/Current Openings/i.test(d.text(d.root)),'current own openings publisher missing')
 const scope=one(d.nodes(n=>n.tag==='ul'&&cls(n,'job-crr-grid')),'current own public role roster'),parentMap=parents(d.root)
 const cards=d.nodes(n=>n.tag==='li'&&cls(n,'job-crr-item'),scope);need(cards.length>0&&cards.length<=100,'native bounded positive role roster absent; no zero proof')
 const rows=cards.map(card=>{
  const anchors=d.nodes(n=>n.tag==='a'&&Object.hasOwn(n.attrs,'href'),card),titles=d.nodes(n=>cls(n,'job-crr-title'),card),anchor=anchors[0]
  let roleURL=null,error=null;try{need(anchors.length===1&&titles.length===1,'native role/title handoff ambiguous');roleURL=ownedURL(anchor.attrs.href,url)}catch(e){error=e.message}
  return{id:roleURL?'sew-url-'+createHash('sha256').update(roleURL).digest('hex').slice(0,24):null,url:roleURL,title:titles.map(d.text).join(' '),locations:[],parseHold:error,originalCardHTML:d.outer(card),originalCardText:d.text(card),originalTree:structuredClone(card),originalControl:anchor?structuredClone(anchor):null,originalOwners:ancestry(card,parentMap)}
 })
 return{rows,surface:url,originalRosterHTML:d.outer(scope),sourceScopeComplete:false,companyIndiaTotal:null,companyGlobalTotal:null}
}
function listingRole(row,at){
 need(!row.parseHold&&row.id&&row.url&&row.title,'native listing record is not independently bound')
 activeOwners([row.originalTree,...row.originalOwners,...all(row.originalTree,n=>n.tag==='a'||n.tag==='span')])
 return constraints(props([...row.originalOwners,...all(row.originalTree,()=>true)]),authoredLines(row.originalTree),{employer:C.employer,observedAt:at})
}
function geography(headerValues,labelledValues,structuredPlaces){
 const nativeAlternatives=headerValues.flatMap(value=>value.split(/\s*(?:;|\||\s+or\s+)\s*/i)).map(norm).filter(Boolean)
 const labelledAlternatives=labelledValues.flatMap(value=>value.split(/\s*(?:;|\||\s+or\s+)\s*/i)).map(norm).filter(Boolean)
 const places=[...nativeAlternatives,...labelledAlternatives].map(label=>({label,countries:countriesWritten(label)}))
 for(const p of places)need(p.countries.length<=1,'whole native workplace contains conflicting countries')
 const countries=[...new Set([...places.flatMap(p=>p.countries),...structuredPlaces.map(p=>p.country)])]
 need(countries.includes('India'),'native same-role workplace lacks explicit India country; form choices and company address do not qualify it')
 const headerCountries=[...new Set(nativeAlternatives.flatMap(countriesWritten))],labelledCountries=[...new Set(labelledAlternatives.flatMap(countriesWritten))]
 if(headerCountries.length&&labelledCountries.length)need(headerCountries.some(country=>labelledCountries.includes(country)),'native role header and authored workplace countries conflict')
 const indiaAlternatives=places.filter(p=>p.countries.includes('India')).map(p=>p.label)
 return{nativeAlternatives,labelledAlternatives,places,countries,indiaAlternatives,structuredPlaces,typedCountryAsserted:structuredPlaces.length>0,inferredFromCorporateAddress:false,inferredFromApplicationCountryOptions:false}
}
export function currentRole(row,html,{observedAt=new Date().toISOString()}={}){
 const listingDates=listingRole(row,observedAt),p=page(html,row.url),d=p.raw,parentMap=parents(d.root)
 need(/\bSEW(?:\.AI)?\b/i.test(p.title),'current native own-role publisher differs')
 const title=one(d.nodes(n=>n.tag==='h3'&&norm(d.text(n))===row.title),'actual current role title')
 const header=parentMap.get(title);need(header,'native role title owner missing');let section=header
 while(section&&section.tag!=='section')section=parentMap.get(section)
 need(section&&d.nodes(n=>n.tag==='h2'&&d.text(n)==='Apply for This Job',section).length===1,'native current role and own application do not share an owner')
 activeOwners([...ancestry(title,parentMap),...ancestry(section,parentMap)])
 const forms=d.nodes(n=>n.tag==='form'&&/webform-submission-job-application-node-\d+-add-form/.test(n.attrs.id??''),section),form=one(forms,'current same-role native application form')
 activeOwners(ancestry(form,parentMap));need(form.attrs.method?.toLowerCase()==='post'&&ownedURL(form.attrs.action,row.url)===row.url,'current native form action leaves this same public role')
 const primarySubmit=one(d.nodes(n=>['input','button'].includes(n.tag)&&n.attrs.type?.toLowerCase()==='submit'&&n.attrs['data-drupal-selector']==='edit-actions-submit',form),'actual native Submit Application control')
 activeOwners(ancestry(primarySubmit,parentMap))
 for(const control of d.nodes(n=>['input','select','textarea','button'].includes(n.tag)&&Object.hasOwn(n.attrs,'form'),form))need(control.attrs.form===form.attrs.id,'actual native control association leaves current same-role form')
 if(primarySubmit.attrs.formmethod!=null)need(primarySubmit.attrs.formmethod.toLowerCase()==='post','actual primary submit method contradicts native published post form')
 for(const control of d.nodes(n=>['button','input'].includes(n.tag)&&Object.hasOwn(n.attrs,'formaction'),form))need(ownedURL(control.attrs.formaction,row.url)===row.url,'native actual submit handoff contradicts same-role form')
 const headerValues=d.nodes(n=>n.tag==='a'&&/^\/taxonomy\/term\//.test(n.attrs.href??''),header).map(d.text)
 const blocks=authoredLines(section),labelledValues=blocks.flatMap(block=>{const match=/^(?:Job\s+|Work\s+)?Location\s*:\s*(.+)$/i.exec(block);return match?[norm(match[1])]:[]})
 const structured=schemas(p).filter(m=>norm(m.title)===row.title||m.url===row.url),structuredPlaces=[]
 for(const posting of structured){
  schemaIdentity(posting,row,C.employer)
  for(const field of['url','sameAs'])if(posting.hiringOrganization?.[field]!=null){const values=Array.isArray(posting.hiringOrganization[field])?posting.hiringOrganization[field]:[posting.hiringOrganization[field]];need(values.length>0&&values.every(value=>value===ORIGIN+'/'),'same-role structured employer URL contradicts current own publisher')}
  for(const field of Object.keys(posting).filter(key=>['applicationurl','applyurl','applicationuri'].includes(normalizedKey(key))))if(posting[field]!=null)need(posting[field]===row.url,'same-role structured application differs from own form')
  const places=schemaPlaces(posting)
  for(const place of places){const address=place.originalAddress,model=place.originalPlace;for(const value of[model.name,address.name,address.addressLocality,address.addressRegion,address.streetAddress])if(value!=null)need(countriesWritten(value).every(country=>country===place.country),'whole structured workplace contradicts typed addressCountry')}
  structuredPlaces.push(...places)
 }
 const geo=geography(headerValues,labelledValues,structuredPlaces),config={employer:C.employer,observedAt,countryAlternatives:geo.countries}
 const scopes=[...all(section,()=>true),...ancestry(section,parentMap)],properties=props(scopes),dates=constraints(properties,blocks,config)
 for(const property of properties)if(['applicationurl','applyurl','applicationuri'].includes(normalizedKey(property.key)))need(ownedURL(property.value,row.url)===row.url,'native same-role application property differs')
 for(const posting of structured){const extra=constraints(scalarFields(posting),[],config);dates.posted.push(...extra.posted);dates.expiry.push(...extra.expiry);if(typeof posting.description==='string'){const desc=readNativeDocument(posting.description),root=one(desc.nodes(n=>n.tag==='root'),'native structured criteria');const more=constraints(props(all(root,()=>true)),authoredLines(root),config);dates.posted.push(...more.posted);dates.expiry.push(...more.expiry)}}
 dates.posted.push(...listingDates.posted);dates.expiry.push(...listingDates.expiry)
 const application={url:row.url,kind:'own-current-same-canonical-role-published-native-form',nativeFormId:form.attrs.id,nativeFormAction:form.attrs.action,method:form.attrs.method,originalFormHTML:d.outer(form),originalForm:structuredClone(form),originalPrimarySubmitHTML:d.outer(primarySubmit),originalPrimarySubmitAttributes:structuredClone(primarySubmit.attrs),allControlsQualified:false,submitted:false,activated:false}
 const originalRole={publicRoleURL:row.url,originalRoleTitle:d.text(title),originalRoleTitleHTML:d.outer(title),originalRoleHeaderHTML:d.outer(header),originalRoleHTML:d.outer(section),originalRoleTree:structuredClone(section),originalStructuredPostings:structured,workplaces:geo}
 const model={binding:{publicRoleURL:row.url,title:row.title,employer:C.employer,formId:form.attrs.id,formAction:ownedURL(form.attrs.action,row.url),country:'India'},originalListing:row,originalRole,originalApplication:application}
 const sourceRow={...row,locations:geo.indiaAlternatives.length?[...new Set(geo.indiaAlternatives)]:['India']}
 const criteriaOwner=parentMap.get(header),hidden=all(criteriaOwner,n=>n.inactive||n.inert||cls(n,'hidden')||cls(n,'sr-only')||['template','iframe','object','noscript'].includes(n.tag)).length>0,job=projection(C,sourceRow,model,{description:d.text(criteriaOwner),rawDescription:d.outer(criteriaOwner),hidden,application,dates,countryEvidence:{kind:'same-role-explicit-whole-authored-native-workplace',...geo}})
 Object.assign(job,{nativePublicJobId:null,requisitionId:null,sourceNativeCMSNodeFormId:form.attrs.id,sourceIdentityKind:'internal-derived-from-current-own-canonical-role-URL',sourceNativeSourceIdUnpublished:true,sourceCriteriaEvidenceEncoding:'normalized-own-SSR-HTML-slice;full-original-response-retained-separately',sourceNativeCanonicalRoleURL:row.url})
 return job
}
export async function runCurrentPublications(options={}){
 options.signal?.throwIfAborted();need(!options.fetchText&&!options.fetchJson&&!options.fetchPage,'original native Response metadata required')
 const at=(typeof options.now==='function'?options.now():options.now)??new Date().toISOString();need(Number.isFinite(Date.parse(at)),'invalid current observation clock')
 const io=currentReader([LANDING],[ORIGIN],options),held=[],roleResponses=[]
 try{
  const publisherOpening=currentPublisher((await io.read(LANDING)).text);io.allow(publisherOpening.listingURL)
  const opening=currentListing((await io.read(publisherOpening.listingURL)).text,publisherOpening.listingURL),initial=new Map(),final=new Map()
  for(const row of opening.rows){if(!row.url||initial.has(row.url))continue;io.allow(row.url);try{const response=await io.read(row.url);initial.set(row.url,response);roleResponses.push({phase:'opening',url:row.url,sha256:response.sha256})}catch(e){io.check();if(io.denied.size)throw e;initial.set(row.url,{error:e.message});held.push({phase:'opening-native-read',url:row.url,title:row.title,reason:e.message,failureKind:nativeUnavailable(e)?'access_or_transport_unavailable':'parser_or_contract_error'})}}
  const publisherClosing=currentPublisher((await io.read(LANDING)).text);need(isDeepStrictEqual(publisherOpening,publisherClosing),'current own publisher/openings declaration changed')
  const closing=currentListing((await io.read(publisherClosing.listingURL)).text,publisherClosing.listingURL)
  for(const row of opening.rows){if(!row.url||final.has(row.url))continue;try{const response=await io.read(row.url);final.set(row.url,response);roleResponses.push({phase:'closing',url:row.url,sha256:response.sha256})}catch(e){io.check();if(io.denied.size)throw e;final.set(row.url,{error:e.message});held.push({phase:'closing-native-read',url:row.url,title:row.title,reason:e.message,failureKind:nativeUnavailable(e)?'access_or_transport_unavailable':'parser_or_contract_error'})}}
  const jobs=[]
  for(const row of opening.rows){try{
   const firstRows=opening.rows.filter(r=>r.url===row.url),lastRows=closing.rows.filter(r=>r.url===row.url);need(row.url&&firstRows.length===1&&lastRows.length===1&&lastRows[0].title===row.title,'native unique current role URL/title disappeared or became ambiguous')
   need(initial.get(row.url)?.text&&final.get(row.url)?.text,'current own opening/closing critical role observation unavailable')
   const first=currentRole(row,initial.get(row.url).text,{observedAt:at}),last=currentRole(lastRows[0],final.get(row.url).text,{observedAt:at}),job=mergeObservation(mergeObservation(null,first,'opening'),last,'closing');job.scrapedAt=at;jobs.push(job)
  }catch(e){io.check();held.push({id:row.id,url:row.url,title:row.title,reason:e.message,openingNativeCard:row,closingNativeCards:closing.rows.filter(r=>r.url===row.url)})}}
  const audit={source:C.source,publisherOpening,publisherClosing,nativeOpeningInventory:opening.rows,nativeClosingInventory:closing.rows,roleResponses,held,originalResponses:io.receipts,sourceScopeComplete:false,companyIndiaTotal:null,companyGlobalTotal:null,lifecycleCleanupAllowed:false,allApplicationControlsQualified:false,backendActivationVerified:false,applicationsSubmitted:false,nativeProgramsExecuted:false}
  attachSourceObservationEvidence(jobs,{source:C.source,recordKind:'vacancy-rows',observedRecordCount:opening.rows.length,observedVacancyCount:opening.rows.length,sourceScopeComplete:false,companyIndiaTotal:null,companyGlobalTotal:null})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true});if(options.onAudit)await io.callback(options.onAudit,structuredClone(audit));io.check()
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:publisherOpening.listingURL,firstParty:true,listingComplete:false,pagesFetched:io.receipts.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:at,lifecycleCleanupAllowed:false,reason:'own-current-SSR-declared-openings-and-same-canonical-role-native-form;explicit-whole-role-India-workplace;valid-partials;company-inventory-legal-employer-full-controls-backend-and-cleanup-unverified'})
 }catch(e){io.check();if(e&&typeof e==='object')e.nativeEvidence={source:C.source,originalResponses:io.receipts,sourceScopeComplete:false,companyIndiaTotal:null,companyGlobalTotal:null,lifecycleCleanupAllowed:false};throw e}finally{io.close()}
}
