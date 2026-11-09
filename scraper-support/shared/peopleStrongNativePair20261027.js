import {createHash} from 'node:crypto'
import {document} from './rmkNativePairHtml.js'
import {nativeCountryName} from './nativeJobPosting.js'
import {attachInventoryEvidence} from '../utils/inventoryEvidence.js'
import {analyzePublishableJobs} from '../utils/publishableJobMetrics.js'

const SPECS={
 amararajaenergymobility:{company:'Amara Raja Energy & Mobility Ltd',employers:['Amara Raja Energy & Mobility Limited'],origin:'https://amararajacareers.peoplestrong.com',shell:'/home',careers:'https://amararaja.com/careers/',group:'Amara Raja Group'},
 anthem:{company:'Anthem',employers:['Anthem Biosciences'],origin:'https://anthemhrcp.peoplestrong.com',shell:'/',careers:'https://anthembio.com/careers/'},
}
export const PEOPLESTRONG_NATIVE_PARTS='basic,organisational,descriprion,workflow,skill,qualification,certification,language,applied'
const proof=(v,message)=>{if(!v)throw Object.assign(Error('PeopleStrong native pair: '+message),{code:'PEOPLESTRONG_NATIVE_UNVERIFIED'})}
const norm=v=>v==null?null:String(v).replace(/\s+/g,' ').trim()||null
const key=v=>norm(v)?.toLowerCase()
const sha=v=>createHash('sha256').update(v).digest('hex')
const spec=source=>{proof(Object.hasOwn(SPECS,source),'Unknown source');return SPECS[source]}
const json=body=>{try{return JSON.parse(body)}catch{proof(false,'Invalid public JSON')}}
const response=body=>{const p=json(body);proof(p.messageCode?.code===200&&p.response!=null,'Unsuccessful native response');return p.response}
const decode=value=>String(value).replace(/&(?:#x([\da-f]+)|#(\d+)|(amp|quot|apos|nbsp|lt|gt|ndash|mdash|hellip|bull|lsquo|rsquo|ldquo|rdquo));/gi,(whole,x,n,name)=>{if(x||n){const c=parseInt(x??n,x?16:10);return c>0&&c<=0x10ffff&&!(c>=0xd800&&c<=0xdfff)?String.fromCodePoint(c):'\ufffd'}return{amp:'&',quot:'"',apos:"'",nbsp:' ',lt:'<',gt:'>',ndash:'–',mdash:'—',hellip:'…',bull:'•',lsquo:'‘',rsquo:'’',ldquo:'“',rdquo:'”'}[name.toLowerCase()]})
const harmless=new Set('color background background-color font font-family font-size font-weight font-style font-variant line-height letter-spacing word-spacing text-align text-decoration text-transform vertical-align white-space margin margin-top margin-right margin-bottom margin-left padding padding-top padding-right padding-bottom padding-left border border-top border-right border-bottom border-left border-color border-style border-width border-collapse border-spacing border-image width min-width max-width height min-height max-height list-style list-style-type list-style-position table-layout empty-cells direction overflow-wrap mso-bidi-font-weight mso-pagination mso-list'.split(' '))
function colorVisibility(value){
 if(value==='transparent'||/^#[\da-f]{3}0$|^#[\da-f]{6}00$/i.test(value))return{hidden:true,complete:true}
 if(!/^(?:rgba?|hsla?)\(/.test(value)){const unsupportedFunction=/^[a-z][a-z0-9-]*\s*\(/i.test(value);return{hidden:unsupportedFunction,complete:!unsupportedFunction}}
 const number='[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:e[+-]?\\d+)?',channel=number+'%?',hue=number+'(?:deg|rad|grad|turn)?',fn=value.match(/^(rgba?|hsla?)\((.*)\)$/)
 if(!fn)return{hidden:true,complete:false}
 const channels=fn[1].startsWith('rgb')?[channel,channel,channel]:[hue,number+'%',number+'%'],legacy=fn[2].includes(','),body=channels.join(legacy?'\\s*,\\s*':'\\s+')
 const alpha=legacy?'(?:\\s*,\\s*('+channel+'))?':'(?:\\s*\\/\\s*('+channel+'))?',match=fn[2].match(new RegExp('^\\s*'+body+alpha+'\\s*$','i'))
 if(!match)return{hidden:true,complete:false}
 return{hidden:match[1]!==undefined&&Number(match[1].replace('%',''))<=0,complete:true}
}

// The public client renders jobDescription as HTML. Discard inactive content;
// unknown CSS needs a cascade and cannot be certified as a complete projection.
export function projectPeopleStrongHTML(html){
 if(html==null||html==='')return{text:'',complete:true}
 if(typeof html!=='string')return{text:'',complete:false}
 const doc=document(html);let complete=true
 const raw=new Set(['script','style','textarea','title','xmp','iframe','noembed','noframes','plaintext','noscript','template'])
 if(/<style\b/i.test(html))return{text:'',complete:false}
 // The underlying reader propagates hidden visibility as inactive. A child can
 // override inherited visibility in a browser; withhold completeness instead
 // of certifying that reader's omitted subtree as a full visible projection.
 const hasVisibilityOverride=(n,hiddenAncestor=false)=>{
  if(typeof n==='string'||raw.has(n.tag))return false
  const style=(n.attrs.style??'').replace(/\/\*[\s\S]*?\*\//g,'')
  if(hiddenAncestor&&/(?:^|;)\s*visibility\s*:\s*visible\s*(?:!important\s*)?(?:;|$)/i.test(style))return true
  const hidden=/(?:^|;)\s*visibility\s*:\s*(?:hidden|collapse)\s*(?:!important\s*)?(?:;|$)/i.test(style)
  return n.children.some(child=>hasVisibilityOverride(child,hiddenAncestor||hidden))
 }
 if(hasVisibilityOverride(doc.root))complete=false
 const render=n=>{
  if(typeof n==='string')return decode(n)
  if(n.inactive||raw.has(n.tag)||n.tag==='dialog'&&!Object.hasOwn(n.attrs,'open'))return''
  let hidden=false
  const style=(n.attrs.style??'').replace(/\/\*[\s\S]*?\*\//g,'')
  if(/[&{}\\@]|var\s*\(|expression\s*\(/i.test(style)){complete=false;return''}
  for(const part of style.split(';').filter(x=>x.trim())){
   const m=part.match(/^\s*([a-z_-][a-z0-9_-]*)\s*:\s*(.*?)\s*$/i)
   if(!m){complete=false;hidden=true;continue}
   const p=m[1].toLowerCase(),v=m[2].replace(/\s*!\s*important\s*$/i,'').trim().toLowerCase()
   if(p==='display'){if(v==='none')hidden=true;else if(!/^(block|inline|inline-block|list-item|table|table-row|table-cell|flex|grid|contents)$/.test(v)){complete=false;hidden=true}}
   else if(p==='visibility'){if(/^(hidden|collapse)$/.test(v))hidden=true;else if(v!=='visible'){complete=false;hidden=true}}
   else if(p==='opacity'){if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)%?$/.test(v)){complete=false;hidden=true}else if(Number(v.replace('%',''))<=0)hidden=true}
   else if(p==='font-size'&&/^[+-]?(?:0+(?:\.0*)?|\.0+)(?:[a-z%]+)?$/i.test(v))hidden=true
   else if(p==='color'){const color=colorVisibility(v);if(color.hidden)hidden=true;if(!color.complete)complete=false}
   else if(p==='text-indent'){if(!/^(?:0|\d+(?:\.\d+)?(?:px|pt|em|rem|%|in|cm|mm))$/.test(v)){complete=false;hidden=true}}
   else if(!harmless.has(p)){complete=false;hidden=true}
  }
  if(hidden)return''
  if(n.tag==='details'&&!Object.hasOwn(n.attrs,'open'))return n.children.filter(x=>x.tag==='summary').slice(0,1).map(render).join(' ')
  return n.children.map(render).join(' ')
 }
 return{text:render(doc.root).replace(/\s+/g,' ').trim(),complete}
}
const links=html=>document(html).nodes(n=>n.tag==='a'&&n.attrs.href).map(n=>n.attrs.href)
const typed=(rows,types,required=false)=>{const names=(rows??[]).filter(x=>types.includes(x.orgUnitType)).map(x=>norm(x.orgUnitName));proof(names.length<=1&&!names.some(x=>!x)&&(!required||names.length===1),'Missing/ambiguous typed '+types.join('/'));return names[0]??null}
function date(value,listing,label){
 if(value==null||value===''){proof(!listing,'Missing native '+label);return null}
 const m=String(value).match(/^(\d{4}-\d{2}-\d{2})(?: 00:00:00\.0)?$/)
 proof(m,'Unsupported native '+label+' precision');const d=new Date(m[1]+'T00:00:00Z');proof(Number.isFinite(+d)&&d.toISOString().startsWith(m[1]),'Impossible native '+label);proof(!listing||m[1]===listing,'Listing/detail '+label+' conflict');return m[1]
}
const code=value=>{proof(typeof value==='string'&&/^P-\d+$/.test(value),'Unreviewed public posting code');return value}
export const buildPairListUrl=(source,offset)=>{proof(Number.isSafeInteger(offset)&&offset>=0,'Invalid offset');return spec(source).origin+'/api/cp/rest/altone/cp/jobs/v1?offset='+offset+'&limit=45'}
export const buildPairDetailUrl=(source,id)=>spec(source).origin+'/api/cp/rest/altone/cp/job/'+code(id)+'/v2?part='+PEOPLESTRONG_NATIVE_PARTS+'&isReqId=false'
export const buildPairOrganizationUrl=(source,id)=>spec(source).origin+'/api/cp/rest/altone/cp/job/organizationDetails?jobCode='+code(id)

export function mapPeopleStrongPairRole(source,listing,detail,organization,{organizationRequestJobCode=listing.jobCode,now=new Date().toISOString()}={}){
 const s=spec(source),id=code(listing.jobCode),url=s.origin+'/job/detail/'+id
 proof(detail.requisitionCode===id&&organizationRequestJobCode===id&&norm(detail.jobTitle)===norm(listing.jobTitle),'Native detail/request identity conflict')
 proof(listing.jobDetailUrl===url&&/^\d+$/.test(String(detail.requisitionId??'')),'Native application/formal requisition identity missing')
 for(const k of ['entityID','hrOrgUnitID','worksiteID']){proof(/^\d+$/.test(String(detail[k]??'')),'Missing native '+k);if(listing[k]!=null)proof(String(listing[k])===String(detail[k]),'Native '+k+' conflict')}
 if(listing.requisitionId!=null)proof(String(listing.requisitionId)===String(detail.requisitionId),'Formal requisition identity conflict')
 const company=typed(organization.orgUnitHierarchy,['Company Name'],true),group=typed(organization.orgUnitHierarchy,['Group'])
 if(s.group)proof(group===s.group,'Group identity conflict')
 proof(norm(listing.organizationUnit)===company,'Listing/typed company conflict')
 for(const hierarchy of [listing.organizationUnitComplete,detail.organizationUnitComplete]){proof(typeof hierarchy==='string','Missing role company ancestry');const nodes=hierarchy.split('>').map(norm);proof(nodes[s.group?1:0]===company,'Role/typed company ancestry conflict')}
 const locationCompany=typed(organization.workSiteHierarchy,['Company']);proof(!locationCompany||locationCompany===company,'Worksite company conflict')
 const countryRows=(organization.workSiteHierarchy??[]).filter(x=>x.orgUnitType==='Country'),nativeCountry=countryRows.length===1?nativeCountryName(countryRows[0].orgUnitName):null
 const explicit=[listing,detail].flatMap(row=>Object.entries(row).filter(([name])=>/^(?:country|countryname|countrycode)$/i.test(name)).map(([,value])=>value)).filter(v=>v!=null&&v!=='').map(nativeCountryName)
 const country=nativeCountry&&explicit.every(c=>c===nativeCountry)?nativeCountry:null
 const worksite=typed(organization.workSiteHierarchy,['Working location','Work Location']),city=typed(organization.workSiteHierarchy,['Town','City']),state=typed(organization.workSiteHierarchy,['State'])
 const countryEvidence=country?{method:'native-role-requested-typed-country',inference:false,country,worksiteID:String(detail.worksiteID),requisitionCode:id,organizationRequestJobCode,nativeCountry:countryRows[0].orgUnitName}:null
 const projected=projectPeopleStrongHTML(detail.jobDescription)
 const strings=k=>{proof(Array.isArray(detail[k]??[]),'Invalid structured '+k);return(detail[k]??[]).map(v=>{proof(typeof v==='string','Invalid structured '+k);return norm(v)}).filter(Boolean)}
 const qualifications=strings('qualifications'),certifications=strings('certifications'),languages=strings('languages');proof(Array.isArray(detail.skills??[]),'Invalid structured skills')
 const skills=(detail.skills??[]).map(x=>{proof(x&&typeof x.text==='string'&&(typeof x.mandatory==='boolean'||x.mandatory==null),'Invalid native skill');return norm(x.text)}).filter(Boolean)
 const posted=date(detail.CandidatePortalStartDate,listing.jobPostedDate,'publication'),closing=date(detail.CandidatePortalEndDate,listing.jobClosureDate,'expiry');proof(!posted||!closing||closing>=posted,'Expiry precedes publication')
 const minimum=norm(detail.minimumExp),maximum=norm(detail.maximumExp),experience=minimum&&maximum?(minimum===maximum?minimum:minimum+' - '+maximum)+' years':null
 const content=[projected.text,qualifications.length?'Qualifications: '+qualifications.join('; '):null,skills.length?'Skills: '+skills.join('; '):null,certifications.length?'Certifications: '+certifications.join('; '):null,languages.length?'Languages: '+languages.join('; '):null].filter(Boolean).join('\n\n')
 const additional={};for(const k of ['employmentTenureType','roleType','roleContributionType','programType','employmentType','requisitionType','EducationSepecializationID','educationSepecialization','functionalDesignationID','jobRoleID','JobFamilyCode','shiftFrom','shiftTo','RoleName','Onsite','payGroup','functionalArea','industryName'])if(detail[k]!=null)additional[k]=detail[k]
 for(const k of ['industry','functionalArea','role','departmentHierarchy','buHierarchy','divisionHierarchy'])if(organization[k]!=null)additional[k]=organization[k]
 const nativePublicFields={jobDescription:detail.jobDescription,qualifications:detail.qualifications??[],skills:detail.skills??[],certifications:detail.certifications??[],languages:detail.languages??[],minimumExp:detail.minimumExp??null,maximumExp:detail.maximumExp??null,CandidatePortalStartDate:detail.CandidatePortalStartDate??null,CandidatePortalEndDate:detail.CandidatePortalEndDate??null}
 const complete=Boolean(projected.text)&&projected.complete&&Boolean(posted)
 return{source,company:s.company,nativeRoleCompany:company,brand:s.employers.some(x=>key(x)===key(company))?s.employers[0]:company,legalEmployer:null,targetEmployer:s.employers.some(x=>key(x)===key(company)),title:norm(detail.jobTitle),department:typed(organization.orgUnitHierarchy,['Department']),jobId:id,postingId:id,requisitionId:String(detail.requisitionId),sourceRequisitionID:String(detail.requisitionId),requisitionCode:id,sourceUrl:url,applyUrl:url,link:url,applicationIdentity:{publicPostingCode:id,formalRequisitionId:String(detail.requisitionId),entityID:String(detail.entityID),hrOrgUnitID:String(detail.hrOrgUnitID),worksiteID:String(detail.worksiteID)},country,city,location:[worksite,city,state,country].filter(Boolean).join(', '),sourceCountryEvidence:countryEvidence,sourceCountryUnknownReason:country?null:'missing-ambiguous-or-conflicting-native-role-country',employmentType:norm(detail.employmentType),workMode:null,workplaceType:null,experienceRequired:experience,minimumQualification:qualifications.join('; ')||null,preferredQualification:null,requiredSkills:skills,nativeSkills:detail.skills??[],qualifications,certifications,languages,sourceAdditionalCriteria:additional,postingDate:posted,postedAt:posted,closingDate:closing,nativePublicationPrecision:posted?'day':null,nativeExpiryPrecision:closing?'day':null,sourceClosingDateIsExact:false,firstEverPublication:null,sourceDescription:content,jobDescription:content,nativePublicFields,nativeOrganizationHierarchy:organization.orgUnitHierarchy,nativeWorksiteHierarchy:organization.workSiteHierarchy,nativeRequisitionStatus:norm(detail.requisitionStatus),sourceDetailComplete:complete,sourceDetailStatus:complete?'complete':'partial',sourceListingComplete:false,sourceScopeComplete:false,sourceLocationCorroborationComplete:Boolean(country),lifecycleCleanupAllowed:false,scrapedAt:new Date(now).toISOString()}
}

function reader(source,options){
 const s=spec(source)
 return async(url,request={})=>{
  const method=request.method??'GET';proof(method==='GET'||method==='POST'&&url.startsWith(s.origin+'/api/cp/rest/altone/cp/jobs/v1?')&&/^offset=\d+&limit=45$/.test(url.split('?')[1])&&request.body==='{}','Unreviewed public request')
  options.signal?.throwIfAborted();const controller=new AbortController(),abort=()=>controller.abort(options.signal.reason);options.signal?.addEventListener('abort',abort,{once:true});let timer
  const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Object.assign(Error('PeopleStrong native timeout'),{code:'ETIMEDOUT'}))},options.timeoutMs??30000)})
  const cancelled=new Promise((_,reject)=>controller.signal.addEventListener('abort',()=>reject(controller.signal.reason??Error('Aborted public read')),{once:true}))
  try{
   const init={method,credentials:'omit',redirect:'manual',signal:controller.signal,headers:{Accept:'text/html,application/json',...(method==='POST'?{'Content-Type':'application/json'}:{})},...(method==='POST'?{body:request.body}:{})}
   const result=await Promise.race([(async()=>{if(options.fetchPage)return options.fetchPage(url,init);const r=await fetch(url,init);return{status:r.status,url:r.url,body:await r.text()}})(),deadline,cancelled]);options.signal?.throwIfAborted()
   proof(result?.status===200||result?.status===404&&source==='amararajaenergymobility'&&url===s.origin+s.shell,'HTTP '+result?.status+' at public careers stage')
   proof(new URL(result.url??url).href===new URL(url).href,'Unexpected public redirect');const raw=result.body??result.html;proof(typeof raw==='string'||Buffer.isBuffer(raw),'Missing public response');proof(Buffer.byteLength(raw)<=16*1024*1024,'Oversize public response');const body=String(raw)
   proof(!/<title[^>]*>\s*(?:just a moment|access denied|attention required)|<(?:h1|p)\b[^>]*>\s*(?:captcha challenge|verify you are human)/i.test(body),'Explicit public access gate');return body
  }finally{clearTimeout(timer);options.signal?.removeEventListener('abort',abort)}
 }
}
async function corporate(source,read){
 const s=spec(source)
 if(source==='anthem'){
  const body=await read(s.careers),doc=document(body),text=doc.text(doc.root)
  proof(/<title[^>]*>\s*Careers - Anthem\s*<\/title>/i.test(body)&&/Anthem Biosciences/i.test(body),'Current corporate brand missing');proof(links(body).includes(s.origin+'/'),'Current official native delegation missing')
  const count=text.match(/Open Positions\s*\(\s*(\d+)\s*\)/i)?.[1]
  return{exactEmployerDelegation:true,advertisedCount:count===undefined?null:Number(count),careers:s.careers,portal:s.origin+'/'}
 }
 const companyPage=await read('https://amararaja.com/amara-raja-energy-and-mobility-ltd/');proof(/Amara Raja Energy\s*&\s*Mobility/i.test(decode(companyPage.match(/<title[^>]*>([^<]*)/i)?.[1]??'')),'Current corporate company identity missing')
 proof(links(companyPage).includes('//www.amararajaeandm.com'),'Exact corporate homepage delegation missing')
 const homepage=await read('https://www.amararajaeandm.com');proof(/Amara Raja Energy\s*&\s*Mobility Limited/i.test(decode(homepage.match(/<title[^>]*>([^<]*)/i)?.[1]??'')),'Exact employer homepage identity missing')
 const careers=await read(s.careers);proof(/Amara Raja Group/i.test(decode(careers.match(/<title[^>]*>([^<]*)/i)?.[1]??''))&&links(careers).includes(s.origin+s.shell),'Current group native delegation missing')
 const exactEmployerDelegation=links(homepage).some(h=>h===s.origin+s.shell||h===s.careers)
 return{exactEmployerDelegation,advertisedCount:null,careers:s.careers,portal:s.origin+s.shell,scopeLimitation:exactEmployerDelegation?null:'exact-employer-homepage-only-exposes-obsolete-careers-handoff'}
}
async function client(source,read){
 const s=spec(source),shell=await read(s.origin+s.shell);proof(/<app-root\b/i.test(shell),'Native app shell missing');const main=shell.match(/<script\b[^>]*\bsrc=["'](main-[A-Z0-9]+\.js)["']/)?.[1];proof(main,'Current native main missing')
 const js=await read(s.origin+'/'+main),module=js.match(/path:"job",loadChildren:\(\)=>import\("(\.\/chunk-[A-Z0-9]+\.js)"\)/)?.[1];proof(module,'Current job module missing')
 const job=await read(new URL(module,s.origin+'/'+main).href);proof(job.includes(PEOPLESTRONG_NATIVE_PARTS)&&job.includes('getJobDetails(')&&job.includes('jobDescription'),'Current full public detail protocol missing')
 const imports=[...new Set([...job.matchAll(/from\s*["'](\.\/chunk-[A-Z0-9]+\.js)["']/g)].map(x=>x[1]))];proof(imports.length>0&&imports.length<=32,'Unbounded or missing current service imports');let found=false,emptyInitialFilter=false
 const filterVar=job.match(/this\.filterTO=new ([\w$]+)/)?.[1],filterImport=[...job.matchAll(/import\{([^}]+)\}from"(\.\/chunk-[A-Z0-9]+\.js)"/g)].find(x=>x[1].split(',').some(n=>n.trim().endsWith(' as '+filterVar)))?.[2]
 // The current declared deployment adds three optional filters and factors
 // the unchanged page size into a constant. A fresh empty filter class still
 // serializes every field away, yielding the same anonymous {} request.
 // Accept only the captured reviewed job/service programs for this form;
 // unrelated executable changes must continue to fail closed.
 // These are the only two configured tenants, both declaring this reviewed
 // whole program. Historical unretained programs have no approved profile;
 // recognizing fragments cannot prove their default filters or later writes.
 proof(filterVar&&filterImport&&sha(job)==='2c8731b9c4836c4f0569c71fcb54b26ecad9e43db290d9e039a9b482e7b43e1c','Unverified initial native filter/search body')
 for(const file of imports){
  const body=await read(new URL(file,s.origin+'/'+main).href)
  if(file===filterImport)emptyInitialFilter=sha(body)==='314164747e257b4d01aa85fc5bbdf18d018cefb95b7ba738b99059e723c4e1ff'&&/^var \w+=class\{isFiltered\(\)\{return [^{}]+\}\};export\{\w+ as a\};?$/.test(body.trim())
  const pageSize=sha(body)==='aab6fd14131be8bbc94491b71fdad60b0dd2f9be97580566fed90d0f76d65b2c'&&body.includes(',ay=45,')&&body.includes('var Xx=class{constructor(){this.offset=0,this.limit=ay,this.totalRecords=-1}}')
  if(body.includes('getjoblist(')&&['/api/cp/rest/altone/cp/','this.makePostReq("jobs/v1?offset=','getJobDetails(','/v2?part=','&isReqId=','job/organizationDetails?jobCode='].every(x=>body.includes(x))&&pageSize)found=true
  if(found&&emptyInitialFilter)break
 }
 proof(emptyInitialFilter,'Unverified initial native filter shape')
 proof(found,'Current anonymous readonly native protocol changed')
 const info=response(await read(s.origin+'/api/cp/rest/altone/cp/urlinfo'));proof(info.url===new URL(s.origin).hostname,'Native tenant identity mismatch');proof(Array.isArray(response(await read(s.origin+'/api/cp/rest/altone/cp/layout?isPreview=false'))),'Current public layout missing')
 return{main,jobModule:module,initialSearchBody:'{}',emptyInitialFilterVerified:true}
}
export const createPeopleStrongPairScraper=(source,defaults={})=>({async run(runOptions={}){
 const options={...defaults,...runOptions},s=spec(source);proof(!options.fetchJson||options.fetchPage,'Listing-only injection requires current fetchPage transport');proof(!options.fetchText||options.fetchPage,'Legacy transport requires current fetchPage transport')
 const read=reader(source,options),now=new Date(typeof options.now==='function'?options.now():options.now??Date.now()).toISOString(),delegation=await corporate(source,read),protocol=await client(source,read)
 const traverse=async()=>{
  const rows=[],pages=[];let total=null
  for(let offset=0;offset<=100035;offset+=45){const p=json(await read(buildPairListUrl(source,offset),{method:'POST',body:'{}'}));proof(p.messageCode?.code===200&&Number.isSafeInteger(p.totalRecords)&&p.totalRecords>=0&&p.totalRecords<=100000,'Missing native search total');proof(Array.isArray(p.response)||p.response===null,'Missing native response');const a=p.response??[];proof(a.length<=45,'Native page overflow');if(total===null)total=p.totalRecords;proof(total===p.totalRecords,'Native total changed');pages.push({offset,rows:a.length});rows.push(...a);if(offset>=total){proof(a.length===0,'Native terminal page not empty');return{rows,pages,total}}}
  proof(false,'Native pagination did not terminate')
 }
 const initial=await traverse(),roles=[],failures=[],seen=new Set()
 for(const row of initial.rows){const id=code(row?.jobCode);if(seen.has(id)){failures.push({postingId:id,reason:'duplicate-native-posting'});continue}seen.add(id);const d=response(await read(buildPairDetailUrl(source,id))),org=response(await read(buildPairOrganizationUrl(source,id)));try{roles.push(mapPeopleStrongPairRole(source,row,d,org,{now,organizationRequestJobCode:id}))}catch(e){failures.push({postingId:id,reason:e.message})}}
 const closing=await traverse(),closingDelegation=await corporate(source,read),closingMatches=sha(JSON.stringify(initial.rows))===sha(JSON.stringify(closing.rows))&&initial.total===closing.total,delegationMatches=JSON.stringify(delegation)===JSON.stringify(closingDelegation),nativeInventoryComplete=closingMatches&&seen.size===initial.total&&initial.rows.length===seen.size&&roles.length===seen.size&&!failures.length
 const excluded=roles.filter(j=>!j.targetEmployer),unknown=roles.filter(j=>j.targetEmployer&&!j.country),partial=roles.filter(j=>!j.sourceDetailComplete),closed=roles.filter(j=>j.nativeRequisitionStatus!=='OPEN'),all=roles.filter(j=>j.targetEmployer&&j.country==='India'&&j.sourceDetailComplete&&j.nativeRequisitionStatus==='OPEN')
 const advertisedCountMismatch=delegation.advertisedCount!==null&&delegation.advertisedCount!==initial.total,scopeComplete=nativeInventoryComplete&&delegationMatches&&delegation.exactEmployerDelegation&&!advertisedCountMismatch&&!unknown.length&&!partial.length&&!closed.length
 const derivedTargetRawJobs=scopeComplete?roles.filter(j=>j.targetEmployer).length:null,nativeGroupReportedTotal=s.group?initial.total:null
 const cap=Number.isSafeInteger(options.maxJobs)&&options.maxJobs>=0?options.maxJobs:null,jobs=cap===null?all:all.slice(0,cap),limited=jobs.length!==all.length,eligibility=analyzePublishableJobs(all,{now:new Date(now)})
 const verifiedZeroInventory=scopeComplete&&!limited&&derivedTargetRawJobs===0
 const report={source,status:scopeComplete&&!limited?'complete':'partial',surface:s.careers,protocol,delegation,delegationMatches,reportedNativeTotal:initial.total,nativeGroupReportedTotal,derivedTargetRawJobs,observedNativeRecords:seen.size,pages:initial.pages,closingPages:closing.pages,closingMatches,nativeInventoryComplete,fullNativeDetails:roles.length,renderedFullDetails:roles.filter(j=>j.sourceDetailComplete).length,targetEmployerCount:roles.filter(j=>j.targetEmployer).length,excludedEmployerCount:excluded.length,excludedEmployers:excluded.map(j=>({postingId:j.jobId,nativeRoleCompany:j.nativeRoleCompany})),unknownCountryCount:unknown.length,unknownCountryIds:unknown.map(j=>j.jobId),partialDetailIds:partial.map(j=>j.jobId),closedIds:closed.map(j=>j.jobId),advertisedCountMismatch,failures,observedIndiaJobs:all.length,observedEligibleJobs:eligibility.eligibleJobs.length,eligibilityFilterCounts:eligibility.filterCounts,rawJobs:derivedTargetRawJobs,indiaJobs:scopeComplete?all.length:null,eligibleJobs:scopeComplete?eligibility.eligibleJobs.length:null,sourceScopeComplete:scopeComplete,sourceListingComplete:scopeComplete&&!limited,cleanupAllowed:false,verifiedZeroInventory,limited,checkedAt:now,roles}
 for(const j of jobs){j.sourceScopeComplete=scopeComplete;j.sourceListingComplete=scopeComplete&&!limited}
 if(typeof options.onReport==='function')await options.onReport(report)
 return attachInventoryEvidence(jobs,{status:scopeComplete&&!limited?(verifiedZeroInventory?'verified-empty':'complete-inventory'):'discovery-only',surface:s.careers,firstParty:true,listingComplete:scopeComplete&&!limited,pagesFetched:initial.pages.length+closing.pages.length,reportedTotal:derivedTargetRawJobs,indiaFacetCount:scopeComplete?all.length:null,verifiedAt:now,reason:scopeComplete?'native-inventory-and-full-details':'native-scope-or-corporate-count-incomplete'})
}})
