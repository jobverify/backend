import {createHash} from 'node:crypto'
import {performance} from 'node:perf_hooks'
import {parse} from 'acorn'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {decodeNativeEntities,extractActiveDescription,readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {createRecruitmentObservationAccounting} from '../../scraper-support/utils/recruitmentObservationAccounting.js'

const ORIGIN='https://raymondcareers.peoplestrong.com',PARTS='basic,organisational,descriprion,workflow,skill,qualification,certification,language,applied'
const accountURL=ORIGIN+'/api/cp/rest/altone/cp/urlinfo'
const coreName='chunk-IFMVPRQ7.js',roleName='chunk-MP77JDEN.js'
// Exact complete current public programs reviewed with the dated response
// fixtures. A changed executable requires contract review, including comments,
// endpoint construction and the external/internal rendering policy.
const nativeProgramSHA={main:'f232fae4810bf9d0a51c7621b7ffe4b9cd175a73c98006b4fdc565422d866c83',
 core:'aab6fd14131be8bbc94491b71fdad60b0dd2f9be97580566fed90d0f76d65b2c',role:'2c8731b9c4836c4f0569c71fcb54b26ecad9e43db290d9e039a9b482e7b43e1c'}
const sha=b=>createHash('sha256').update(b).digest('hex')
const text=v=>typeof v==='string'?v.replace(/\s+/g,' ').trim():''
const requireValue=(ok,message)=>{if(!ok)throw Object.assign(Error('[raymond] '+message),{softFailure:true,abortRetries:true,failureKind:'coverage_gap'})}
const envelope=p=>{requireValue(p?.messageCode?.code===200&&p.messageCode.messages==='success'&&p.response&&typeof p.response==='object','Native response envelope changed');return p.response}
const scan=(root,visit)=>{
 const parents=[];let count=0
 const walk=node=>{if(!node||typeof node.type!=='string')return;requireValue(++count<=1000000&&parents.length<512,'Corporate AST inspection budget exhausted');visit(node,parents);parents.push(node)
  for(const value of Object.values(node))if(Array.isArray(value)){for(const child of value)walk(child)}else if(value&&typeof value==='object')walk(value)
  parents.pop()
 };walk(root)
}
const key=p=>p.type==='Property'&&!p.computed&&(p.key.type==='Identifier'?p.key.name:p.key.value)
const fields=node=>new Map(node.properties.map(p=>[key(p),p.value]))
const member=(node,object,property)=>node?.type==='MemberExpression'&&!node.computed&&node.object.name===object&&node.property.name===property
const corporateDelegation=bundle=>{
 const ast=parse(bundle,{ecmaVersion:'latest',sourceType:'script'}),arrays=[],maps=[],uses=[]
 scan(ast,(node,parents)=>{
  if(node.type==='VariableDeclarator'&&node.id.type==='Identifier'&&node.init?.type==='ArrayExpression'){
   const objects=node.init.elements.filter(n=>n?.type==='ObjectExpression'),apply=objects.filter(n=>fields(n).get('question')?.value==='Apply Now')
   if(apply.length===1)arrays.push({name:node.id.name,values:fields(apply[0])})
  }
  if(node.type==='CallExpression'&&node.callee.type==='MemberExpression'&&!node.callee.computed&&node.callee.property.name==='map'
   &&node.callee.object.type==='Identifier'&&['FunctionExpression','ArrowFunctionExpression'].includes(node.arguments[0]?.type)){
   const callback=node.arguments[0],name=callback.params[0]?.name,owner=[...parents].reverse().find(p=>p.type==='VariableDeclarator'&&['FunctionExpression','ArrowFunctionExpression'].includes(p.init?.type))
   if(name&&owner){let link=false,label=false;scan(callback,n=>{if(n.type==='Property'){if(key(n)==='anchorLink'&&member(n.value,name,'cta'))link=true;if(key(n)==='ctaText'&&member(n.value,name,'ctaName'))label=true}});if(link&&label)maps.push({array:node.callee.object.name,component:owner.id.name})}
  }
  const callee=node.type==='CallExpression'&&(node.callee.type==='SequenceExpression'?node.callee.expressions.at(-1):node.callee)
  if(callee?.type==='MemberExpression'&&['jsx','jsxs'].includes(callee.property.name)&&node.arguments[0]?.type==='Identifier'){
   const owner=[...parents].reverse().find(p=>['FunctionExpression','ArrowFunctionExpression'].includes(p.type));if(owner)uses.push({component:node.arguments[0].name,owner})
  }
 })
 const proofs=arrays.filter(array=>array.values.get('cta')?.value===ORIGIN+'/'&&array.values.get('ctaName')?.value==='Apply Now'
  &&maps.some(map=>map.array===array.name&&uses.some(use=>{if(use.component!==map.component)return false;let heading=false;scan(use.owner,n=>{if(n.type==='Literal'&&n.value==='Talent Acquisition')heading=true});return heading})))
 requireValue(proofs.length===1,'Current active corporate Apply Now delegation changed')
}
const employerCriteriaAgree=(html,employer)=>{
 const doc=readNativeDocument(html),excluded=new Set(['blockquote','q','pre','code','template','noscript','script','style','textarea','iframe','object'])
 const boundaries=new Set(['address','article','aside','body','br','caption','dd','details','dialog','div','dl','dt','fieldset','figcaption','figure','footer','form','h1','h2','h3','h4','h5','h6','header','hgroup','hr','html','li','main','menu','nav','ol','p','section','summary','table','tbody','td','tfoot','th','thead','tr','ul'])
 const active=node=>typeof node==='string'?node:node.inert||excluded.has(node.tag)?'':
  (boundaries.has(node.tag)?'\n':'')+node.children.map(active).join('')+(boundaries.has(node.tag)?'\n':'')
 const blocks=active(doc.nodes(n=>n.tag==='root')[0]).split(/\r?\n/).map(line=>text(decodeNativeEntities(line))).filter(Boolean)
 const label=/^(?:legal employer|employer|hiring organization|company name|employing entity)(?:\s*[:-]\s*(.*)|\s*)$/i
 for(let at=0;at<blocks.length;at++){const match=blocks[at].match(label);if(match)requireValue((text(match[1])||blocks[at+1])===employer,'Own active employer label conflicts with native legal hierarchy')}
 const visible=blocks.join(' ')
 requireValue(!/\bnot (?:be )?(?:employed by|an? employee of)\b/i.test(visible),'Own active employer denial')
 for(const match of visible.matchAll(/\b(?:you will be|you are|the successful candidate will be)\s+(?:employed|hired)\s+by\s+([^.!?;]+)[.!?;]/gi))requireValue(text(match[1])===employer,'Own active employment statement conflicts with native employer')
}
const day=value=>{
 const match=typeof value==='string'&&value.match(/^(\d{4}-\d{2}-\d{2})(?: 00:00:00\.0)?$/)
 requireValue(match&&new Date(match[1]+'T00:00:00Z').toISOString().slice(0,10)===match[1],'Invalid native calendar date')
 return match[1]
}
const regions=new Intl.DisplayNames(['en'],{type:'region'}),foreign=[]
for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){
 const code=String.fromCharCode(a,b),name=regions.of(code)
 if(name!==code&&code!=='IN'&&!['ZZ','EU','UN','XA','XB','QO'].includes(code))foreign.push(name.toLowerCase().match(/[\p{L}\p{N}]+/gu))
}
const indiaHierarchy=value=>{
 requireValue(typeof value==='string','Native explicit geography missing')
 const parts=value.split('>').map(text);requireValue(parts.length===4&&parts[0]==='India'&&parts.every(Boolean),'Native explicit India tuple missing')
 const words=value.toLowerCase().match(/[\p{L}\p{N}]+/gu)||[]
 requireValue(!foreign.some(country=>words.some((_,at)=>country.every((word,n)=>words[at+n]===word))),'Contradictory native written country')
 return parts
}
const visiblePolicy=policy=>{
 for(const key of ['basicSectionRendered','jobTitleRendered','jobCodeRendered','startDateRendered','closingDateRendered',
  'experienceRendered','skillSectionRendered','minQualificationRendered','workingLanguageRendered','sourcingGuidelineRendered',
  'jobdescriptionSectionRendered','jobDescriptionRendered'])requireValue(policy[key]===true,'Native visible section changed: '+key)
 for(const key of ['internalJobDescriptionRendered','workflowSectionRendered','certificationRendered','eduSpecializationRendered','goodtohaveSkillsRendered','targetNationalityRendered','promoteEmiratesRendered'])
  requireValue(policy[key]===false,'Native external/internal render policy changed: '+key)
}

export async function collectRaymondNative(options,contract){
 const {CAREERS_PAGE_URL,JOB_LISTINGS_URL,buildApiUrl,extractSearchResults}=contract
 void contract.hasOfficialCareersShell
 void contract.extractClientBundleUrl
 void contract.hasVerifiedApplyNowHandoff
 const {hasPublicPortalShell}=contract
 const timeout=options.sourceTimeoutMs??90000,maxPages=options.maxPages??24,maxRequests=options.maxRequests??100
 requireValue(Number.isSafeInteger(timeout)&&timeout>0&&timeout<=180000&&Number.isSafeInteger(maxPages)&&maxPages>0&&maxPages<=100&&Number.isSafeInteger(maxRequests)&&maxRequests>0&&maxRequests<=280,'Invalid native budgets')
 const controller=new AbortController(),started=performance.now(),timer=setTimeout(()=>controller.abort(new DOMException('Raymond source deadline exceeded','TimeoutError')),timeout)
 const signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
 const check=()=>{options.signal?.throwIfAborted();if(performance.now()-started>=timeout&&!controller.signal.aborted)controller.abort(new DOMException('Raymond source deadline exceeded','TimeoutError'));signal.throwIfAborted()}
 const receipts=[];let requests=0,aggregate=0
 const read=async(url,{kind='json',body,portal=false}={})=>{
  check();requireValue(++requests<=maxRequests,'Native request budget exhausted')
  const request={method:body===undefined?'GET':'POST',...(body===undefined?{}:{body})}
  const requestedAt=new Date().toISOString()
  const raw=await boundedDeclaredPublicRead(url,{signal,timeoutMs:15000,overflowError:Error('Raymond response exceeds byte limit'),request,
   fetchImpl:(target,init)=>(options.fetchImpl||fetch)(target,{...init,credentials:'omit',headers:{...init.headers,Accept:kind==='json'?'application/json':kind==='js'?'application/javascript':'text/html',...(body===undefined?{}:{'Content-Type':'application/json'})}})})
  check();const bytes=Buffer.from(raw.bodyBase64,'base64');requireValue(bytes.length<=4e6&&(aggregate+=bytes.length)<=16e6,'Native response byte budget exhausted')
  const mime=(raw.headers['content-type']||'').split(';')[0].trim().toLowerCase()
  receipts.push({url,method:request.method,...body===undefined?{}:{requestBody:body},status:raw.status,finalURL:raw.url,bodyBytes:bytes.length,bodySHA256:sha(bytes),requestedAt,completedAt:new Date().toISOString()})
  requireValue(raw.url===url&&(raw.status===200||portal&&raw.status===404),'Native transport status or final authority changed')
  requireValue(kind==='json'?mime==='application/json':kind==='js'?['application/javascript','text/javascript'].includes(mime):['text/html','application/xhtml+xml'].includes(mime),'Native response MIME changed')
  const content=bytes.toString('utf8'),value=kind==='json'?JSON.parse(content):content;check();return value
 }
 const accounting=createRecruitmentObservationAccounting('raymond'),failures=[],parsed=[];let rows=[],pages=[],listingComplete=false,closingMatches=false
 const collection=()=>({source:'raymond',observedListingCount:rows.length,observedRecords:rows,candidateDetails:rows.length,extractedDetailJobs:parsed.length,excludedDetailJobs:0,exclusions:[],jobs:parsed.map(j=>({id:j.jobId,url:j.sourceUrl})),failures,
  listingPaginationComplete:listingComplete,closingInventoryMatches:closingMatches,sourceScopeComplete:false,retainedResponses:receipts})
 try{
  check();const now=options.now?options.now():new Date().toISOString();requireValue(Number.isFinite(Date.parse(now)),'Invalid current observation date')
  const careers=await read(CAREERS_PAGE_URL,{kind:'html'}),corporate=readNativeDocument(careers),titles=corporate.nodes(n=>n.tag==='title'),roots=corporate.nodes(n=>n.tag==='div'&&n.attrs.id==='root')
  const scripts=corporate.nodes(n=>n.tag==='script'&&/^\/static\/js\/main\.[a-z0-9]+\.js$/.test(n.attrs.src||'')&&(!n.attrs.type||['text/javascript','application/javascript','module'].includes(n.attrs.type)))
  requireValue(titles.length===1&&/^Welcome to Raymond(?: \| Career)?$/.test(text(titles[0].raw))&&roots.length===1&&!corporate.text(roots[0])&&scripts.length===1,'Current active corporate careers shell changed')
  const bundleURL=new URL(scripts[0].attrs.src,CAREERS_PAGE_URL).href
  const bundle=await read(bundleURL,{kind:'js'});corporateDelegation(bundle);check()
  const portal=await read(JOB_LISTINGS_URL,{kind:'html',portal:true});requireValue(hasPublicPortalShell(portal),'Current public portal shell changed')
  const document=readNativeDocument(portal),mains=document.nodes(n=>n.tag==='script'&&/^main-[A-Z0-9]+\.js$/.test(n.attrs.src||''));requireValue(mains.length===1,'Active native client bundle missing')
  const mainURL=new URL(mains[0].attrs.src,ORIGIN+'/').href,main=await read(mainURL,{kind:'js'})
  requireValue(main.includes('"./'+roleName+'"')&&main.includes('"./'+coreName+'"'),'Current native role client declaration changed')
  const role=await read(ORIGIN+'/'+roleName,{kind:'js'}),core=await read(ORIGIN+'/'+coreName,{kind:'js'})
  requireValue(sha(main)===nativeProgramSHA.main&&sha(role)===nativeProgramSHA.role&&sha(core)===nativeProgramSHA.core,'Reviewed complete native client executable changed')
  requireValue(role.includes('getJobDetails(this.requisitionCode,"'+PARTS+'")')&&role.includes('getJobSecuritywithEntity(this.requisition.entityID)')
   &&core.includes('baseUrl:"/api/cp/rest/altone/cp/"')&&core.includes('"job/"+t+"/v2?part="+r+"&isReqId="+o')
   &&core.includes('getJobSecuritywithEntity(t){return this.makeSecuredGetReq("security/job/"+t)}'),'Public native detail/render contract changed')
  const account=envelope(await read(accountURL));requireValue(account.url==='raymondcareers.peoplestrong.com'&&account.realm===743&&account.obPortal===false
   &&account.menu?.some(item=>item.childMenuList?.some(child=>child.url==='/job/joblist'&&child.formName==='NEWCP_ALL_JOBS')),'Native public account changed')
  const seen=new Set();let total=null
  for(let page=0;page<maxPages;page++){
   const url=buildApiUrl({offset:page*20,limit:20}),payload=await read(url,{body:'{}'}),records=envelope(payload)
   requireValue(Array.isArray(records)&&Number.isSafeInteger(payload.totalRecords)&&payload.totalRecords>=0,'Native listing count missing')
   if(total===null)total=payload.totalRecords
   requireValue(payload.totalRecords===total&&records.length===Math.min(20,Math.max(0,total-page*20)),'Native page count mismatch')
   pages.push({url,payload});for(const row of records){
    const code=text(row.jobCode),title=text(row.jobTitle),url=row.jobDetailUrl
    requireValue(/^RAY\/[A-Z0-9-]+\/\d+$/.test(code)&&title&&url===ORIGIN+'/job/detail/'+code.replaceAll('/','_'),'Native listing identity changed')
    requireValue(!seen.has(code),'Duplicate native listing');seen.add(code)
    accounting.observe({scope:'native:raymond:realm743',id:code,url,title});rows.push(row)
   }
   if(rows.length===total){listingComplete=true;break}
  }
  requireValue(listingComplete,'Bounded native inventory remains incomplete')
  const policies=new Map()
  for(const row of rows){
   check();try{
    const location=indiaHierarchy(row.locationHierarchyComplete),url=ORIGIN+'/api/cp/rest/altone/cp/job/'+row.jobCode.replaceAll('/','_')+'/v2?part='+PARTS+'&isReqId=false'
    const native=envelope(await read(url));requireValue(native.requisitionCode===row.jobCode&&native.requisitionId===row.jobCode.split('/').at(-1)&&native.jobTitle===row.jobTitle&&native.entityID==='408','Own detail title, requisition or entity changed')
    requireValue(native.requisitionStatus==='OPEN'&&native.isCampusJob===false&&native.confidential===false,'Own role is closed, campus-only or confidential')
    indiaHierarchy(native.locationHierarchyComplete);requireValue(native.locationHierarchyComplete===row.locationHierarchyComplete&&native.organizationUnitComplete===row.organizationUnitComplete,'Own native geography or employer hierarchy changed')
    requireValue(native.joiningLocation===location.at(-1)&&row.locationHierarchy===location.at(-1),'Own native location labels conflict')
    requireValue(/^\d+$/.test(native.minimumExp)&&/^\d+$/.test(native.maximumExp)&&Number(native.minimumExp)<=Number(native.maximumExp)
     &&row.expRange===native.minimumExp+'-'+native.maximumExp+' years','Own visible experience criteria conflict')
    for(const key of ['targetNationalityID','TargetNationality','targetNationality','promoteEmirates'])requireValue(row[key]==null&&native[key]==null,'Unhandled native applicant eligibility')
    const employer=native.organizationUnitComplete.split('>')[3];requireValue(['Raymond Realty Limited','Ten X Realty West Limited'].includes(employer),'Unreviewed native legal employer hierarchy')
    const posted=day(native.CandidatePortalStartDate),closing=day(native.CandidatePortalEndDate)
    requireValue(posted===day(row.jobPostedDate)&&closing===day(row.jobClosureDate)&&posted<=now.slice(0,10)&&closing>=now.slice(0,10)&&closing>=posted,'Native publication/closing dates conflict or expired')
    if(!policies.has(native.entityID))policies.set(native.entityID,envelope(await read(ORIGIN+'/api/cp/rest/altone/api/cp/security/job/'+native.entityID)))
    const policy=policies.get(native.entityID);visiblePolicy(policy)
    const description=extractActiveDescription(native.jobDescription);requireValue(description,'Full active native description missing')
    employerCriteriaAgree(native.jobDescription,employer)
    for(const key of ['qualifications','certifications','languages'])requireValue(Array.isArray(native[key])&&native[key].every(v=>typeof v==='string'),'Malformed native '+key)
    requireValue(Array.isArray(native.skills)&&native.skills.every(v=>typeof v.text==='string'&&typeof v.mandatory==='boolean'),'Malformed native skills')
    const mapped=extractSearchResults({response:[row]})[0],qualifications=native.qualifications.map(text).filter(Boolean),languages=native.languages.map(text).filter(Boolean),skills=native.skills.filter(s=>s.mandatory).map(s=>text(s.text)).filter(Boolean)
    const criteria=[description,...qualifications.length?['Highest Education: '+qualifications.join('; ')]:[],...languages.length?['Working Language: '+languages.join('; ')]:[],...skills.length?['Must Have Skills: '+skills.join('; ')]:[]].join('\n\n')
    parsed.push({...mapped,source:'raymond',country:'India',location:[...new Set(location.slice(1).reverse()),'India'].join(', '),city:location.at(-1),link:row.jobDetailUrl,
     jobDescription:criteria,sourceDescription:criteria,sourceNativeDescription:native.jobDescription,nativeSourceRecord:native,sourceNativeRenderPolicy:policy,
     sourceNativeLegalEmployer:employer,sourceNativeOrganizationHierarchy:native.organizationUnitComplete,sourceNativeAccount:{realm:account.realm,url:account.url,entityID:native.entityID},
     minimumQualification:qualifications.join('; ')||null,requiredSkills:skills,workingLanguages:languages,
     postingDate:posted,closingDate:closing,sourceDetailComplete:true,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,scrapedAt:now})
   }catch(error){check();failures.push({stage:'native-detail',id:row.jobCode,url:row.jobDetailUrl,reason:error.message,failureKind:error.failureKind||'native-detail-failed'})}
  }
  for(const page of pages)requireValue(JSON.stringify(await read(page.url,{body:'{}'}))===JSON.stringify(page.payload),'Opening/closing native inventory changed')
  closingMatches=true;check()
  const evidence=collection()
  if(rows.length&&!parsed.length)throw Object.assign(Error('[raymond] All native candidate details failed qualification'),{failureKind:'coverage_gap',softFailure:true,abortRetries:true,nativeCollectionEvidence:evidence,nativeEvidence:evidence,recruitmentObservations:{nativeRecords:rows.length,records:rows,failures}})
  for(const job of parsed)job.nativeCollectionEvidence=evidence
  check();return accounting.attach(attachInventoryEvidence(parsed,{status:'coverage-gap',surface:JOB_LISTINGS_URL,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,reportedTotal:null,indiaFacetCount:null,pagesFetched:pages.length,reason:'Current corporate-bound public account inventory; group-wide company scope remains unqualified',verifiedAt:new Date().toISOString()}))
 }catch(error){
  if(rows.length&&!signal.aborted&&!error.nativeCollectionEvidence){const evidence=collection();Object.assign(error,{nativeCollectionEvidence:evidence,nativeEvidence:evidence,recruitmentObservations:{nativeRecords:rows.length,records:rows,failures}})}
  throw error
 }finally{clearTimeout(timer);controller.abort()}
}
