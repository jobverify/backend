import {readFileSync} from 'node:fs'
import {decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {currentReader,nativeUnavailable} from './currentRead20261120.js'
import {need,one,norm,cls,all,disabled,page,props,authoredLines,constraints,projection,mergeObservation,retainDateModels,qualifyApplicationAncestors,schemas,schemaIdentity,schemaPlaces,scalarFields,writtenPlaceCountries,applicantGeography,same} from './currentFacts20261120.js'

export const INDEX='https://www.emergys.com/careers/'
const HOME='https://www.emergys.com/',C={source:'emergys',company:'Emergys',publisher:'Emergys',employer:'Emergys'}
const reference=JSON.parse(readFileSync(new URL('./geography20261120.json',import.meta.url)))
const key=value=>value.replace(/^data[-_:]/i,'').replace(/[-_\s]/g,'').toLowerCase()
function paths(root,target,parents=[]){return root===target?[[...parents,root]]:root.children.filter(n=>typeof n!=='string').flatMap(n=>paths(n,target,[...parents,root]))}
const ancestry=(p,target)=>one(paths(p.root,target),'native own carrier ancestry').filter(n=>n.tag!=='root')
function fieldLines(node){const original=authoredLines(node);return[...original,...original.flatMap((line,i)=>/^[^:]{1,45}\s*:$/.test(line)&&original[i+1]?[line+' '+original[i+1]]:[])]}
function wholeGeography(labels){
 need(labels.length>0&&labels.length<=32,'own role workplace missing/excessive')
 const alternatives=labels.map(label=>{const proof=reference.places.find(p=>p.labels.some(l=>norm(l).toLowerCase()===norm(label).toLowerCase())),countries=writtenPlaceCountries(label);need(countries.length<=1,'one whole own workplace contradicts itself');return{label,proof:proof??null,countries:proof?['India']:countries}})
 need(alternatives.some(a=>a.countries.includes('India')),'actual whole role workplace lacks independent India evidence')
 return{alternatives,countries:[...new Set(alternatives.flatMap(a=>a.countries))],proof:alternatives.flatMap(a=>a.proof?[a.proof]:[])}
}
const splitPlaces=value=>value.split('/').map(norm).filter(Boolean)
function validateOwnRole(value){const u=new URL(value,INDEX);need(u.origin===new URL(HOME).origin&&!u.username&&!u.password&&!u.search&&!u.hash&&/^\/careers\/[a-z0-9-]+\/$/.test(u.pathname),'current own role URI differs');return u.href}
function qualify(nodes,blocks,config,{form=null}={}){
 need(nodes.every(n=>!disabled(n)),'native own role/application carrier explicitly disabled')
 const properties=nodes.flatMap(n=>props([n]).filter(p=>n!==form||p.key!=='data-status'))
 for(const p of properties)if(['applicationurl','applyurl','jobapplicationurl'].includes(key(p.key)))need(typeof p.value==='string'&&config.applicationURLs.includes(new URL(p.value,INDEX).href),'native authored application URL alias differs')
 return constraints(properties,blocks,config)
}
function structuredModels(p){return p.d.nodes(n=>n.tag==='script'&&!n.attrs.src&&n.attrs.type==='application/ld+json').map(n=>{try{return JSON.parse(n.raw)}catch{need(false,'native structured original is malformed')}})}
function publisher(p){
 const roots=structuredModels(p),graphs=roots.flatMap(root=>root?.['@graph']??[root]),org=one(graphs.filter(m=>m?.['@type']==='Organization'&&m['@id']===HOME+'#organization'),'native own publisher organization')
 need(org.name===C.publisher&&org.url===HOME,'native exact own publisher differs')
 need(roots.some(root=>/^https?:\/\/schema\.org\/?$/.test(root?.['@context']??'')&&(root===org||root['@graph']?.includes(org))),'native own publisher context differs')
 const scripts=p.d.nodes(n=>n.tag==='script'&&!n.attrs.src&&n.attrs.type==='application/ld+json'),carriers=scripts.filter((_,i)=>roots[i]===org||roots[i]?.['@graph']?.includes(org))
 return{roots,graphs,organization:org,carriers}
}
function structuredRole(p,row,geo,dates,applicationURLs){
 const originals=schemas(p).filter(model=>norm(model.title)===row.title)
 for(const model of originals){
  schemaIdentity(model,row,C.employer)
  for(const field of['url','sameAs'])if(model.hiringOrganization[field]!=null){const values=Array.isArray(model.hiringOrganization[field])?model.hiringOrganization[field]:[model.hiringOrganization[field]];need(values.every(url=>new URL(url).href===HOME),'same-role explicit employer URI differs')}
  for(const field of Object.keys(model).filter(k=>['applicationurl','applyurl','jobapplicationurl'].includes(key(k))))need(typeof model[field]==='string'&&applicationURLs.includes(new URL(model[field],row.url).href),'same-role structured application differs')
  applicantGeography(model);const places=model.jobLocation==null?[]:schemaPlaces(model);if(places.length)need(places.some(place=>place.country==='India'),'same-role structured workplace excludes India')
  const cities=geo.alternatives.flatMap(a=>[a.proof?.city,a.label.replace(/,\s*India(?:\s*\([^)]*\))?$/i,'')]).filter(Boolean).map(value=>norm(value).toLowerCase())
  for(const place of places.filter(place=>place.country==='India'&&place.city!=null))need(cities.includes(norm(place.city).toLowerCase()),'same-role structured locality contradicts current own workplace')
  const config={employer:C.employer,observedAt:row.observedAt,countryAlternatives:[...new Set([...geo.countries,...places.map(place=>place.country)])]},more=constraints(scalarFields(model),[],config)
  dates.posted.push(...more.posted);dates.expiry.push(...more.expiry)
  if(typeof model.description==='string'){const fragment=page(model.description,row.url,{canonical:false,requireTitle:false}),extra=constraints(props(all(fragment.root,()=>true)),fieldLines(fragment.root),config);dates.posted.push(...extra.posted);dates.expiry.push(...extra.expiry)}
 }
 return originals
}
export function currentPublication(html){
 const p=page(html,INDEX),owner=publisher(p)
 need(/\bEmergys\b/.test(p.title),'current own careers publisher title differs')
 const heading=one(p.d.nodes(n=>n.tag==='h1'&&p.d.text(n)==='Careers Begin At Emergys'),'native own careers heading'),main=one(p.d.nodes(n=>n.tag==='main'),'native current openings main')
 need(p.d.nodes(n=>/^h[1-6]$/.test(n.tag)&&p.d.text(n)==='New Openings',main).length===1,'actual current native openings heading missing')
 const cards=p.d.nodes(n=>n.tag==='li'&&cls(n,'career-box-border'),main);need(cards.length>0&&cards.length<=500,'current own nonempty native cards unavailable/excessive')
 const originalCards=p.raw.nodes(n=>n.tag==='li'&&cls(n,'career-box-border'));need(originalCards.length===cards.length,'original current native card ownership differs')
 const rows=cards.map((card,index)=>{const title=one(p.d.nodes(n=>n.tag==='h3',card),'native advertised role title'),link=one(p.d.nodes(n=>n.tag==='a',title),'current advertised public role link'),url=validateOwnRole(link.attrs.href);return{id:new URL(url).pathname.split('/').filter(Boolean).at(-1),title:p.d.text(link),url,originalCardHTML:p.raw.outer(originalCards[index])}})
 return{p,owner,heading,main,cards,rows,originalHeadingAttributes:structuredClone(heading.attrs),originalContinuationDescriptors:p.d.nodes(n=>['a','button'].includes(n.tag)&&(n.attrs.rel==='next'||/^(?:next|load more|show more)\b/i.test(p.d.text(n))),main).map(n=>({tag:n.tag,attributes:structuredClone(n.attrs),text:p.d.text(n)}))}
}
export function publicationRole(row,view,{observedAt}={}){
 const {p}=view,card=one(view.cards.filter(n=>p.d.nodes(a=>a.tag==='a'&&new URL(a.attrs.href,INDEX).href===row.url,n).length===1),'same native public card'),link=one(p.d.nodes(n=>n.tag==='a'&&new URL(n.attrs.href,INDEX).href===row.url,card),'own title URI')
 need(p.d.text(link)===row.title&&row.title,'current own title binding differs')
 const lines=fieldLines(card),places=[...new Set(lines.filter(line=>/^Location\s*:\s*.+/i.test(line)).map(line=>line.replace(/^Location\s*:\s*/i,'')))];need(places.length===1,'native card workplace label missing/ambiguous')
 const labels=splitPlaces(places[0]),geo=wholeGeography(labels),config={employer:C.employer,observedAt,countryAlternatives:geo.countries,applicationURLs:[row.url]},nodes=[...ancestry(p,view.heading),...ancestry(p,card),...all(card,()=>true),...view.owner.carriers],dates=qualify(nodes,lines,config),structured=structuredRole(p,{...row,observedAt},geo,dates,[row.url])
 const application={kind:'current-own-published-role-URI-public-handoff',url:row.url,publicIntakeOnly:true,backendActivationVerified:false},model={binding:{id:row.id,title:row.title,publisher:C.publisher,employer:C.employer,publicURL:row.url,applicationURL:row.url},originalCardHTML:row.originalCardHTML,originalScopeAttributes:nodes.map(n=>structuredClone(n.attrs)),originalFields:{Location:places[0]},originalStructuredModels:structured}
 const job=projection(C,{...row,locations:labels},model,{application,dates,countryEvidence:{kind:'same-role-exact-whole-native-municipal-workplace',typedCountryAsserted:false,originalWorkplace:places[0],originalAlternatives:geo.alternatives,independentMunicipalReferences:geo.proof,inferredFromCorporateAddress:false},city:geo.proof.length===1?geo.proof[0].city:null})
 Object.assign(job,{nativePublicJobId:null,requisitionId:null,sourceNativeIdentity:{internalURLDerivedIdentity:row.id,nativePublicJobID:null,formalRequisitionExplicitlyAuthored:false},sourceNativeOptionalDetailModels:[],sourcePostingDateIsExplicitJobPosting:false,nativeLegalEmployer:null,scrapedAt:observedAt})
 return job
}
function roleIntake(p,row){
 const form=one(p.d.nodes(n=>n.tag==='form'&&p.d.nodes(x=>x.tag==='input'&&x.attrs.name==='_wpcf7_container_post',n).length===1),'same own role resume intake'),container=one(p.d.nodes(n=>n.tag==='input'&&n.attrs.name==='_wpcf7_container_post',form),'native CMS container-post field'),formID=one(p.d.nodes(n=>n.tag==='input'&&n.attrs.name==='_wpcf7',form),'native form ID'),unit=one(p.d.nodes(n=>n.tag==='input'&&n.attrs.name==='_wpcf7_unit_tag',form),'native form unit'),resume=one(p.d.nodes(n=>n.tag==='input'&&n.attrs.type==='file'&&n.attrs.name==='your-file',form),'native resume field'),submit=one(p.d.nodes(n=>n.tag==='input'&&n.attrs.type==='submit',form),'native submit control')
 need(/^\d+$/.test(container.attrs.value??'')&&/^\d+$/.test(formID.attrs.value??''),'native own CMS/form identity malformed')
 const expected=unit.attrs.value,action=new URL(form.attrs.action,row.url).href
 need(typeof expected==='string'&&new RegExp('^wpcf7-f'+formID.attrs.value+'-p'+container.attrs.value+'-o[1-9][0-9]*$').test(expected),'native own form unit is disconnected from its form/CMS identity')
 need(form.attrs.method?.toLowerCase()==='post'&&action===row.url+'#'+expected&&unit.attrs.value===expected,'same-own-role native public form action/identity/method differs')
 const wrapper=one(p.d.nodes(n=>n.attrs.id===expected&&p.d.nodes(x=>x===form,n).length===1),'same-role native CF7 wrapper'),post=one(p.d.nodes(n=>n.attrs.id==='post-'+container.attrs.value),'native role CMS post owner')
 need(p.d.nodes(n=>n===form,post).length===1,'native application associated with another CMS role')
 for(const n of p.d.nodes(n=>['input','textarea','button','select'].includes(n.tag),form)){if(n.attrs.form!=null)need(Boolean(form.attrs.id)&&n.attrs.form===form.attrs.id,'native control reassociated to another form');if(n.attrs.formaction!=null)need(new URL(n.attrs.formaction,row.url).href===action,'native submit action differs');if(n.attrs.formmethod!=null)need(n.attrs.formmethod.toLowerCase()==='post','native submit method differs')}
 qualifyApplicationAncestors(p,[resume,submit])
 return{form,wrapper,post,resume,submit,action,originalContainerPost:container.attrs.value,originalFormID:formID.attrs.value,originalUnitTag:unit.attrs.value,originalFormHTML:p.raw.outer(one(p.raw.nodes(n=>n.tag==='form'),'original native role form'))}
}
export function optionalRole(html,row,{observedAt}={}){
 const p=page(html,row.url),owner=publisher(p),heading=one(p.d.nodes(n=>n.tag==='h1'),'native own role heading');need(p.d.text(heading)===row.title&&p.title.includes(C.publisher),'current own role title/publisher differs')
 const main=one(p.d.nodes(n=>n.tag==='main'),'same own role main'),application=roleIntake(p,row),config={employer:C.employer,observedAt,countryAlternatives:row.countryAlternatives??['India'],applicationURLs:[row.url,application.action]},nodes=[...ancestry(p,heading),...ancestry(p,application.form),...all(main,()=>true),...owner.carriers],dates=qualify(nodes,fieldLines(main),config,{form:application.form}),blocks=p.d.nodes(n=>n.tag==='div'&&cls(n,'fusion-text'),main),content=blocks[0]??null
 const lines=content?fieldLines(content):[],locationValues=[...new Set(lines.filter(line=>/^Location\s*:\s*.+/i.test(line)).map(line=>line.replace(/^Location\s*:\s*/i,'')))];need(locationValues.length<=1,'same-role full workplace labels conflict')
 const geo=locationValues.length?wholeGeography(splitPlaces(locationValues[0])):row.geo
 const rawMain=one(p.raw.nodes(n=>n.tag==='main'),'original own role main'),rawContent=p.raw.nodes(n=>n.tag==='div'&&cls(n,'fusion-text'),rawMain)[0]??null
 const nativePagePublications=[],articles=owner.graphs.filter(m=>m?.['@type']==='Article'&&m['@id']===row.url+'#article'),pages=owner.graphs.filter(m=>m?.['@type']==='WebPage'&&m['@id']===row.url)
 need(articles.length<=1&&pages.length<=1,'same own role publication models ambiguous')
 for(const model of[...articles,...pages]){
  if(Object.hasOwn(model,'@context'))need(/^https?:\/\/schema\.org\/?$/.test(model['@context']),'same-role native page explicit context contradicts qualified schema')
  for(const field of Object.keys(model).filter(k=>['applicationurl','applyurl','jobapplicationurl'].includes(key(k))))need(typeof model[field]==='string'&&config.applicationURLs.includes(new URL(model[field],row.url).href),'same-role native page application alias differs')
  for(const field of['hiringOrganization','company'])if(model[field]!=null&&typeof model[field]==='object'){need(!Array.isArray(model[field])&&model[field].name===C.employer,'same-role native page employer object differs');for(const k of['url','sameAs'])if(model[field][k]!=null){const values=Array.isArray(model[field][k])?model[field][k]:[model[field][k]];need(values.every(url=>new URL(url).href===HOME),'same-role native page employer URI differs')}}
  applicantGeography(model)
  for(const field of['workLocation','workplace','location'])if(model[field]!=null){need(typeof model[field]==='string','same-role native page whole workplace field malformed');const more=constraints([],['Work Location: '+model[field]],config);dates.posted.push(...more.posted);dates.expiry.push(...more.expiry)}
  if(model.jobLocation!=null){const places=schemaPlaces(model);need(places.some(place=>place.country==='India'),'same-role native page workplace excludes India')}
  if(model['@type']==='Article')need(norm(decodeNativeEntities(model.headline))===row.title&&model.mainEntityOfPage?.['@id']===row.url&&model.publisher?.['@id']===HOME+'#organization','native role article identity/publisher differs')
  else need(model.url===row.url,'native role webpage identity differs')
  if(model.datePublished!=null){need(typeof model.datePublished==='string','native role-page publication malformed');const original={kind:model['@type']+'.datePublished',raw:model.datePublished,isExplicitJobPostingDate:false,meaning:'Original publication of this exact public role page; not first-ever requisition publication'},more=constraints([{key:'publicationDate',value:model.datePublished.replace(/\+00:00$/,'Z')}],[],config);nativePagePublications.push(original);dates.posted.push(...more.posted.map(value=>({...value,raw:original.raw,field:original.kind,isExplicitJobPostingDate:false,meaning:original.meaning})))}
  const more=constraints(scalarFields(model).filter(value=>value.key!=='datePublished'),[],config);dates.posted.push(...more.posted);dates.expiry.push(...more.expiry)
 }
 const structured=structuredRole(p,{...row,observedAt},geo,dates,config.applicationURLs),hidden=content?all(content,n=>n.inert||n.inactive||Object.hasOwn(n.attrs,'hidden')||n.attrs['aria-hidden']==='true').length>0:false
 return{binding:{id:row.id,title:row.title,publisher:C.publisher,employer:C.employer,publicURL:row.url,applicationURL:row.url,originalContainerPost:application.originalContainerPost,originalFormID:application.originalFormID,formActionBase:row.url},originalNativeSchemas:owner.roots,originalStructuredModels:structured,originalMainHTML:p.raw.outer(rawMain),originalCriteriaHTML:rawContent?p.raw.outer(rawContent):null,sourceDescription:content?p.d.text(content)||null:null,hiddenCriteria: hidden,originalRolePagePublications:nativePagePublications,originalModifiedFields:[...articles,...pages].map(model=>({kind:model['@type'],dateModified:model.dateModified??null})),originalWorkplace:locationValues[0]??null,originalGeo:geo,originalFormHTML:application.originalFormHTML,originalFormAttributes:structuredClone(application.form.attrs),originalFormLifecycleStatus:application.form.attrs['data-status']??null,originalScopeAttributes:nodes.map(n=>structuredClone(n.attrs)),application:{kind:'same-canonical-role-native-CF7-resume-intake',url:row.url,originalFormAction:application.action,originalContainerPost:application.originalContainerPost,originalFormID:application.originalFormID,originalUnitTag:application.originalUnitTag,backendActivationVerified:false,publicIntakeOnly:true},dates}
}
function addDetail(job,detail,phase){
 const prior=job.sourceNativeOptionalDetailModels.at(-1);if(prior)need(same(prior.model.binding,detail.binding),'own closing role/application identity differs')
 job.sourceNativeOptionalDetailModels.push({phase,model:structuredClone(detail)});retainDateModels(job,detail.dates)
 if(detail.sourceDescription&&!job.sourceDescription?.includes(detail.sourceDescription)){job.sourceDescription=[job.sourceDescription,detail.sourceDescription].filter(Boolean).join('\n\n');job.jobDescription=job.sourceDescription}
 job.sourceRawDescriptionHtml=detail.originalCriteriaHTML??job.sourceRawDescriptionHtml
 Object.assign(job.sourceNativeApplication,detail.application,{activationVerified:false,allControlsQualified:false,submitted:false})
 job.sourceNativeCMSIdentity={containerPost:detail.binding.originalContainerPost,formID:detail.binding.originalFormID,meansFormalRequisition:false,meansNativeJobID:false}
 job.sourceHiddenCriteriaUnreviewed=Boolean(job.sourceHiddenCriteriaUnreviewed||detail.hiddenCriteria);job.sourceCriteriaStatus=job.sourceDescription?'present-unreviewed-full-controls-and-company-scope':'missing';job.sourcePostingDateIsExplicitJobPosting=false
 job.detailClosingQualified=phase==='closing';job.sourceDetailClosingQualified=job.detailClosingQualified;job.sourceCriteriaObservationConflict=Boolean(prior&&!same(prior.model,detail));return job
}
export async function runCurrentPublications(options={}){
 options.signal?.throwIfAborted();need(options.maxJobs==null||options.maxJobs===0,'Positive partial maxJobs unsupported');need(!options.fetchText&&!options.fetchJson&&!options.fetchPage,'original native Responses required')
 const at=new Date(typeof options.now==='function'?options.now():options.now??new Date().toISOString()).toISOString(),io=currentReader([INDEX],[new URL(HOME).origin],options),jobs=[],views=[],audit={source:C.source,nativeOpeningInventory:[],nativeClosingInventory:[],held:[],optionalDetailFailures:[],nativeRoleModels:[],originalResponses:[],sourceSearchSurfaceComplete:false,sourceSearchSurfaceClosingQualified:false,sourceScopeComplete:false,companyIndiaTotal:null,companyGlobalTotal:null,lifecycleCleanupAllowed:false,allApplicationControlsQualified:false,backendActivationVerified:false,applicationsSubmitted:false,nativeProgramsExecuted:false}
 try{
  if(options.maxJobs===0){audit.sourceCallerLimited=true;audit.sourceAcquisitionAttempted=false;Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true});if(options.onAudit)await io.callback(options.onAudit,structuredClone(audit));io.check();return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:INDEX,firstParty:true,listingComplete:false,pagesFetched:0,reportedTotal:null,indiaFacetCount:null,verifiedAt:null,lifecycleCleanupAllowed:false,reason:'explicit-caller-zero-cap-no-acquisition;native-inventory-unknown'})}
  audit.sourceAcquisitionAttempted=true
  for(const phase of['opening','closing']){const view=currentPublication((await io.read(INDEX)).text);views.push(view);audit['native'+(phase==='opening'?'Opening':'Closing')+'Inventory']=structuredClone(view.rows);audit[phase+'ContinuationDescriptors']=view.originalContinuationDescriptors}
  const index=rows=>rows.reduce((map,row)=>(map.set(row.id,[...(map.get(row.id)??[]),row]),map),new Map()),opening=index(views[0].rows),closing=index(views[1].rows)
  for(const row of views[0].rows)try{need(opening.get(row.id)?.length===1&&closing.get(row.id)?.length===1,'closing native role identity missing/duplicate');const first=publicationRole(row,views[0],{observedAt:at}),last=publicationRole(closing.get(row.id)[0],views[1],{observedAt:at}),job=mergeObservation(mergeObservation(null,first,'opening'),last,'closing');job.detailClosingQualified=false;job.sourceDetailClosingQualified=false;jobs.push(job)}catch(error){io.check();audit.held.push({id:row.id,title:row.title,reason:error.message,originalOpeningRow:row,originalClosingRows:closing.get(row.id)??[]})}
  for(const job of[...jobs]){
   const row={id:job.jobId,title:job.title,url:job.sourceUrl,geo:wholeGeography(job.sourceNativeRecord.locations??job.location.split(' / ')),countryAlternatives:job.sourceCountryEvidence.originalAlternatives.flatMap(a=>a.countries)};io.allow(row.url)
   try{for(const phase of['opening','closing']){const model=optionalRole((await io.read(row.url)).text,row,{observedAt:at});addDetail(job,model,phase);audit.nativeRoleModels.push({id:row.id,phase,model})}}
   catch(error){io.check();job.detailClosingQualified=false;job.sourceDetailClosingQualified=false;audit.optionalDetailFailures.push({id:row.id,url:row.url,status:error.status??null,reason:error.message,knownOpeningFactsPreserved:nativeUnavailable(error)});if(!nativeUnavailable(error)){jobs.splice(jobs.indexOf(job),1);audit.held.push({id:row.id,title:row.title,reason:error.message,originalKnownPublication:job.sourceNativeRoleModels,originalOptionalModels:job.sourceNativeOptionalDetailModels})}if(io.denied.has(new URL(row.url).origin))break}
  }
  audit.sourceSearchSurfaceClosingQualified=true;audit.observedAt=at;audit.originalResponses=structuredClone(io.receipts)
  attachSourceObservationEvidence(jobs,{source:C.source,recordKind:'vacancy-rows',observedRecordCount:audit.nativeOpeningInventory.length,observedVacancyCount:audit.nativeOpeningInventory.length,sourceScopeComplete:false,companyIndiaTotal:null,companyGlobalTotal:null});Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true});if(options.onAudit)await io.callback(options.onAudit,structuredClone(audit));io.check()
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:INDEX,firstParty:true,listingComplete:false,pagesFetched:io.receipts.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:at,lifecycleCleanupAllowed:false,reason:'current-own-native-published-card-and-role-page-intake;original-public-role-page-dates-not-first-requisition;valid-partials;company-allchannels-full-controls-backend-legal-employer-and-cleanup-unverified'})
 }catch(error){io.check();if(error&&typeof error==='object')error.nativeEvidence={...audit,originalResponses:structuredClone(io.receipts)};throw error}finally{io.close()}
}
