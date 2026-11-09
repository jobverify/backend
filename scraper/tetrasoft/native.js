export const SOURCE="tetrasoft",SURFACE="https://www.tetrasoft.us/careers.html",COMPANY="TetraSoft"

import {readNativeDocument,activeHead,activeScripts,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {document as sourceDocument} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
export {readNativeDocument,activeHead,activeScripts,readVisibleNativeDocument,sourceDocument}
export const norm=value=>decodeNativeEntities(value).replace(/\s+/g,' ').trim()
export const cls=(node,value)=>(node.attrs.class||'').split(/\s+/).includes(value)
export const within=(node,predicate)=>node.inert?[]:[...(predicate(node)?[node]:[]),...node.children.filter(child=>typeof child!=='string').flatMap(child=>within(child,predicate))]
export const allRaw=(node,predicate)=>[...(predicate(node)?[node]:[]),...node.children.filter(child=>typeof child!=='string').flatMap(child=>allRaw(child,predicate))]
const gap=()=>({status:'coverage-gap',surface:SURFACE,firstParty:true,listingComplete:false,reportedTotal:null,indiaFacetCount:null})
export const need=(ok,message)=>{if(!ok)throw Object.assign(Error(SOURCE+' native: '+message),{abortRetries:true,inventoryEvidence:gap()})}
export const one=(rows,label)=>{need(rows.length===1,'missing/ambiguous '+label);return rows[0]}
export const parentsOf=root=>{const result=new Map();const walk=node=>{for(const child of node.children||[])if(typeof child!=='string'){result.set(child,node);walk(child)}};walk(root);return result}
export const rawSlice=(html,predicate)=>{const doc=sourceDocument(html),node=one(allRaw(doc.root,predicate),'raw role carrier');need(Number.isInteger(node.end),'unclosed raw role carrier');return doc.outer(node)}
export const canonical=(html,url,{required=true}={})=>{const doc=readNativeDocument(html),head=one(doc.nodes(n=>n.tag==='head'),'native head'),links=within(head,n=>n.tag==='link'&&(n.attrs.rel||'').split(/\s+/).includes('canonical'));need(links.length===(required?1:links.length),'missing native canonical');need(links.length<=1&&links.every(n=>n.attrs.href===url),'native canonical role identity conflict');return {titles:within(head,n=>n.tag==='title').map(n=>norm(n.raw)),metas:within(head,n=>n.tag==='meta').map(n=>n.attrs)}}
export const visible=html=>readVisibleNativeDocument(html,{strict:true})
export const role=(values={})=>({title:null,company:COMPANY,location:null,city:null,state:null,country:null,department:null,jobId:null,requisitionId:null,sourceUrl:SURFACE,applyUrl:null,employmentType:null,experienceRequired:null,minimumQualification:null,preferredQualification:null,requiredSkills:[],postingDate:null,closingDate:null,jobDescription:null,remoteStatus:null,...values})
export const finish=(jobs,{observedVacancyCount=jobs.length,observedRecordCount=observedVacancyCount,recordKind=observedRecordCount===observedVacancyCount?'vacancy-rows':'mixed',pagesFetched=1,now=()=>new Date().toISOString(),failures=[],...extra}={})=>{
 const time=new Date(now());need(!Number.isNaN(+time),'invalid extraction clock')
 const audit={source:SOURCE,recordKind,observedRecordCount,observedVacancyCount,observedListingCount:observedVacancyCount,candidateDetails:observedVacancyCount,extractedDetailJobs:jobs.filter(j=>j.jobDescription&&j.rawNativeRoleEvidence?.identityQualified!==false).length,excludedDetailJobs:0,failures,reportedTotal:null,indiaFacetCount:null,listingPaginationComplete:null,closingInventoryMatches:null,sourceScopeComplete:false,observedMissingWorkplaces:jobs.filter(j=>!j.location).length,observedUnknownCountries:jobs.filter(j=>!j.country).length,rawProvenanceLimit:'Native source observations only. Employer-wide global/India counts, exact legal employer, closing inventory, unpublished role dates and successful application submission remain unqualified.',...extra}
 for(const job of jobs){job.source=SOURCE;job.companyCareerPage=SURFACE;job.companyDomain=new URL(SURFACE).hostname.replace(/^www\./,'');job.scrapedAt=time.toISOString();job.link=job.applyUrl||null;job.sourceListingComplete=false;job.sourceDetailComplete=Boolean(job.jobDescription)&&job.rawNativeRoleEvidence?.identityQualified!==false}
 if(jobs.length)jobs[0].nativeCollectionEvidence=audit
 Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit})
 attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind,observedRecordCount,observedVacancyCount,sourceScopeComplete:false})
 return attachInventoryEvidence(jobs,{...gap(),pagesFetched,verifiedAt:time.toISOString(),reason:failures.length?'native-observations-with-unavailable-or-unqualified-details':'native-observed-subset-with-unqualified-company-scope'})
}
const arrangement=/^(?:remote|hybrid|on[ -]?site|work from home|multiple locations|not specified|tbd|n\/?a)$/i
export const geography=(statements,countryStatements=[])=>{
 const native=statements.map(norm).filter(Boolean),countries=countryStatements.map(norm).filter(Boolean),values=[...new Set(native.filter(value=>!arrangement.test(value)))],explicit=[]
 for(const value of countries){need(!arrangement.test(value),'arrangement used as native country');explicit.push(/^(?:India|IN)$/i.test(value)?'India':/^(?:US|USA|United States(?: of America)?)$/i.test(value)?'US':value)}
 for(const value of values){if(/^US\s*-\s*\S/.test(value))explicit.push('US');if(/^(?:India|IN)$/i.test(value)||/(?:^|,)\s*India\s*$/.test(value))explicit.push('India')}
 const uniqueCountries=[...new Set(explicit)];need(uniqueCountries.length<=1,'conflicting explicit native country/workplace statements')
 const most=values.slice().sort((a,b)=>b.length-a.length)[0]||null,consistent=values.every(value=>value===most||most?.split(/[,/]/).map(norm).includes(value))
 return {location:consistent?most:null,country:consistent?(uniqueCountries[0]||null):null,nativeWorkplaceStatements:native,nativeCountryStatements:countries,workplaceQualified:consistent,unqualifiedWorkplaceStatements:consistent?[]:native}
}
export const nativeFetch=async(url,{signal,metadata=false}={})=>{
 signal?.throwIfAborted();const target=new URL(url),origin=new URL(SURFACE);need(target.protocol==='https:'&&!target.username&&!target.password&&target.hostname.replace(/^www\./,'')===origin.hostname.replace(/^www\./,''),'unqualified native request route')
 const own=new AbortController(),timeout=Object.assign(Error(SOURCE+' native request timeout'),{name:'TimeoutError',abortRetries:true,inventoryEvidence:gap()}),timer=setTimeout(()=>own.abort(timeout),20000),attempt=signal?AbortSignal.any([signal,own.signal]):own.signal
 const aborted=()=>{signal?.throwIfAborted();attempt.throwIfAborted()};let response,reader
 const wait=promise=>new Promise((resolve,reject)=>{let settled=false;const cleanup=()=>attempt.removeEventListener('abort',abort),abort=()=>{if(settled)return;settled=true;cleanup();reject(signal?.aborted?signal.reason:attempt.reason)};attempt.addEventListener('abort',abort,{once:true});if(attempt.aborted)abort();Promise.resolve(promise).then(value=>{cleanup();if(settled){try{Promise.resolve(value?.body?.cancel()).catch(()=>{})}catch{}return}settled=true;resolve(value)},error=>{cleanup();if(settled)return;settled=true;reject(error)})})
 const cancel=()=>{try{Promise.resolve(reader?reader.cancel():response?.body?.cancel()).catch(()=>{})}catch{}}
 try{response=await wait(fetch(url,{method:'GET',redirect:'manual',headers:{'User-Agent':'Mozilla/5.0',Accept:'text/html,application/json,application/javascript,text/css;q=0.9,*/*;q=0.8'},signal:attempt}));aborted()
  if(response.status!==200){cancel();throw Object.assign(Error(SOURCE+' native HTTP '+response.status),{status:response.status,code:[401,403].includes(response.status)?'access_denied':response.status===429?'rate_limited':'native_unavailable',abortRetries:true,inventoryEvidence:gap()})}
  need(!response.url||response.url===url,'unqualified native final URL');need(!response.headers?.get('content-length')||Number(response.headers.get('content-length'))<=2_000_000,'oversized native body')
  reader=response.body?.getReader();need(reader,'missing native body');const chunks=[];let size=0
  for(;;){const chunk=await wait(reader.read());aborted();if(chunk.done)break;size+=chunk.value.byteLength;need(size<=2_000_000,'oversized native body');chunks.push(Buffer.from(chunk.value))}
  const html=Buffer.concat(chunks).toString('utf8');aborted();need(!/<title\b[^>]*>\s*(?:Access Denied|Forbidden|Just a moment|Attention Required)|<Code>\s*AccessDenied|cf-chl-/i.test(html),'native access denial or challenge');return metadata?{html,status:200,url:response.url||url}:html
 }catch(error){cancel();aborted();if(error.abortRetries)throw error;throw Object.assign(Error(SOURCE+' native transport: '+error.message),{abortRetries:true,cause:error,inventoryEvidence:gap()})}
 finally{clearTimeout(timer);try{reader?.releaseLock()}catch{}}
}

import {advertisedFaqAssets,qualifyFaqRendering} from './nativeUi.js'
const identity=value=>norm(value).toLowerCase()
const styled=(html,css)=>html+'\n<style>'+css+'</style>'
const careerScope=(html,css='')=>{
 const head=canonical(html,SURFACE,{required:false}),doc=visible(styled(html,css)),scope=one(doc.nodes(n=>n.tag==='section'&&n.attrs.id==='faq'&&cls(n,'faq')),'native careers FAQ')
 need(head.titles.length===1&&/^Tetrasoft$/i.test(head.titles[0])&&within(scope,n=>n.tag==='h2'&&doc.text(n)==='Tetrasoft Careers').length===1,'employer careers identity')
 return {doc,scope}
}
const fieldsIn=(doc,pane)=>{
 const result=new Map(),unqualified=[];let conditional=null
 for(const paragraph of within(pane,n=>n.tag==='p')){
  const text=doc.text(paragraph)
  if(/^(?:(?:if|when|where)\s+(?:necessary|needed|required|applicable)|travel(?: locations?)?|company (?:profile|locations?))\s*:?$/i.test(text)){conditional=text;continue}
  let label=null,parts=[]
  const flush=()=>{if(!label)return;const value=norm(parts.join(' '));if(value){if(conditional&&['Location','Country'].includes(label))unqualified.push({label,value,context:conditional});else{const previous=result.get(label)||[];previous.push(value);result.set(label,previous)}}label=null;parts=[]}
  for(const child of paragraph.children){
   if(typeof child==='string'){if(label)parts.push(child);continue}
   if(child.inert)continue
   if(child.tag==='br'){flush();continue}
   const match=child.tag==='strong'&&doc.text(child).match(/^(Skills|Experience|Location|Country|Job Description)\s*:\s*$/i)
   if(match){flush();label=['Skills','Experience','Location','Country','Job Description'].find(value=>identity(value)===identity(match[1]));continue}
   if(label)parts.push(doc.text(child))
  }
  flush()
 }
 return {values:result,unqualified}
}
const rawCards=html=>{
 const doc=sourceDocument(html),scopes=allRaw(doc.root,n=>n.tag==='section'&&n.attrs.id==='faq'&&cls(n,'faq')),dataNodes=(node,predicate)=>['template','script','style','noscript'].includes(node.tag)?[]:[...(predicate(node)?[node]:[]),...node.children.filter(child=>typeof child!=='string').flatMap(child=>dataNodes(child,predicate))],rawText=node=>norm(node.children.map(child=>typeof child==='string'?child:['template','script','style','noscript'].includes(child.tag)?'':rawText(child)).join(' '))
 return scopes.length===1?allRaw(scopes[0],n=>cls(n,'faq-item')).map(node=>{const panes=dataNodes(node,n=>cls(n,'faq-content')),labels=panes.length===1?dataNodes(panes[0],n=>n.tag==='strong').map(rawText):[],application=panes.length===1&&dataNodes(panes[0],n=>n.tag==='a'&&n.attrs.href==='mailto:ts_tag_offshore@tetrasoft.us'&&/^Apply Now$/i.test(rawText(n))).length===1;return {html:doc.outer(node),titles:allRaw(node,n=>n.tag==='h4').map(n=>doc.text(n)),nativeRoleKindQualified:application&&['Skills:','Experience:','Job Description:'].every(label=>labels.some(value=>identity(value)===identity(label)))}}):[]
}
export const extractCareerCards=(html,{css='',javascript=''}={})=>{
 const initial=careerScope(html,css),proof=qualifyFaqRendering(html,css,javascript),rendered=careerScope(proof.html,proof.css),raw=rawCards(html),candidates=within(initial.scope,n=>cls(n,'faq-item')),opened=within(rendered.scope,n=>cls(n,'faq-item')),seen=new Set(),jobs=[],discovery=[]
 need(candidates.length>0,'unsupported native empty careers inventory')
 for(const card of candidates){
  const headings=within(card,n=>n.tag==='h4'),title=initial.doc.text(one(headings,'native role header')),header=one(within(card,n=>cls(n,'faq-header')),'native role header carrier')
  need(card.children.includes(header)&&within(header,n=>n.tag==='h4').length===1&&title,'native role/header binding')
  const rawMatches=raw.filter(row=>row.titles.length===1&&identity(row.titles[0])===identity(title)),rawValues=[...new Set(rawMatches.map(row=>row.html))],nativeHtml=rawValues.length===1?rawValues[0]:null,key=nativeHtml||initial.doc.text(card)
  if(!rawMatches.length||!rawMatches.every(row=>row.nativeRoleKindQualified)){discovery.push({title,nativeCarrierHtml:nativeHtml,reason:'unqualified-native-role-kind'});continue}
  if(seen.has(key))continue;seen.add(key)
  const matching=opened.filter(node=>within(node,n=>n.tag==='h4'&&identity(rendered.doc.text(n))===identity(title)).length===1)
  const consistentDisplayCopies=matching.length>0&&matching.every(node=>rendered.doc.text(node)===rendered.doc.text(matching[0])),nativeOpenedStateQualified=proof.qualified&&consistentDisplayCopies,pane=nativeOpenedStateQualified?within(matching[0],n=>cls(n,'faq-content')):[]
  const qualifiedPane=pane.length===1?pane[0]:null,parsed=qualifiedPane?fieldsIn(rendered.doc,qualifiedPane):{values:new Map(),unqualified:[]},fields=parsed.values
  need(['Skills','Experience','Job Description'].every(label=>(fields.get(label)||[]).length<=1),'ambiguous native role metadata')
  const geo=geography(fields.get('Location')||[],fields.get('Country')||[]),jd=fields.get('Job Description')?.[0]||null,links=qualifiedPane?within(qualifiedPane,n=>n.tag==='a'&&/^Apply Now$/i.test(rendered.doc.text(n))):[]
  const application=links.length===1&&links[0].attrs.href==='mailto:ts_tag_offshore@tetrasoft.us'?links[0].attrs.href:null
  const withoutApplication=node=>typeof node==='string'?node:{...node,children:node.children.filter(child=>typeof child==='string'||child.tag!=='a'||!/^Apply Now$/i.test(rendered.doc.text(child))).map(withoutApplication)}
  const fullText=jd?rendered.doc.text(withoutApplication(qualifiedPane)):null
  jobs.push(role({title,location:geo.location,country:geo.country,experienceRequired:fields.get('Experience')?.[0]||null,requiredSkills:fields.has('Skills')?[fields.get('Skills')[0]]:[],applyUrl:application,jobDescription:fullText,rawNativeRoleEvidence:{identityQualified:true,nativeRoleTitle:title,nativeCarrierHtml:nativeHtml,nativeOpenedStateQualified:Boolean(qualifiedPane),nativeRenderingProof:{qualified:proof.qualified,reason:proof.reason,qualification:proof.qualification||null},nativeGeography:geo,unqualifiedNativeWorkplaceStatements:parsed.unqualified,applicationRoleAssociationQualified:Boolean(application),applicationSubmissionQualified:false,exactLegalEmployerQualified:false,rawContentQualification:'Literal HTML retained for provenance; collapsed or permanently hidden fields are not public job fields; header identity is not a native requisition ID'}}))
 }
 need(jobs.length>0,'unsupported native vacancy structure');Object.defineProperty(jobs,'displayObservationCount',{value:candidates.length});Object.defineProperty(jobs,'nativeDiscovery',{value:discovery});return jobs
}
export const hasOfficialCareersSignal=html=>{try{careerScope(html);return true}catch{return false}}
export const collect=async({fetchText=nativeFetch,signal,now,maxJobs=null}={})=>{
 signal?.throwIfAborted();const html=await fetchText(SURFACE,{signal});signal?.throwIfAborted();careerScope(html)
 let css='',javascript='',pagesFetched=1;const failures=[],assets=advertisedFaqAssets(html)
 if(assets){try{css=await fetchText(assets.css,{signal});signal?.throwIfAborted();pagesFetched++;javascript=await fetchText(assets.js,{signal});signal?.throwIfAborted();pagesFetched++}catch(error){signal?.throwIfAborted();failures.push({kind:error.code||'native-rendering-carrier-unavailable',status:error.status??null})}}
 else failures.push({kind:'unqualified-native-rendering-carrier'})
 const jobs=extractCareerCards(html,{css,javascript}),selected=Number.isInteger(maxJobs)&&maxJobs>=0?jobs.slice(0,maxJobs):jobs
 return finish(selected,{observedRecordCount:jobs.displayObservationCount,observedVacancyCount:jobs.length,pagesFetched,now,failures,unqualifiedNativeDiscovery:jobs.nativeDiscovery,nativeObservedDisplayCopies:jobs.displayObservationCount-jobs.length-jobs.nativeDiscovery.length,nativeRenderingQualification:'Narrow declared header-parent toggle and unconditional native opened-state CSS only; source scope and legal employer are unqualified'})
}
