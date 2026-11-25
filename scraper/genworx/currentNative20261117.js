import{readFileSync}from'node:fs'
import{createHash}from'node:crypto'
import{isDeepStrictEqual as equal}from'node:util'
import{parse}from'acorn'
import{readNativeDocument,activeHead,extractActiveDescription}from'../../scraper-support/utils/activeNativeHtml.js'
import{attachInventoryEvidence}from'../../scraper-support/utils/inventoryEvidence.js'
import{attachSourceObservationEvidence}from'../../scraper-support/utils/sourceObservationEvidence.js'
import{nativeCountryName}from'../../scraper-support/shared/nativeJobPosting.js'
import{currentGenworxTransport}from'./currentTransport20261117.js'
const profile=JSON.parse(readFileSync(new URL('./currentProfile20261117.json',import.meta.url),'utf8'))
const currentRevision=JSON.parse(readFileSync(new URL('./currentProfile20261118.json',import.meta.url),'utf8'))
const deployment20261125=JSON.parse(readFileSync(new URL('./currentProfile20261125.json',import.meta.url),'utf8'))
const primaryRevisions=[profile,deployment20261125],nativeRevisions=[profile,currentRevision,deployment20261125]
const sha=s=>createHash('sha256').update(s).digest('hex'),norm=v=>String(v??'').replace(/\s+/g,' ').trim(),id=v=>typeof v==='string'&&/^\d{8,30}$/.test(v)
const check=(ok,reason)=>{if(!ok)throw Object.assign(Error('GENWORX current native contract: '+reason),{abortRetries:true,failureKind:'parser_or_contract_error',sourceScopeComplete:false,lifecycleCleanupAllowed:false})}
const one=(rows,label)=>{check(rows.length===1,'unique '+label);return rows[0]}
const dataNames=new Set(['csrfToken','jobs','moduleMeta','portalPageJson','meta'])
function closed(n,state={nodes:0},depth=0){
 check(++state.nodes<=30000&&depth<=25,'native literal model bound')
 if(n.type==='Literal'){check(n.value===null||['string','number','boolean'].includes(typeof n.value),'native scalar');return n.value}
 if(n.type==='ArrayExpression'){check(n.elements.length<=2000&&!n.elements.includes(null),'native literal array');return n.elements.map(x=>closed(x,state,depth+1))}
 check(n.type==='ObjectExpression'&&n.properties.length<=1000,'native literal object');const out={},keys=new Set()
 for(const p of n.properties){check(p.type==='Property'&&p.kind==='init'&&!p.computed&&!p.method&&!p.shorthand,'closed native property');const key=p.key.name??p.key.value
  check(typeof key==='string'&&!keys.has(key)&&!['__proto__','prototype','constructor'].includes(key),'unique safe native property');keys.add(key);out[key]=closed(p.value,state,depth+1)}return out
}
function dataValue(n){
 if(n.type==='CallExpression'){check(n.callee.type==='MemberExpression'&&!n.callee.computed&&n.callee.object.name==='JSON'&&n.callee.property.name==='parse'
  &&n.arguments.length===1&&n.arguments[0].type==='Literal'&&typeof n.arguments[0].value==='string','exact closed native JSON carrier');return JSON.parse(n.arguments[0].value)}
 return closed(n)
}
function nativeDocument(html,detail=false){
 const doc=readNativeDocument(html);check(doc.nodes(n=>n.tag==='base'||n.tag==='iframe').length===0,'no additional native navigation carrier')
 check(doc.nodes(n=>n.tag==='div'&&n.attrs.id==='career-website-main').length===1,'active native renderer root')
 const scripts=doc.nodes(n=>n.tag==='script'&&!Object.hasOwn(n.attrs,'nomodule')&&/^(?:|module|(?:text|application)\/javascript)$/i.test(n.attrs.type??''))
 const field=detail?'detailScripts':'boardScripts'
 const revision=one(nativeRevisions.filter(candidate=>candidate[field].length===scripts.length
  &&scripts.every((node,index)=>equal(node.attrs,candidate[field][index].attrs))),'reviewed native complete program revision')
 const expected=revision[field]
 check(scripts.length===expected.length,'complete declared native executable graph');const models={}
 for(let index=0;index<scripts.length;index++){
  const node=scripts[index],want=expected[index];check(equal(node.attrs,want.attrs),'exact native program declaration attributes')
  if(node.attrs.src)continue
  const source=node.raw??'',ast=parse(source,{ecmaVersion:'latest'}),masks=[]
  for(const st of ast.body)if(st.type==='VariableDeclaration')for(const d of st.declarations)if(dataNames.has(d.id?.name)&&d.init){
   const name=d.id.name;check(!Object.hasOwn(models,name),'unique current native data declaration');const value=dataValue(d.init)
   if(name==='csrfToken')check(typeof value==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value),'bounded native CSRF nonce')
   else models[name]=value
   masks.push({name,type:d.init.type,start:d.init.start,end:d.init.end})
  }
  check(equal(masks.map(({name,type})=>({name,type})),want.data),'exact typed native carrier forms')
  const masked=value=>{for(const d of masks.slice().sort((a,b)=>b.start-a.start))value=value.slice(0,d.start)+'<NATIVE-'+d.name+'>'+value.slice(d.end);return value}
  let skeleton=masked(source)
  // The captured native detail varies its phone dialing default by visitor
  // locale. Normalize only the reviewed IN literal back to US at its own AST
  // declaration; the remaining code must still match, including the unchanged
  // selectedCountry/mobileCountryCode flow. Workplace proof uses row.Country.
  if(sha(skeleton)!==want.skeletonSHA256&&detail&&masks.some(d=>d.name==='jobs')&&masks.some(d=>d.name==='meta')){
   const defaults=ast.body.flatMap(st=>st.type==='VariableDeclaration'?st.declarations:[]).filter(d=>d.id?.name==='country')
   if(defaults.length===1&&defaults[0].init?.type==='Literal'&&defaults[0].init.raw==="'IN'"){
    const value=defaults[0].init;skeleton=masked(source.slice(0,value.start)+"'US'"+source.slice(value.end))
   }
  }
  check(sha(skeleton)===want.skeletonSHA256,'whole native executable program profile changed')
 }
 return{doc,models,revision}
}
function checkMeta(meta){
 check(meta&&meta.org_info?.id===profile.nativeOrgId&&meta.org_info.company_name===profile.nativeEmployer&&meta.org_info.website==='www.genworx.ai'
  &&meta.org_info.type==='internal'&&meta.org_info.hide_company_name===false&&meta.employee_portal===false&&meta.page_id===profile.nativePageId
  &&meta.list_url===profile.boardURL&&meta.page_name==='Careers'&&meta.source==='CareerSite'&&meta.date_format==='MM/dd/yyyy'
  &&meta.portal_user?.is_loggedin===false&&!meta.external_url&&!meta.internal_list_url,'native legal employer/page/public identity')
}
function checkRows(rows){
 check(Array.isArray(rows)&&rows.length<=12,'bounded whole native row array');const seen=new Set()
 for(const row of rows){check(row&&id(row.id)&&!seen.has(row.id)&&norm(row.Posting_Title)&&row.Posting_Title===row.Job_Opening_Name
  &&typeof row.Job_Description==='string'&&typeof row.Publish==='boolean'&&typeof row.Is_Locked==='boolean','native row identity/full criteria/state');seen.add(row.id)
  for(const name of['Country','State','City','Work_Experience','Job_Type','Industry'])check(row[name]==null||typeof row[name]==='string','typed native '+name)
  check(typeof row.Date_Opened==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(row.Date_Opened)&&new Date(row.Date_Opened).toISOString().slice(0,10)===row.Date_Opened,'real native posting date')
 }
}
// Exact reviewed native getJobViewUrl expression; preserve its character class.
// eslint-disable-next-line no-useless-escape
const viewURL=row=>profile.boardURL+'/'+row.id+'/'+encodeURIComponent(row.Posting_Title.replace(/["\\~`!@#$%^&\*\(\)=+\[\]\{\}\|:;<>\\\/,\.\?'\s]+/g,'-'))+'?source=CareerSite'
function checkCanonical(value,row){
 let url;try{url=new URL(value)}catch{check(false,'native canonical URL')}
 check(url.origin===new URL(profile.boardURL).origin&&!url.username&&!url.password&&!url.port&&!url.hash
  &&url.pathname.startsWith('/jobs/Careers/'+row.id+'/')&&url.pathname.slice(('/jobs/Careers/'+row.id+'/').length).length>0
  &&!url.pathname.slice(('/jobs/Careers/'+row.id+'/').length).includes('/')&&equal([...url.searchParams],[['source','CareerSite']]),'native per-role canonical identity')
}
function application(payload,formId){
 check(payload?.code==='success'&&Array.isArray(payload.webforms)&&payload.webforms.length===1&&!payload.error&&!payload.errors,'complete native application envelope')
 const form=payload.webforms[0];check(form.id===formId&&form.module?.api_name==='Candidates'&&form.module.name==='Leads'&&Array.isArray(form.sections)&&form.sections.length>0
  &&payload.meta?.portal_user?.is_loggedin===false&&Array.isArray(payload.meta.layout_rules),'native application form identity/sections')
 const ids=new Set();for(const section of form.sections){check(section&&typeof section==='object'&&(Array.isArray(section.fields)||Array.isArray(section.attachmenttypes)),'retained full native form section')
  for(const field of[...(section.fields??[]),...(section.attachmenttypes??[])]){check(field&&id(field.id)&&!ids.has(field.id)&&norm(field.api_name)&&norm(field.field_label)&&norm(field.data_type)
   &&(field.required===undefined&&field.data_type==='tabular'||typeof field.required==='boolean'),'typed native question/requirement');ids.add(field.id)}}
 return payload
}
// Matching plain text cannot account for images, linked documents, script,
// clipping or hidden requirements. Only the current passive rich-text format
// is qualified; original unsupported markup remains in the observation.
function passiveRichCriteria(html){
 const tags=new Set(['root','div','span','br','b','strong','i','em','u','s','p','h1','h2','h3','h4','h5','h6','ul','ol','li','blockquote','pre','code'])
 try{
  const doc=readNativeDocument(html),root=one(doc.nodes(n=>n.tag==='root'),'rich criteria root');let nodes=0
  const visit=(node,depth)=>{
   if(typeof node==='string')return true
   if(++nodes>4000||depth>40||!tags.has(node.tag)||node.inert)return false
   if(Object.entries(node.attrs).some(([name,value])=>name!=='id'||!['spandesc','spanreq'].includes(value)))return false
   return node.children.every(child=>visit(child,depth+1))
  }
  return visit(root,0)
 }catch{return false}
}
export async function runCurrentGenworx(options={}){
 options.signal?.throwIfAborted();const allowed=new Set([profile.boardURL,...primaryRevisions.flatMap(revision=>[revision.primary.url,revision.client.url]),...nativeRevisions.map(revision=>revision.nativeClient.url)])
 const io=currentGenworxTransport({...options,allowedURL:url=>allowed.has(url)}),verifiedAt=new Date().toISOString()
 const exact=async(entry,kind='html')=>{const p=await io.read(entry.url,kind);check(p.bodyBytes===entry.bytes&&p.bodySHA256===entry.sha256,'finite current employer/client original '+entry.url);return p}
 const round=async()=>{
  const home=await io.read(profile.primary.url),primaryRevision=one(primaryRevisions.filter(revision=>home.bodyBytes===revision.primary.bytes&&home.bodySHA256===revision.primary.sha256),'finite current employer deployment')
  check(equal(activeHead(home.text).titles,[profile.primaryTitle]),'current employer title')
  const root=readNativeDocument(home.text),clientPath=new URL(primaryRevision.client.url).pathname
  check(root.nodes(n=>n.tag==='script'&&n.attrs.type==='module'&&n.attrs.src===clientPath).length===1,'active current primary module')
  await exact(primaryRevision.client,'js');const board=await io.read(profile.boardURL),{doc,revision}=nativeDocument(board.text)
  check(equal(activeHead(board.text).titles,[profile.boardTitle]),'native board title');await exact(revision.nativeClient,'js')
  const hidden=name=>{const n=one(doc.nodes(n=>n.tag==='input'&&n.attrs.id===name),'native hidden '+name);check(n.attrs.type==='hidden','native hidden carrier');return JSON.parse(n.attrs.value)}
  const rows=hidden('jobs'),meta=hidden('meta'),pageJson=hidden('pageJson'),moduleMeta=hidden('moduleMeta');checkRows(rows);checkMeta(meta)
  check(Array.isArray(moduleMeta)&&moduleMeta.filter(v=>v.api_name==='Job_Openings').length===1&&pageJson.detail?.section?.data?.length===1,'native module and listing renderer models')
  const details=[]
  for(const row of rows){if(!row.Publish||row.Is_Locked)continue
   const url=viewURL(row);allowed.add(url);const page=await io.read(url),{models,revision:detailRevision}=nativeDocument(page.text,true)
   check(detailRevision.nativeClient.url===revision.nativeClient.url,'native board/detail program revision changed');checkRows(models.jobs);check(models.jobs.length===1&&models.jobs[0].id===row.id,'exact native detail record')
   checkMeta(models.meta);checkCanonical(models.meta.detail_url,row);check(equal(models.meta.org_info,meta.org_info)&&equal(models.portalPageJson,pageJson)&&equal(models.moduleMeta,moduleMeta),'whole native detail employer/renderer/schema binding')
   const detail=models.jobs[0];for(const name of Object.keys(row))if(name!=='Job_Description')check(equal(row[name],detail[name]),'native listing/detail full '+name+' value')
   check(id(models.meta.webform_id),'native published webform identity');const applicationURL=new URL('/recruit/v2/public/Job_Openings/'+row.id+'/apply/'+models.meta.webform_id,new URL(profile.boardURL).origin)
   applicationURL.searchParams.set('pagename',models.meta.page_name);applicationURL.searchParams.set('source',models.meta.source);allowed.add(applicationURL.href)
   const form=application((await io.read(applicationURL.href,'json')).value,models.meta.webform_id),description=extractActiveDescription(detail.Job_Description)
   check(typeof description==='string'&&description.length>0,'full active rich native criteria')
   details.push({row:detail,meta:models.meta,pageJson:models.portalPageJson,moduleMeta:models.moduleMeta,application:form,applicationURL:applicationURL.href,requestedURL:url,
    criteriaTextMatches:norm(row.Job_Description)===norm(description),criteriaMarkupQualified:passiveRichCriteria(detail.Job_Description),description})
  }
  return{rows,meta,pageJson,moduleMeta,details}
 }
 try{
  const opening=await round(),closing=await round();check(equal(opening,closing),'whole closing native vacancy/criteria/question/metadata model changed')
  const jobs=[],failures=[],exclusions=[]
  for(const row of opening.rows){if(!row.Publish||row.Is_Locked){exclusions.push({id:row.id,reason:'native-explicit-unpublished-or-locked',nativeRecord:row});continue}
   const model=one(opening.details.filter(d=>d.row.id===row.id),'retained native detail model'),country=nativeCountryName(row.Country)
   if(country!=='India'){failures.push({id:row.id,reason:country?'native-explicit-foreign-country':'native-country-unknown',nativeRecord:row});continue}
   if(!model.criteriaMarkupQualified){failures.push({id:row.id,reason:'native-rich-criteria-presentation-unqualified',nativeRecord:row});continue}
   if(!model.criteriaTextMatches){failures.push({id:row.id,reason:'native-listing-detail-criteria-presentation-not-certified',nativeRecord:row});continue}
   jobs.push({source:'genworx',company:'Genworx',title:row.Posting_Title,jobId:row.id,requisitionId:row.id,sourceUrl:model.requestedURL,link:model.meta.detail_url,applyUrl:model.meta.detail_url,
    jobDescription:model.description,sourceDescription:model.row.Job_Description,location:[row.City,row.State,'India'].filter(Boolean).join(', '),city:row.City??null,state:row.State??null,country:'India',
    postingDate:row.Date_Opened,nativePublicationDateProvenance:'native-public-Date_Opened',employmentType:row.Job_Type??null,experienceRequired:row.Work_Experience??null,department:row.Industry??null,
    nativeEmployer:opening.meta.org_info,nativeListingRecord:row,nativeDetailRecord:model.row,nativeDetailMeta:model.meta,nativeApplicationModel:model.application,nativeApplicationFormURL:model.applicationURL,
    nativeAssessmentId:model.application.meta.assessment_id??null,applicationVisited:false,publicEligibility:null,applicationValidationQualified:false,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,
    companyCareerPage:profile.boardURL,companyDomain:'genworx.ai',atsPlatform:'zohorecruit',scrapedAt:verifiedAt})
  }
  attachInventoryEvidence(jobs,{status:'coverage-gap',firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,surface:profile.boardURL,pagesFetched:io.receipts.length,reportedTotal:null,indiaFacetCount:null,verifiedAt,
   reason:'current-native-zoho-records-retained;browser-employer-scope-and-assessment-questions-unverified'})
  attachSourceObservationEvidence(jobs,{source:'genworx',recordKind:'vacancy-rows',observedRecordCount:opening.rows.length,observedVacancyCount:opening.rows.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{configurable:true,value:{...jobs.nativeCollectionEvidence,source:'genworx',observedListingCount:opening.rows.length,candidateDetails:opening.details.length,
   extractedDetailJobs:jobs.length,excludedDetailJobs:exclusions.length,exclusions,failures,nativeOpeningInventory:opening,nativeClosingInventory:closing,retainedResponses:io.receipts,
   closingFullNativeInventoryMatch:true,listingPaginationComplete:null,companyGlobalTotal:null,companyIndiaTotal:null,applicationVisited:false,publicEligibility:null,applicationValidationQualified:false,
   sourceScopeComplete:false,browserEquivalenceComplete:false,lifecycleCleanupAllowed:false}})
  return jobs
 }finally{io.close()}
}
