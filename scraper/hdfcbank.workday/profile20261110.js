import {createHash} from 'node:crypto'
import {parse} from 'acorn'
import {readNativeDocument,decodeNativeEntities,extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {nativeCountryName,nativeLocationCountryName,nativeDate} from '../../scraper-support/shared/nativeJobPosting.js'

export const PROFILE=Object.freeze({source:'hdfcbank',company:'HDFC Bank',companyId:'463',companyCode:'HDFCBK',parentId:'206',
 corporate:'https://www.hdfc.bank.in/careers',entry:'https://hdfcbank.ripplehire.com/candidate/careers',origin:'https://hdfcbank.ripplehire.com'})
export const sha=value=>createHash('sha256').update(value).digest('hex')
export const need=(ok,message)=>{if(!ok)throw Object.assign(Error('HDFC native proof: '+message),{code:'HDFC_NATIVE_PROOF',softFailure:true,abortRetries:true,failureKind:'coverage_gap'})}
export const PROGRAMS=Object.freeze([
 ['main','ba1d32159d575134218489c245a33b98eb763f6f1526505f41dc5ec4201c19de'],
 ['app','68870df022f03dc6f8557f508ac4a8998a05a4310ef3904b55f3c206f04b70a2'],
 ['candidates_app','173442d9133e64484d53504fc042a8df40fed958a71b7bb401019fecebdcad9d'],
 ['apps/candidates/controller/candidatejoblist_controller','307a0f84a500c0e927e6c0b53d86f719ee9f3179fd0ee6b25c6bc52321481ac3'],
 ['apps/candidates/controller/candidatejobdesc_controller','b4afc044cb10d2319b2658611c9eda6c7e97bd4eb844e489f8208fbd426dbad5'],
 ['entities/job','b114819b9e5bef2049c89181102cd36497d8f73e298b16f81cecfa3afbd22789'],
 ['entities/company','ae85c98b0add0573b8f4383c92412d5c3d17ebc57cb5077883551823840cab5e'],
])
const key=value=>String(value||'').normalize('NFKC').replace(/[^\p{L}\p{N}]/gu,'').toLowerCase()
const blocked=new Set(['template','blockquote','q','pre','code','aside','script','style','object','iframe','noscript'])
const blocksFor=html=>{
 const doc=readNativeDocument(html||''),blocks=[]
 const text=node=>typeof node==='string'?decodeNativeEntities(node):node.inert||blocked.has(node.tag)?'':node.children.map(text).join(' ')
 const visit=node=>{
  if(node.inert||blocked.has(node.tag))return
  if(['p','li','td','div'].includes(node.tag)&&!node.children.some(child=>typeof child!=='string'&&['p','div','ul','ol','li','table','tr','td'].includes(child.tag))){
   const value=text(node).replace(/\s+/g,' ').trim();if(value)blocks.push(value);return
  }
  for(const child of node.children)if(typeof child!=='string')visit(child)
 }
 visit(doc.nodes(n=>n.tag==='root')[0]);return blocks
}
const activeNodes=(html,{scripts=false}={})=>{
 const doc=readNativeDocument(html),nodes=[]
 const visit=node=>{if(node.inert||blocked.has(node.tag)&&!(scripts&&node.tag==='script'))return;nodes.push(node);for(const child of node.children)if(typeof child!=='string')visit(child)}
 visit(doc.nodes(n=>n.tag==='root')[0]);return nodes
}
export function corporateDeclaration(packet){
 need(packet.finalURL===PROFILE.corporate,'corporate final URL changed')
 const nodes=activeNodes(packet.body)
 need(!nodes.some(n=>n.tag==='base'),'corporate base changed')
 const titles=nodes.filter(n=>n.tag==='title').map(n=>decodeNativeEntities(n.raw||''))
 need(titles.length===1&&/\bHDFC Bank\b/.test(titles[0])&&/\bCareers\b/.test(titles[0]),'corporate publisher changed')
 need(nodes.some(n=>n.tag==='a'&&n.attrs.href&&new URL(n.attrs.href,PROFILE.corporate).href===PROFILE.entry),'active corporate careers link missing')
 return{corporateURL:packet.finalURL,bodySHA256:packet.bodySHA256,matchedLink:PROFILE.entry}
}
export function publicRedirect(packet){
 need(packet.status===302&&packet.finalURL===PROFILE.entry&&typeof packet.headers.location==='string','public board redirect changed')
 const declared=new URL(packet.headers.location,PROFILE.entry)
 need(declared.origin===PROFILE.origin&&declared.pathname==='/candidate/'&&!declared.username&&!declared.password&&!declared.port
  &&declared.hash==='#list'&&declared.searchParams.get('source')==='CAREERSITE'
  &&[...declared.searchParams.keys()].sort().join(',')==='source,token'
  &&/^[a-zA-Z0-9]{16,64}$/.test(declared.searchParams.get('token')||''),'unreviewed public candidate route')
 const requested=new URL(declared);requested.hash=''
 return{declaredURL:declared.href,boardURL:requested.href,token:declared.searchParams.get('token'),source:'CAREERSITE'}
}
export function boardDeclaration(packet,binding){
 need(packet.finalURL===binding.boardURL,'public board response identity changed')
 const doc=readNativeDocument(packet.body),nodes=activeNodes(packet.body)
 need(!nodes.some(n=>n.tag==='base'),'public board base changed')
 const titles=nodes.filter(n=>n.tag==='title').map(n=>decodeNativeEntities(n.raw||''))
 need(titles.length===1&&titles[0]==='HDFC Bank Careers | Latest jobs at HDFC Bank - Ripplehire.com','exact native publisher changed')
 // A hidden script still executes. Inspect the complete current shell's
 // executable context, ignoring only template contents and parsed comments.
 const executable=[]
 const inspect=node=>{
  if(typeof node==='string'||node.tag==='template')return
  if(node.tag==='script')executable.push({attrs:node.attrs,raw:node.raw})
  need(!['iframe','object','embed','base'].includes(node.tag)
   &&!(node.tag==='meta'&&/^refresh$/i.test(node.attrs['http-equiv']||''))
   &&!Object.keys(node.attrs).some(name=>/^on/i.test(name)||name==='srcdoc')
   &&!Object.values(node.attrs).some(value=>/^\s*(?:javascript|data|vbscript):/i.test(value)),'unreviewed executable native shell context')
  for(const child of node.children)inspect(child)
 }
 inspect(doc.nodes(n=>n.tag==='root')[0])
 need(executable.length===13&&sha(JSON.stringify(executable))==='3961f0367c9b8e4930f67077da0358d44478d77aacb1622f9d93a4b2a0bdb8b8',
  'reviewed complete native shell program set changed')
 for(const[name,value]of [['token',binding.token],['source','CAREERSITE']]){
  // These hidden values are only native routing data used by the active AMD
  // program; they never establish employer, legal entity or country facts.
  const inputs=doc.nodes(n=>n.tag==='root')[0].children
  const found=[];const visit=n=>{if(n.tag==='template')return;if(n.tag==='input'&&n.attrs.id===name)found.push(n.attrs.value);for(const c of n.children)if(typeof c!=='string')visit(c)}
  for(const n of inputs)if(typeof n!=='string')visit(n)
  need(found.length===1&&found[0]===value,'native route input changed')
 }
 const scripts=activeNodes(packet.body,{scripts:true}).filter(n=>n.tag==='script'&&n.attrs['data-main'])
 need(scripts.length===1&&!Object.hasOwn(scripts[0].attrs,'nomodule')&&!scripts[0].attrs.type
  &&scripts[0].attrs['data-main']==='./candresource/candidate/require_main.js'
  &&scripts[0].attrs.src==='./candresource/candidate/vendor/require.js','active native bootstrap changed')
 return new URL(scripts[0].attrs['data-main'],packet.finalURL).href
}
const walk=(node,visit)=>{if(!node||typeof node!=='object')return;visit(node);for(const value of Object.values(node))if(Array.isArray(value))for(const child of value)walk(child,visit);else if(value&&typeof value==='object')walk(value,visit)}
export function program(body,name){
 need(sha(body)===PROGRAMS.find(p=>p[0]===name)?.[1],'reviewed active program changed: '+name)
 return parse(body,{ecmaVersion:'latest',sourceType:'script'})
}
export function requireConfiguration(body){
 const ast=program(body,'main'),configs=ast.body.filter(n=>n.type==='ExpressionStatement'&&n.expression.type==='CallExpression'
  &&n.expression.callee.type==='MemberExpression'&&!n.expression.callee.computed&&n.expression.callee.object.name==='requirejs'&&n.expression.callee.property.name==='config')
 need(configs.length===1&&configs[0].expression.arguments.length===1,'active RequireJS configuration changed')
 const object=configs[0].expression.arguments[0];need(object.type==='ObjectExpression','literal AMD configuration missing')
 const literal=name=>{const fields=object.properties.filter(n=>n.type==='Property'&&!n.computed&&n.key.name===name);need(fields.length===1&&fields[0].value.type==='Literal','literal AMD '+name+' missing');return fields[0].value.value}
 const baseUrl=literal('baseUrl'),urlArgs=literal('urlArgs')
 need(baseUrl==='candresource/candidate'&&urlArgs==='v=v738','unreviewed native program version')
 return{baseUrl,urlArgs}
}
export function requireDependency(body,name,dependency){
 const ast=program(body,name),found=[]
 walk(ast,node=>{if(node.type==='CallExpression'&&['require','define'].includes(node.callee?.name)&&node.arguments[0]?.type==='ArrayExpression')
  for(const arg of node.arguments[0].elements)if(arg?.type==='Literal'&&arg.value===dependency)found.push(arg.value)})
 need(found.length>0,'active AMD dependency missing: '+dependency)
}
export function nativeEndpoints(jobBody,companyBody){
 const modelURL=(body,module,model)=>{
  const ast=program(body,module),values=[]
  walk(ast,node=>{
   if(node.type!=='AssignmentExpression'||node.left.type!=='MemberExpression'||node.left.object.name!=='Entities'||node.left.property.name!==model)return
   const object=node.right.type==='CallExpression'&&node.right.arguments[0]
   if(object?.type==='ObjectExpression')for(const field of object.properties)if(field.key?.name==='url'&&field.value.type==='Literal')values.push(field.value.value)
  })
  need(values.length===1,'native public model URL missing: '+model);return values[0]
 }
 const endpoints={detail:modelURL(jobBody,'entities/job','Job'),listing:modelURL(jobBody,'entities/job','JobSearchResult'),company:modelURL(companyBody,'entities/company','Company')}
 need(endpoints.detail==='candidatejobdetail'&&endpoints.listing==='candidatejobsearch'&&endpoints.company==='companyinfo','unreviewed public native endpoints')
 return endpoints
}
export function companyIdentity(company){
 need(company&&company.companyMstrSeq===PROFILE.companyId&&company.companyName===PROFILE.company
  &&company.companyCd===PROFILE.companyCode&&company.domainName==='hdfcbank.ripplehire.com','native company identity changed')
 return{companyId:company.companyMstrSeq,companyName:company.companyName,companyCode:company.companyCd,domainName:company.domainName}
}
export function listingPage(value,page,total){
 need(value&&value.errorStatus==='success'&&value.startJobIndex===page*10&&value.maxJobSize===10
  &&Number.isSafeInteger(value.totalJobCount)&&value.totalJobCount>=0&&Array.isArray(value.jobVoList)
  &&value.jobVoList.length===Math.min(10,Math.max(0,value.totalJobCount-page*10)),'invalid native selected listing envelope')
 need(total==null||value.totalJobCount===total,'native reported query total changed')
 for(const row of value.jobVoList)need(/^\d{1,24}$/.test(row.jobSeq||'')&&row.jobId===row.jobSeq&&typeof row.jobTitle==='string'&&row.jobTitle.trim(),'invalid native listing identity')
 return value
}
const negativeBlocks=value=>{
 const doc=readNativeDocument(value||''),exclude=new Set([...blocked].filter(t=>t!=='aside'))
 const boundaries=new Set(['address','article','aside','body','br','caption','dd','details','div','dl','dt','fieldset','figcaption','figure','footer','form','h1','h2','h3','h4','h5','h6','header','hr','li','main','nav','ol','p','section','summary','table','tbody','td','th','thead','tr','ul'])
 const visit=node=>{if(typeof node==='string')return node;if(node.inert||exclude.has(node.tag))return '';const value=node.children.map(visit).join(' ');return boundaries.has(node.tag)?'\n'+value+'\n':value}
 return visit(doc.nodes(n=>n.tag==='root')[0]).split(/\r?\n/).map(v=>decodeNativeEntities(v).replace(/\s+/g,' ').trim()).filter(Boolean)
}
const explicitWorkplaceCountry=value=>{
 if(typeof value!=='string')return null
 const cleaned=value.trim().replace(/[.;]\s*$/,'')
 if(/^(?:Pan[ -]+)?India$/i.test(cleaned))return 'India'
 if(cleaned.length<=2)return null
 const exact=nativeLocationCountryName(cleaned)
 if(exact)return exact
 // Only an explicitly written country in its own final parenthetical qualifies;
 // no city, two-letter state suffix or arbitrary mention becomes a country.
 const parenthetical=/\(([^()]*)\)\s*$/.exec(cleaned)
 const country=parenthetical&&nativeCountryName(parenthetical[1])
 return country&&parenthetical[1].trim().length>2?country:null
}
const writtenCountryPatterns=(()=>{
 const names=new Set()
 for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){
  const name=nativeCountryName(String.fromCharCode(a,b));if(name&&name.length>2)names.add(name)
 }
 return [...names].map(name=>[name,new RegExp('(?<![\\p{L}\\p{N}])'+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s+')+'(?![\\p{L}\\p{N}])','iu')])
})()
const ownWorkplaceCountries=value=>typeof value==='string'?[...new Set([
 explicitWorkplaceCountry(value),...writtenCountryPatterns.filter(([,pattern])=>pattern.test(value)).map(([name])=>name),
].filter(Boolean))]:[]
const criteriaContent=blocks=>{
 const text=blocks.filter(value=>!/:\s*$/.test(value)).join(' ').trim()
 return text.length>=30&&text.split(/\s+/).length>=5
  &&!/^(?:tbd|to be (?:updated|announced|defined)|n\/?a|not applicable|coming soon|job description unavailable)[\s.!]*$/i.test(text)
}
export function roleModel(native,listing,now){
 need(native&&native.jobSeq===listing.jobSeq&&native.companyMstrSeq===PROFILE.companyId&&native.jobVO&&native.companyVO,'own native role envelope changed')
 const row=native.jobVO,employer=native.companyVO;companyIdentity(employer)
 need(row.jobSeq===listing.jobSeq&&row.jobId===listing.jobSeq&&row.jobTitle===listing.jobTitle&&row.companySeq===PROFILE.companyId
  &&employer.parentCompanyMstrSeq===PROFILE.parentId,'own native role/listing identity changed')
 const issues=[],full=extractActiveDescription(row.jobDesc),blocks=blocksFor(row.jobDesc)
 const active=native.enableLink==='Y'&&native.linkDeactivated===false&&native.nonErLinkDeactivated===false&&row.jobStatus==='ACTIVE'&&row.allowCareerSite==='Y'
 if(!active)issues.push('native-role-not-active')
 const purposeIndexes=blocks.flatMap((text,index)=>/^Job Purpose\s*:?$/i.test(text)?[index]:[])
 const responsibilitiesIndexes=blocks.flatMap((text,index)=>/^Job Responsibilities\s*:?$/i.test(text)?[index]:[])
 const purpose=purposeIndexes[0],responsibilities=responsibilitiesIndexes[0]
 const nextSection=blocks.findIndex((text,index)=>index>responsibilities&&/^(?:Job (?:Purpose|Details|Title)|Educational Qualifications|Key Skills|Experience Required|Major Stakeholders|Declaration|Acknowledgements?|Approvals?)\s*:?$/i.test(text))
 const complete=typeof full==='string'&&full.length>=100&&purposeIndexes.length===1&&responsibilitiesIndexes.length===1&&purpose<responsibilities
  &&criteriaContent(blocks.slice(purpose+1,responsibilities))&&criteriaContent(blocks.slice(responsibilities+1,nextSection<0?undefined:nextSection))
 if(!complete)issues.push('native-full-criteria-unavailable')
 let posted=null;try{posted=nativeDate(row.publishDetails?.CAREER_SITE,{required:true}).iso}catch{issues.push('native-publication-time-unresolved')}
 if(posted&&Date.parse(posted)>Date.parse(now))issues.push('native-publication-in-future')
 for(const field of ['jobDesc','otherDetails','jobSkills','supplementaryDetails']){
  if(row[field]!=null&&typeof row[field]!=='string'){issues.push('unreviewed-native-public-field');continue}
  const lines=negativeBlocks(row[field]),text=lines.join(' ')
  const affirmative=lines.flatMap(line=>[
   ...line.matchAll(/\b(?:you (?:will be|are) employed by|your employer (?:is|will be))\s+([^.!?]+)(?:[.!?]|$)/gi),
   ...line.matchAll(/(?:^|[.!?]\s+)([^.!?]+?)\s+is your employer\b/gi),
  ]).map(match=>match[1].trim())
  if(lines.some(line=>/^(?:Employer|Organization Name)\s*:\s*/i.test(line)&&key(line.replace(/^[^:]+:\s*/,''))!==key(PROFILE.company))
   ||affirmative.some(name=>key(name)!==key(PROFILE.company))
   ||/\bHDFC Bank.{0,60}(?:is not|will not be).{0,40}employer\b|\bnot (?:be )?employed by\b/i.test(text))issues.push('native-employer-contradiction')
 }
 for(const model of [row,native,employer])for(const[field,value]of Object.entries(model))if(/^(?:legalEmployer|employer|employerName|hiringOrganization)$/i.test(field)
  &&value!=null&&value!=='')issues.push('unreviewed-native-employer-field')
 if(row.jobLocationList!=null&&(!Array.isArray(row.jobLocationList)||row.jobLocationList.length))issues.push('unreviewed-native-location-list')
 let closing=null
 if(row.hiringDeadline!=null&&row.hiringDeadline!=='')try{closing=nativeDate(row.hiringDeadline).iso;if(Date.parse(closing)<Date.parse(now))issues.push('native-role-expired')}catch{issues.push('native-closing-time-unresolved')}
 if(/^\d+$/.test(String(row.numOfOpening))&&Number(row.numOfOpening)===0)issues.push('native-no-open-positions')
 if(/^\d+$/.test(String(row.numOfOpening))&&Number(row.numOfOpening)>0&&/^\d+$/.test(String(row.jobPositionsClosed))
  &&Number(row.jobPositionsClosed)>=Number(row.numOfOpening))issues.push('native-no-open-positions')
 const titleIndex=blocks.findIndex(t=>/^Job Title\s*:?$/i.test(t)),start=blocks.findIndex(t=>/^Job Details\s*:?$/i.test(t)),end=blocks.findIndex((t,i)=>i>start&&/^Job Purpose\s*:?$/i.test(t))
 const locations=start>=0&&end>start?blocks.slice(start+1,end).filter(t=>/^Location\s*:/i.test(t)):[]
 const ownWorksite=titleIndex>=0&&titleIndex<start&&key(blocks[titleIndex+1])===key(row.jobTitle)&&locations.length===1
  &&/^Location\s*:\s*(?:Pan[ -]+)?India\s*$/i.test(locations[0])
 const typed=[]
 for(const field of ['country','countryCode','countryName','jobCountry'])for(const model of [listing,row])if(model[field]!=null&&model[field]!==''){
  const country=nativeCountryName(model[field]);if(country)typed.push(country);else issues.push('native-typed-country-unresolved')
 }
 for(const value of [listing.jobLocation,listing.locations,row.jobLocation,row.locations])typed.push(...ownWorkplaceCountries(value))
 for(const field of ['jobDesc','otherDetails','jobSkills','supplementaryDetails'])for(const line of negativeBlocks(row[field])){
  const label=/^(?:(?:Job|Work)\s+)?(?:Location|Country|Workplace)\s*:\s*(.+)$/i.exec(line)
  const statement=/^(?:This|The) (?:role|position|job) (?:is|will be) (?:based|located) in\s+(.+)$/i.exec(line)
  typed.push(...ownWorkplaceCountries((label||statement)?.[1]))
 }
 if(locations.length>1||ownWorksite&&typed.some(country=>country!=='India'))issues.push('native-country-contradiction')
 const country=locations.length>1?null:ownWorksite&&!typed.some(country=>country!=='India')?'India':!ownWorksite&&typed.length&&typed.every(value=>value===typed[0])&&typed[0]!=='India'?typed[0]:null
 if(!country)issues.push('native-country-unresolved')
 return{row,issues:[...new Set(issues)],country,typedCountries:[...new Set(typed)],fullCriteriaComplete:complete,posted,closing,workplaceProof:ownWorksite?{method:'own-role-active-JobDetails-worksite-label',
  field:'jobVO.jobDesc',label:'Location',value:locations[0].replace(/^Location\s*:\s*/i,''),nativeId:row.jobSeq,nativeTitle:row.jobTitle,descriptionSHA256:sha(row.jobDesc)}:null}
}
