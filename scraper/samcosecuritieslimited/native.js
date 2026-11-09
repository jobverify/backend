import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {readNativeDocument,activeHead,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
const SOURCE="samcosecuritieslimited",SURFACE="https://www.samco.in/careers"
export const check=(ok,message)=>{if(!ok)throw Object.assign(Error(SOURCE+' native: '+message),{abortRetries:true,inventoryEvidence:{status:'coverage-gap',surface:SURFACE,firstParty:true,listingComplete:false,reportedTotal:null,indiaFacetCount:null}})}
export const norm=value=>decodeNativeEntities(value).replace(/\s+/g,' ').trim()
export const within=(node,predicate)=>node.inert?[]:[...(predicate(node)?[node]:[]),...node.children.filter(n=>typeof n!=='string').flatMap(n=>within(n,predicate))]
export const one=(nodes,label)=>{check(nodes.length===1,'missing/ambiguous '+label);return nodes[0]}
export const enabled=node=>!Object.hasOwn(node.attrs,'disabled')&&node.attrs['aria-disabled']!=='true'
export const finish=(jobs,{recordKind='vacancy-rows',observedRecordCount=jobs.length,observedVacancyCount=jobs.length,now=()=>new Date().toISOString(),pagesFetched=1,...extra}={})=>{
 const failures=jobs.filter(job=>!job.jobDescription||job.rawNativeRoleEvidence?.identityQualified===false).map(job=>({stage:'native-detail',nativeRoleId:job.requisitionId??job.sourceUrl,kind:job.rawNativeRoleEvidence?.identityQualified===false?'identity-conflict':'missing-content'}))
 const audit={source:SOURCE,recordKind,observedRecordCount,observedVacancyCount,pagesFetched,observedListingCount:observedVacancyCount,candidateDetails:observedVacancyCount,extractedDetailJobs:jobs.length-failures.length,excludedDetailJobs:0,failures,reportedTotal:null,indiaFacetCount:null,listingPaginationComplete:null,closingInventoryMatches:null,sourceScopeComplete:false,observedMissingWorkplaces:jobs.filter(job=>!job.location).length,observedUnknownCountries:jobs.filter(job=>!job.country).length,rawProvenanceLimit:'Observed native records only; actual employer-wide vacancy scope, authoritative India/global totals, closing inventory and application submission remain unqualified',...extra}
 for(const job of jobs){job.sourceListingComplete=false;job.sourceDetailComplete=Boolean(job.jobDescription)&&job.rawNativeRoleEvidence?.identityQualified!==false}
 if(jobs.length)jobs[0].nativeCollectionEvidence=audit
 Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit})
 attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind,observedRecordCount,observedVacancyCount,sourceScopeComplete:false})
 return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:SURFACE,firstParty:true,listingComplete:false,pagesFetched,reportedTotal:null,indiaFacetCount:null,verifiedAt:now(),reason:extra.sourceUnavailable?'native-inventory-unavailable:'+String(extra.nativeDiscoveryFailures?.[0]?.kind||'unknown'):'observed-native-subset-with-unqualified-employer-scope'})
}
export const nativeFetch=async(url,{signal,binary=false,metadata=false,method='GET',body}={})=>{
 signal?.throwIfAborted();const deadline=AbortSignal.timeout(20000),requestSignal=signal?AbortSignal.any([signal,deadline]):deadline
 const aborted=()=>{signal?.throwIfAborted();requestSignal.throwIfAborted()}
 try{const response=await fetch(url,{method,...(body==null?{}:{body}),headers:{'User-Agent':'Mozilla/5.0',Accept:binary?'application/pdf':method==='POST'?'application/json, text/javascript, */*; q=0.01':'text/html,application/javascript,application/json;q=0.9,*/*;q=0.8',...(method==='POST'?{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','X-Requested-With':'XMLHttpRequest',Referer:SURFACE}:{})},signal:requestSignal});aborted()
  if(!response.ok){await response.body?.cancel();throw Object.assign(Error(SOURCE+' native input: HTTP '+response.status),{status:response.status,code:[401,403].includes(response.status)?'access_denied':response.status===429?'rate_limited':'native_unavailable',abortRetries:true,inventoryEvidence:{status:'coverage-gap',surface:SURFACE,firstParty:true,listingComplete:false,reportedTotal:null,indiaFacetCount:null}})}
  const requested=new URL(url),final=new URL(response.url||url),samePath=final.pathname.replace(/\/$/,'')===requested.pathname.replace(/\/$/,'')
  if(final.origin!==requested.origin||!samePath||final.search!==requested.search){await response.body?.cancel();check(false,'unexpected native redirect')}
  const value=binary?Buffer.from(await response.arrayBuffer()):await response.text();aborted();check(value.length<(binary?5000000:3000000),'oversized native input')
  if(!binary)check(!/<title\b[^>]*>\s*(?:Access Denied|Forbidden|Just a moment|Attention Required)|<Code>\s*AccessDenied/i.test(value),'HTTP200 native access denial or challenge')
  return metadata?{html:value,status:response.status,url:final.href}:value
 }catch(error){aborted();if(error.abortRetries)throw error;throw Object.assign(Error(SOURCE+' native input: '+error.message),{abortRetries:true,cause:error,inventoryEvidence:{status:'coverage-gap',surface:SURFACE,firstParty:true,listingComplete:false,reportedTotal:null,indiaFacetCount:null}})}
}
export {readVisibleNativeDocument,readNativeDocument,activeHead}

import {parse} from 'acorn'
import {activeScripts} from '../../scraper-support/utils/activeNativeHtml.js'
const walk=(node,fn)=>{if(!node||typeof node!=='object')return;fn(node);for(const value of Object.values(node))if(Array.isArray(value))value.forEach(child=>walk(child,fn));else if(value&&typeof value==='object')walk(value,fn)}
const fields=node=>{check(node?.type==='ObjectExpression','dynamic native API object');const result={};for(const prop of node.properties){const key=prop.key?.name??prop.key?.value;check(prop.type==='Property'&&!prop.computed&&!prop.method&&prop.kind==='init'&&typeof key==='string'&&!Object.hasOwn(result,key),'ambiguous native API property');result[key]=prop.value}return result}
export const readDepartments=html=>{
 const doc=readVisibleNativeDocument(html,{strict:true});check(activeHead(html).titles.some(title=>/career/i.test(title)&&/Samco/i.test(title)),'careers employer identity');check(one(doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'canonical').attrs.href===SURFACE,'careers canonical identity')
 const form=one(doc.nodes(n=>n.tag==='form'&&n.attrs.id==='careerForm'),'public application surface'),select=one(within(form,n=>n.tag==='select'&&n.attrs.id==='dep_position'),'department selector'),departments=within(select,n=>n.tag==='option'&&enabled(n)).map(n=>({id:n.attrs['data-value'],name:n.attrs['data-id'],value:n.attrs.value,label:doc.text(n)})),cards=doc.nodes(n=>n.tag==='a'&&doc.hasClass(n,'video-listing')&&enabled(n)).map(n=>({id:n.attrs['data-value'],name:n.attrs['data-id'],label:doc.text(one(within(n,c=>doc.hasClass(c,'v-text')),'visible department card'))}))
 // The current page keeps the older card carousel permanently hidden. The
 // active native selector supplies department bindings; hidden copies are not
 // promoted to openings or counted as additional records.
 check(departments.length>0&&(!cards.length||cards.length===departments.length)&&new Set(departments.map(row=>row.id)).size===departments.length&&new Set(cards.map(row=>row.id)).size===cards.length,'missing/duplicate department observations')
 for(const department of departments){const card=cards.find(row=>row.id===department.id);check(/^\d+$/.test(department.id)&&department.value===department.id&&department.name===department.label&&(!cards.length||card?.name===department.name&&card.label===department.name),'department card/select identity contradiction')}
 check(within(form,n=>n.tag==='select'&&n.attrs.id==='depPosition'&&n.attrs.name==='depPosition').length===1&&within(form,n=>n.tag==='input'&&n.attrs.type==='file'&&n.attrs.name==='userfile').length===1&&within(form,n=>n.tag==='button'&&n.attrs.id==='careerSubmit').length===1,'missing public application controls')
 return departments.map(({id,name})=>({id,name}))
}
export const departmentObservations=html=>{const departments=readDepartments(html);return finish([],{recordKind:'departments',observedRecordCount:departments.length,observedVacancyCount:0,observedDepartments:departments,actualVacancyCount:null})}
export const advertisedClient=html=>{
 const doc=readVisibleNativeDocument(html,{strict:true}),scripts=doc.nodes(n=>n.tag==='script'&&n.attrs.src).map(n=>new URL(n.attrs.src,SURFACE)).filter(url=>url.origin==='https://cdn.samco.in'&&url.pathname==='/assets/nuova/js/careers.js')
 if(!scripts.length)return null;return one(scripts,'advertised careers data client').href
}
export const readDataRoutes=(html,javascript)=>{
 const bases=[];for(const script of activeScripts(html)){let ast;try{ast=parse(script,{ecmaVersion:'latest'})}catch{continue}walk(ast,node=>{const value=node.type==='VariableDeclarator'&&node.id?.name==='base_url'?node.init:node.type==='AssignmentExpression'&&node.left?.name==='base_url'?node.right:null;if(value?.type==='Literal'&&typeof value.value==='string')bases.push(value.value)})}
 check(new Set(bases).size===1&&bases[0]==='https://www.samco.in/','unbound first-party native API base')
 let ast;try{ast=parse(javascript,{ecmaVersion:'latest'})}catch{check(false,'unreadable native careers data client')}
 const contracts={getDepartmentPosition:{parameter:'departId',value:'departmentValue',paths:[]},getPositionDescription:{parameter:'positionID',value:'selectedValue',paths:[]}}
 walk(ast,node=>{if(node.type!=='CallExpression'||node.callee?.type!=='MemberExpression'||node.callee.computed||node.callee.object?.name!=='$'||node.callee.property?.name!=='ajax'||node.arguments.length!==1||node.arguments[0].type!=='ObjectExpression')return;const props=fields(node.arguments[0]),url=props.url;if(url?.type!=='BinaryExpression'||url.operator!=='+'||url.left?.name!=='base_url'||url.right?.type!=='Literal')return
  for(const[name,contract]of Object.entries(contracts)){if(url.right.value!=='samco_careers/'+name)continue;const data=fields(props.data);check(props.type?.value==='POST'&&props.dataType?.value==='json'&&Object.keys(data).length===1&&data[contract.parameter]?.type==='Identifier'&&data[contract.parameter].name===contract.value,'changed native read-only API request contract');contract.paths.push(new URL(url.right.value,bases[0]).href)}
 })
 const routes={};for(const[name,contract]of Object.entries(contracts)){check(new Set(contract.paths).size===1,'missing/ambiguous native '+name+' route');routes[name]={url:contract.paths[0],parameter:contract.parameter}}
 return routes
}
const visibleLines=node=>{if(typeof node==='string')return node;if(node.inert||['script','style'].includes(node.tag))return '';if(node.tag==='br')return '\n';const text=node.children.map(visibleLines).join(' ');return /^(?:p|div|li|h[1-6])$/.test(node.tag)?'\n'+text+'\n':text}
const readDescription=html=>{
 const doc=readVisibleNativeDocument(html,{strict:true}),root=doc.nodes(n=>n.tag==='root')[0],text=doc.text(root),lines=visibleLines(root).split(/\n/).map(norm).filter(Boolean),locations=[],countries=[],unqualifiedGeography=[]
 let requirement=false,qualifier=null
 for(const line of lines){
  if(/^(?:if|when|unless|conditional|optional|subject to|depending on|as needed|as required)\b/i.test(line))qualifier=qualifier||'conditional-context'
  if(/^(?:Travel|Mobility|Company profile|Company example|Example|Headquarters|Office address)\b(?:\s*[-:]|$)/i.test(line))qualifier=qualifier||'non-workplace-context'
  if(/^Job Requirements?\s*[-:]?$/i.test(line))requirement=true
  const location=line.match(/^Location\s*[-:]\s*(.+)$/i)?.[1],country=line.match(/^Country\s*[-:]\s*(.+)$/i)?.[1]
  if(!location&&!country)continue
  if(requirement&&!qualifier){if(location)locations.push(location);if(country)countries.push(country)}else unqualifiedGeography.push({statement:line,reason:qualifier||'missing-role-requirement-context'})
 }
 check(locations.length<=1&&countries.length<=1,'ambiguous native role geography');const location=locations[0]||null,country=countries[0]||null
 check(!(location&&/\bIndia\b/i.test(location)&&country&&!/^(?:India|IN)$/i.test(country)),'explicit native country/location contradiction')
 return {text,location,country,lines,unqualifiedGeography}
}
const readPositions=(payload,department)=>{check(Array.isArray(payload)&&payload.length<=300,'unreviewed department inventory shape');return payload.map(row=>{check(row&&typeof row==='object'&&Object.keys(row).sort().join(',')==='department_id,dept_position,description,id','unreviewed native position fields');check(row.department_id===department.id&&/^\d+$/.test(row.id)&&typeof row.dept_position==='string'&&row.dept_position.trim()&&!/[<>]/.test(row.dept_position)&&typeof row.description==='string','position department/identity contradiction');return {...row,title:norm(row.dept_position),departmentName:department.name}})}
const defaultData=async(url,options)=>JSON.parse(await nativeFetch(url,options))
export const collect=async({fetchText=nativeFetch,fetchData=defaultData,now=()=>new Date().toISOString(),signal,homepageVerifier}={})=>{
 signal?.throwIfAborted();const homepage=await fetchText('https://www.samco.in/',{signal});check(homepageVerifier?.(homepage),'official homepage identity/handoff');const html=await fetchText(SURFACE,{signal}),departments=readDepartments(html),client=advertisedClient(html)
 let reads=2
 const unavailable=(failure,rows=[],verifiedJobs=[])=>finish(verifiedJobs,{recordKind:rows.length?'mixed':'departments',observedRecordCount:departments.length+rows.length,observedVacancyCount:rows.length,observedDepartments:departments,observedDepartmentCount:departments.length,nativeApiPositionCount:rows.length,unqualifiedPositionCandidates:rows.filter(row=>!verifiedJobs.some(job=>job.requisitionId===row.id)),failures:failure.nativeRoleId?[{stage:'native-detail',nativeRoleId:failure.nativeRoleId,kind:failure.kind}]:[],nativeDiscoveryFailures:[failure],actualVacancyCount:null,sourceUnavailable:true,pagesFetched:reads,now})
 if(!client)return unavailable({kind:'missing-advertised-role-client'})
 let javascript;try{javascript=await fetchText(client,{signal});reads++}catch(error){signal?.throwIfAborted();return unavailable({kind:error.code||'native-client-unavailable',status:error.status??null,message:error.message})}
 const routes=readDataRoutes(html,javascript),positions=[],seen=new Set()
 for(const department of departments){let payload;try{payload=await fetchData(routes.getDepartmentPosition.url,{method:'POST',body:new URLSearchParams({[routes.getDepartmentPosition.parameter]:department.id}).toString(),signal});reads++}catch(error){signal?.throwIfAborted();return unavailable({kind:error.code||'native-position-inventory-unavailable',status:error.status??null,message:error.message},positions)}
  const rows=readPositions(payload,department);for(const row of rows){check(!seen.has(row.id),'duplicate native position identity');seen.add(row.id);positions.push(row)}
 }
 const jobs=[]
 for(const row of positions){let details;try{details=await fetchData(routes.getPositionDescription.url,{method:'POST',body:new URLSearchParams({[routes.getPositionDescription.parameter]:row.id}).toString(),signal});reads++}catch(error){signal?.throwIfAborted();return unavailable({kind:error.code||'native-description-unavailable',status:error.status??null,message:error.message,nativeRoleId:row.id},positions,jobs)}
  check(Array.isArray(details)&&details.length===1&&details[0]&&Object.keys(details[0]).join(',')==='description'&&details[0].description===row.description,'listing/detail authoritative JD contradiction')
  const description=readDescription(row.description),jobDescription=description.text.length>80?description.text:null
  jobs.push({title:row.title,company:'SAMCO Securities Limited',department:row.departmentName,location:description.location,city:null,country:description.country,jobId:row.id,requisitionId:row.id,sourceUrl:SURFACE,applyUrl:SURFACE,employmentType:null,workplaceType:null,experienceRequired:null,minimumQualification:null,preferredQualification:null,requiredSkills:[],postingDate:null,closingDate:null,jobDescription,source:SOURCE,link:SURFACE,scrapedAt:now(),companyCareerPage:SURFACE,companyDomain:'samco.in',atsPlatform:'official-company-careers',rawNativeRoleEvidence:{identityQualified:true,nativePositionId:row.id,nativeDepartmentId:row.department_id,nativeDepartmentName:row.departmentName,listingDescriptionHtml:row.description,detailDescriptionHtml:details[0].description,nativeRoleGeographyLines:description.lines.filter(line=>/^(?:Location|Country)\s*[-:]/i.test(line)),unqualifiedNativeGeographyStatements:description.unqualifiedGeography,nativeDataClient:client,readOnlyPositionRoute:routes.getDepartmentPosition.url,readOnlyDescriptionRoute:routes.getPositionDescription.url,applicationSubmissionQualified:false,nativePublicationDate:null,nativeClosingDate:null}})
 }
 return finish(jobs,{recordKind:positions.length?'mixed':'departments',observedRecordCount:departments.length+positions.length,observedVacancyCount:positions.length,observedDepartments:departments,observedDepartmentCount:departments.length,nativeApiPositionCount:positions.length,actualVacancyCount:null,pagesFetched:reads,now})
}
