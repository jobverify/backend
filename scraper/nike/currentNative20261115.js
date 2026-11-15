import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {types} from 'node:util'
import {setTimeout as delay} from 'node:timers/promises'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {readNativeDocument,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {normalizeNativeAttributeBoundaries} from '../../scraper-support/utils/nativeHtmlAttributes.js'
import {parseBoundedProgram,parseRemoteLiteral} from '../../scraper-support/utils/remoteScriptData.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const profileURL=new URL('./currentScope20261115.json',import.meta.url)
const profile=JSON.parse(fs.readFileSync(profileURL,'utf8'))
const ORIGIN='https://careers.nike.com',START=ORIGIN+'/jobs',ATS='https://nike.wd1.myworkdayjobs.com'
const LEGAL='NIKE India Technology Center Private Limited'
const sha=value=>createHash('sha256').update(value).digest('hex'),norm=value=>String(value??'').replace(/\s+/g,' ').trim()
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const problem=message=>Object.assign(Error('NIKE current native: '+message),{softFailure:true,abortRetries:true,failureKind:'coverage_gap',sourceScopeComplete:false,lifecycleCleanupAllowed:false})
const need=(value,message)=>{if(!value)throw problem(message)}
const one=(values,label)=>{need(values.length===1,'missing or ambiguous '+label);return values[0]}
const all=node=>[node,...node.children.filter(n=>typeof n!=='string').flatMap(all)]
const hasClass=(node,value)=>(node.attrs.class??'').split(/\s+/).includes(value)
const documentOf=html=>readNativeDocument(normalizeNativeAttributeBoundaries(html))
const rootOf=d=>one(d.nodes(n=>n.tag==='root'),'native root')
const nodesOf=d=>all(rootOf(d))
const own=(object,keys,label)=>need(object&&typeof object==='object'&&!Array.isArray(object)&&same(Object.keys(object).sort(),[...keys].sort()),'unreviewed '+label+' fields')
const effectiveHeaderKeys=['content-type','refresh','content-security-policy','content-security-policy-report-only','x-content-security-policy','x-webkit-csp','content-disposition','link','location','content-location','x-content-type-options','x-frame-options']
// Match the observed HTTP representation, navigation and execution context,
// including absence. In particular, a declared charset is never discarded.
export function currentEffectiveHeaderContract(headers,{url,documentKind}={}){
 const result=Object.fromEntries(effectiveHeaderKeys.map(name=>[name,headers[name]??null]))
 if(documentKind==='application'&&result['content-security-policy-report-only']!==null){
  const address=new URL(url)
  need(address.origin===ATS&&!address.search&&!address.hash&&/^\/nke\/job\/[^/]+\/[^/]+_R-\d+\/apply$/.test(address.pathname),'unreviewed reporting-header application owner')
  // All three genuine anonymous responses have this complete report-only
  // policy. Only its native opaque endpoint token and matching group rotate.
  const match=result['content-security-policy-report-only'].match(/^script-src 'none'; connect-src 'none'; report-uri (https:\/\/csp-reporting\.cloudflare\.com\/cdn-cgi\/script_monitor\/report\?m=[A-Za-z0-9_.]{43}-\d{10}\.\d{7}-1\.0\.1\.1-[A-Za-z0-9_.]{214}); report-to (cf-[a-z]{16})$/)
  need(match,'unreviewed complete native report-only policy/header directive or endpoint')
  const [,uri,group]=match
  const reportTo=headers['report-to']
  need(typeof reportTo==='string'&&reportTo.length>0&&reportTo.length<=4096,'native Report-To JSON/header bound changed')
  let reports;try{const wrapped='['+reportTo+']';JSON.parse(wrapped);reports=parseRemoteLiteral(wrapped)}catch{throw problem('unreviewed native Report-To JSON/header')}
  need(Array.isArray(reports)&&reports.length===2,'unreviewed complete native reporting-header group inventory')
  for(const report of reports){own(report,['group','max_age','endpoints'],'native reporting-header group');need(Array.isArray(report.endpoints)&&report.endpoints.length===1,'unreviewed native reporting-header endpoints');own(report.endpoints[0],['url'],'native reporting-header endpoint')}
  const [nel,csp]=reports
  need(nel.group==='cf-nel'&&nel.max_age===604800&&csp.group===group&&csp.max_age===86400&&csp.endpoints[0].url===uri,'native report-only header group/endpoint binding changed')
  let nelURL;try{need(typeof nel.endpoints[0].url==='string','native reporting-header companion endpoint type changed');nelURL=new URL(nel.endpoints[0].url)}catch{throw problem('unreviewed native reporting-header companion endpoint URL')}
  const opaque=nelURL.searchParams.get('s')
  need(nelURL.origin==='https://a.nel.cloudflare.com'&&nelURL.pathname==='/report/v4'&&!nelURL.username&&!nelURL.password&&!nelURL.hash&&same([...nelURL.searchParams.keys()],['s'])&&typeof opaque==='string'&&opaque.length===144&&/^[A-Za-z0-9+/]+={0,2}$/.test(opaque)&&Buffer.from(opaque,'base64').toString('base64')===opaque,'native reporting-header companion endpoint changed')
  need(headers['reporting-endpoints']===group+'="'+uri+'"','native Reporting-Endpoints header/group binding changed')
  const nativeURI='https://csp-reporting.cloudflare.com/cdn-cgi/script_monitor/report?m=<ANONYMOUS-NATIVE-REPORT>',nativeGroup='cf-<ANONYMOUS-NATIVE-GROUP>'
  result['content-security-policy-report-only']="script-src 'none'; connect-src 'none'; report-uri "+nativeURI+'; report-to '+nativeGroup
  result['report-to']=JSON.stringify([{...nel,endpoints:[{url:'https://a.nel.cloudflare.com/report/v4?s=<ANONYMOUS-NATIVE-NEL>'}]},{...csp,group:nativeGroup,endpoints:[{url:nativeURI}]}])
  result['reporting-endpoints']=nativeGroup+'="'+nativeURI+'"'
 }
 return result
}
const member=(node,name)=>node?.type==='MemberExpression'&&!node.computed&&!node.optional&&node.object?.type==='Identifier'&&node.object.name==='window'&&node.property?.type==='Identifier'&&node.property.name===name
const property=(node,name)=>node.type==='Property'&&!node.computed&&node.kind==='init'&&(node.key.name??node.key.value)===name
const modifiers='(?:(?:already|now|currently|temporarily)\\s+)*'
const state='(?:closed|filled|withdrawn|cancelled|canceled|expired|removed|unavailable|not\\s+(?:currently\\s+)?available|no\\s+longer\\s+(?:available|active|open))'
const verb='(?:(?:is|was|are|were|has|have)\\s+'+modifiers+'(?:been\\s+)?)?'+modifiers
const closed=new RegExp('\\b(?:(?:(?:this|the)\\s+)?(?:job|role|position|vacancy|opening|opportunity)\\s+'+verb+state+'|(?:no\\s+longer|not(?:\\s+currently)?)\\s+accepting\\s+(?:(?:any|new)\\s+)?applications|(?:applications|recruitment|hiring)\\s+(?:for\\s+(?:(?:this|the)\\s+)?(?:role|position|job|vacancy)\\s+)?'+verb+'(?:closed|ended|stopped|suspended|unavailable))\\b','i')
const closureOnly=new RegExp('^(?:'+closed.source+')[.!]?$','i')
const rawText=node=>typeof node==='string'?decodeNativeEntities(node):['script','style','meta','link'].includes(node.tag)?'':node.raw!==undefined?decodeNativeEntities(node.raw):node.children.map(rawText).join(' ')
function inactiveClosure(node){
 if(typeof node==='string')return false
 const noscript=node.tag==='noscript'&&node.raw!==undefined?rootOf(documentOf(node.raw)):null
 if(!closureOnly.test(norm(rawText(noscript??node))))return false
 const definite=['template','noscript'].includes(node.tag)||Object.hasOwn(node.attrs,'hidden')||/^display\s*:\s*none\s*(?:!important)?\s*;?$/i.test(node.attrs.style??'')
 const descendants=noscript?[node,...all(noscript).slice(1)]:all(node)
 return definite&&descendants.every(n=>['div','p','span','template','noscript'].includes(n.tag)&&Object.entries(n.attrs).every(([k,v])=>k==='hidden'&&['','hidden'].includes(v)||k==='style'&&/^display\s*:\s*none\s*(?:!important)?\s*;?$/i.test(v)))
}
const authored=(node,omit)=>node===omit?' <OWN-NATIVE-ARTICLE> ':typeof node==='string'?decodeNativeEntities(node):inactiveClosure(node)||['script','style','meta','link'].includes(node.tag)?'':node.raw!==undefined?decodeNativeEntities(node.raw):node.children.map(n=>authored(n,omit)).join(' ')
const activeStatus=node=>typeof node==='string'?decodeNativeEntities(node):inactiveClosure(node)||['script','style','meta','link','template','noscript'].includes(node.tag)?'':node.children.map(activeStatus).join(' ')
const safeHTML=node=>typeof node==='string'?node:node.inert||inactiveClosure(node)||['script','style','meta','link'].includes(node.tag)?'':`<${node.tag}>${node.children.map(safeHTML).join('')}</${node.tag}>`

export function currentState(html){
 const d=documentOf(html),nodes=nodesOf(d),script=one(nodes.filter(n=>n.tag==='script'&&(n.raw??'').includes('__PRELOAD_STATE__')),'current native preload writer')
 need(!script.inert&&Object.keys(script.attrs).length===0,'native preload execution mode changed')
 let ast;try{ast=parseBoundedProgram(script.raw)}catch{throw problem('unsupported native preload program')}
 need(ast.body.length===2&&ast.body.every(n=>n.type==='ExpressionStatement'&&n.expression.type==='AssignmentExpression'&&n.expression.operator==='='),'native preload whole program changed')
 const first=ast.body[0].expression,last=ast.body[1].expression
 need(member(first.left,'__PRELOAD_STATE__')&&member(last.left,'__BUILD__')&&last.right.type==='Literal'&&last.right.value==='6891f740f9','native build/state assignment changed')
 let state;try{state=parseRemoteLiteral(script.raw.slice(first.right.start,first.right.end))}catch{throw problem('native duplicate/unsupported decoded state literal')}
 own(state,['jobSearch','company','hiringEvents'],'state')
 own(state.jobSearch,['params','totalJob','isLoading','jobs','similarJobs','triggerSearch','facets'],'search')
 return{state,script,assignment:first,document:d}
}
export function currentConfigurationProfile(state){
 const events=structuredClone(state.hiringEvents)
 if(Object.hasOwn(events.params,'pageNumber')){need(Number.isInteger(events.params.pageNumber)&&events.params.pageNumber>=2&&events.params.pageNumber<=10,'unreviewed native event page state');delete events.params.pageNumber}
 return sha(JSON.stringify({company:state.company,hiringEvents:events}))
}
export function currentProgramProfile(html,kind){
 const nodes=nodesOf(documentOf(html)),frames=[]
 let preload
 if(kind!=='application')preload=currentState(html)
 for(const node of nodes.filter(n=>n.tag==='script')){
  let body=node.raw??''
  if(body.includes('__PRELOAD_STATE__')){
   const {assignment}=preload;body=body.slice(0,assignment.right.start)+'<REVIEWED-NATIVE-STATE>'+body.slice(assignment.right.end)
  }else if(node.attrs.type==='application/ld+json'){
   try{parseRemoteLiteral(body)}catch{throw problem('unsupported or duplicate native structured data')}
   body='<COMPLETE-NATIVE-JOBPOSTING>'
  }else if(kind==='application'&&body.includes('window.workday')){
   let ast;try{ast=parseBoundedProgram(body)}catch{throw problem('unreviewed public ATS initializer')}
   const assignment=ast.body.find(n=>n.type==='ExpressionStatement'&&n.expression.type==='AssignmentExpression'&&member(n.expression.left,'workday'))?.expression
   const value=assignment?.right
   need(value?.type==='LogicalExpression'&&value.operator==='||'&&member(value.left,'workday')&&value.right.type==='ObjectExpression','public ATS bootstrap namespace changed')
   const props=value.right.properties,tenant=one(props.filter(n=>property(n,'tenant')),'ATS tenant'),site=one(props.filter(n=>property(n,'siteId')),'ATS site'),token=one(props.filter(n=>property(n,'token')),'anonymous ATS token')
   need(tenant.value.value==='nike'&&site.value.value==='nke'&&token.value.type==='Literal'&&typeof token.value.value==='string'&&token.value.value.length===436&&/^[A-Za-z0-9+/]+={0,2}$/.test(token.value.value)&&Buffer.from(token.value.value,'base64').toString('base64')===token.value.value,'public ATS account/token representation changed')
   body=body.slice(0,token.value.start)+'<ANONYMOUS-NATIVE-BOOTSTRAP-TOKEN>'+body.slice(token.value.end)
  }
  frames.push({attrs:node.attrs,inert:Boolean(node.inert),bodySHA256:sha(body)})
 }
 const other=nodes.flatMap(n=>{
  const attrs=Object.entries(n.attrs).filter(([k,v])=>/^on/i.test(k)||['href','src','action'].includes(k)&&/^\s*javascript:/i.test(v))
  if(['iframe','object','embed','frame','base'].includes(n.tag)||n.tag==='meta'&&/^refresh$/i.test(n.attrs['http-equiv']??''))return[{tag:n.tag,attrs:n.attrs,inert:Boolean(n.inert)}]
  return attrs.length?[{tag:n.tag,attrs,inert:Boolean(n.inert)}]:[]
 })
 return sha(JSON.stringify({frames,other}))
}
export function currentStyleProfile(html){
 return sha(JSON.stringify(nodesOf(documentOf(html)).filter(n=>n.tag==='style'||n.tag==='link'&&(n.attrs.rel??'').toLowerCase().split(/\s+/).includes('stylesheet')).map(n=>({tag:n.tag,attrs:n.attrs,inert:Boolean(n.inert),...(n.tag==='style'?{bodySHA256:sha(n.raw??'')}:{})}))))
}
export function currentAuthorityProfile(html,kind,{row,posting}={}){
 const d=documentOf(html),nodes=nodesOf(d),owner=kind==='role'?one(nodes.filter(n=>n.tag==='article'&&n.attrs.id==='job-details'),'own full article'):null
 const body=one(nodes.filter(n=>n.tag==='body'),'native body'),known=new Map()
 if(row){known.set(row.title,'<NATIVE-TITLE>');known.set(row.sourceUrl,'<NATIVE-ROLE>');known.set(row.applyURL,'<NATIVE-APPLY>')}
 if(posting?.description)known.set(norm(rawText(rootOf(documentOf(posting.description)))),'<FULL-NATIVE-ATS-DESCRIPTION>')
 const tree=node=>{
  if(inactiveClosure(node))return null
  const attrs=Object.fromEntries(Object.entries(node.attrs).map(([k,v])=>{
   if(known.has(v))return[k,known.get(v)]
   if(row&&['href','content'].includes(k)&&v.startsWith(ORIGIN+'/')&&v.endsWith(new URL(row.sourceUrl).pathname))return[k,v.slice(0,-new URL(row.sourceUrl).pathname.length)+'/<CURRENT-NATIVE-ROLE>']
   if(row&&kind==='application'&&k==='href'&&v.startsWith(ATS+'/en-US/nke/job/')&&v.endsWith('_'+row.jobId))return[k,ATS+'/en-US/nke/job/<CURRENT-NATIVE-ROLE>']
   return[k,v]
  }))
  return{tag:node.tag,attrs,inert:Boolean(node.inert),children:node.children.filter(n=>typeof n!=='string').map(tree).filter(Boolean)}
 }
 const inactiveAuthor=(node,parentInactive=false)=>inactiveClosure(node)?[]:node.inert&&!parentInactive?[authored(node)]:node.children.filter(n=>typeof n!=='string').flatMap(n=>inactiveAuthor(n,Boolean(node.inert)))
 const rawCarriers=nodes.filter(n=>n.raw!==undefined&&!['script','style'].includes(n.tag)&&!inactiveClosure(n)).map(n=>({tag:n.tag,body:known.get(norm(n.raw))??n.raw}))
 return{treeSHA256:sha(JSON.stringify(tree(rootOf(d)))),outsideAuthorTextSHA256:sha(norm(authored(body,owner))),inactiveOwnerAuthorTextSHA256:sha(JSON.stringify(owner?inactiveAuthor(owner).map(norm):[])),nonProgramRawTextSHA256:sha(JSON.stringify(rawCarriers))}
}
export function currentDescriptionShape(html){
 const d=documentOf(html),nodes=nodesOf(d)
 need(!nodes.some(n=>n.inert||['script','style','input','textarea','select','meta','link','data','img','object','iframe','template','noscript'].includes(n.tag)),'unreviewed native non-text/inactive description carrier')
 return sha(JSON.stringify(nodes.map(n=>({tag:n.tag,attrs:n.attrs}))))
}
function schema(html,context='https://schema.org'){
 const nodes=nodesOf(documentOf(html)),n=one(nodes.filter(n=>n.tag==='script'&&n.attrs.type==='application/ld+json'),'native structured JobPosting')
 need(!n.inert&&same(n.attrs,{type:'application/ld+json'}),'native structured data mode changed')
 let value;try{value=parseRemoteLiteral(n.raw)}catch{throw problem('native duplicate/unsupported JobPosting literal')}
 need(value?.['@type']==='JobPosting'&&value['@context']===context,'own JobPosting type changed');return value
}
function isoDate(value,dateOnly=false){
 const pattern=dateOnly?/^(\d{4})-(\d{2})-(\d{2})$/:/^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d{1,6})?(?:Z|\+00:00)$/
 const m=String(value).match(pattern),time=Date.parse(value);need(m&&Number.isFinite(time),'native publication date changed')
 const d=new Date(time);need(d.getUTCFullYear()===Number(m[1])&&d.getUTCMonth()+1===Number(m[2])&&d.getUTCDate()===Number(m[3]),'native invalid calendar date; rollover forbidden');return d.toISOString()
}
function rowIdentity(model,seen){
 need(model&&typeof model==='object'&&/^R-\d{3,9}$/.test(model.requisitionID)&&model.reference===model.requisitionID&&norm(model.title),'native row identity unavailable')
 const fields=model.customFields;need(Array.isArray(fields)&&fields.every(f=>typeof f.cfKey==='string')&&new Set(fields.map(f=>f.cfKey)).size===fields.length,'native ambiguous custom fields')
 const path=one(fields.filter(f=>f.cfKey==='cf_job_title_path'),'native title path').value,id=one(fields.filter(f=>f.cfKey==='cf_shorten_job_id'),'native short ID').value
 need(typeof path==='string'&&/^[a-z0-9-]+$/.test(path)&&id===model.requisitionID&&typeof model.originalURL==='string'&&new RegExp('^[^/?#\\\\]+/job/'+id+'$').test(model.originalURL),'native row URL/ID mismatch')
 const url=new URL(model.originalURL,ORIGIN+'/'),apply=new URL(model.applyURL)
 const applicationPath=apply.pathname.match(/^\/(nke|nke2)\/job\/[^/]+\/[^/]+_(R-\d+(?:-1)?)\/apply$/)
 need(url.origin===ORIGIN&&!url.search&&!url.hash&&apply.origin===ATS&&!apply.username&&!apply.password&&!apply.search&&!apply.hash&&applicationPath&&[id,id+'-1'].includes(applicationPath[2]),'native row public Apply identity mismatch')
 need(!seen.has(id),'repeated native vacancy identity');seen.add(id)
 need(model.companyID==='158999-54300'&&model.companyName==='Nike PROD'&&['NIKE','JORDAN','CONVERSE'].includes(model.brandName),'native board/account/brand changed')
 need(Array.isArray(model.locations)&&model.locations.length>0&&model.locations.length<=20,'native all-location scope unavailable')
 return{...model,jobId:id,sourceUrl:url.href,nativeAtsSite:applicationPath[1],nativeAtsRequisitionId:applicationPath[2],nativeLegalEmployer:one(fields.filter(f=>f.cfKey==='cf_company'),'native employer').value??null}
}
function listing(html,page,seen){
 const {state,document:d}=currentState(html),s=state.jobSearch,nodes=nodesOf(d)
 own(s.params,page===1?['filter']:['page_number','filter'],'native page parameters')
 need(same(s.params.filter,{})&&(page===1||s.params.page_number===page)&&s.isLoading===false&&s.triggerSearch===0&&same(s.similarJobs,[])&&Number.isSafeInteger(s.totalJob)&&s.totalJob>0&&Array.isArray(s.jobs)&&s.jobs.length>0&&s.jobs.length<=10,'native current unfiltered page state changed')
 const shells=nodes.filter(n=>n.tag==='div'&&n.attrs['data-react-component']==='jobs-list-only')
 need(shells.length===2&&shells.every(shell=>!shell.inert&&same(shell.attrs,profile.cardAttributes)),'native two-layout card presentation changed')
 const layouts=shells.map(shell=>all(shell).filter(n=>n.tag==='li'&&hasClass(n,'results-list__item')))
 need(layouts.every(cards=>cards.length===s.jobs.length),'native model/card membership mismatch')
 const rows=s.jobs.map((model,index)=>{
  const row=rowIdentity(model,seen)
  for(const cards of layouts){const links=all(cards[index]).filter(n=>n.tag==='a'&&n.attrs.href?.includes('/job/'))
   need(!cards[index].inert&&links.length===2&&links.every(n=>!n.inert&&new URL(n.attrs.href,ORIGIN).href===row.sourceUrl)&&d.text(links[0])===norm(row.title),'native current card identity/title conflict')}
  return row
 })
 const nexts=[...new Set(nodes.filter(n=>n.tag==='a'&&!n.inert&&/next page/i.test(n.attrs['aria-label']??'')).map(n=>new URL(n.attrs.href,ORIGIN).href))]
 need(nexts.length<=1&&(!nexts.length||nexts[0]===ORIGIN+'/jobs/page/'+(page+1)),'native declared pagination changed')
 return{rows,next:nexts[0]??null,total:s.totalJob}
}
const countryScope=row=>row.locations.every(l=>l.country==='India'&&l.countryAbbr==='IN')?'India':row.locations.every(l=>typeof l.country==='string'&&l.country&&typeof l.countryAbbr==='string'&&l.countryAbbr&&l.country!=='India'&&l.countryAbbr!=='IN')?'foreign':'mixed-or-unresolved'
function postalLocations(value,ats=false){
 const places=Array.isArray(value)?value:[value];need(places.length>0&&places.length<=20,'native structured all-location scope unavailable')
 return places.map(place=>{
  own(place,['@type','address'],'native Place');need(place['@type']==='Place','native Place type changed')
  const a=place.address;own(a,ats?['@type','addressCountry','addressLocality']:['@type','streetAddress','addressLocality','addressRegion','postalCode','addressCountry'],'native PostalAddress')
  need(a['@type']==='PostalAddress'&&a.addressCountry===(ats?'India':'IN')&&norm(a.addressLocality),'native structured typed India country conflict');return a
 })
}
function verifyRole(html,application,row,now){
 const d=documentOf(html),nodes=nodesOf(d),body=one(nodes.filter(n=>n.tag==='body'),'role body'),owner=one(nodes.filter(n=>n.tag==='article'&&n.attrs.id==='job-details'),'full role owner')
 const a=documentOf(application),an=nodesOf(a),abody=one(an.filter(n=>n.tag==='body'),'public ATS body')
 need(!closed.test(norm(activeStatus(body)))&&!closed.test(norm(activeStatus(abody))),'current visible availability is closed or unavailable')
 const p=schema(html),ap=schema(application,'http://schema.org')
 own(p,['@context','@type','url','directApply','title','description','identifier','datePosted','employmentType','hiringOrganization','jobLocation'],'own JobPosting')
 own(ap,['@context','@type','title','description','identifier','datePosted','employmentType','hiringOrganization','jobLocation'],'public ATS JobPosting')
 need(p.url===row.sourceUrl&&p.title===row.title&&ap.title===row.title&&p.directApply===true,'native detail title/URL identity conflict')
 own(p.identifier,['@type','name','value'],'own identifier');own(ap.identifier,['@type','name','value'],'ATS identifier')
 need(p.identifier['@type']==='PropertyValue'&&p.identifier.name==='Req ID'&&p.identifier.value===row.jobId&&ap.identifier['@type']==='PropertyValue'&&ap.identifier.name===row.title&&ap.identifier.value===row.jobId,'native role/requisition identity conflict')
 own(p.hiringOrganization,['@type','name','sameAs','logo'],'own employer');own(ap.hiringOrganization,['@type','name','sameAs'],'ATS employer')
 need(p.hiringOrganization['@type']==='Organization'&&p.hiringOrganization.name==='Nike'&&p.hiringOrganization.sameAs==='https://nike.com'&&ap.hiringOrganization['@type']==='Organization'&&ap.hiringOrganization.name===LEGAL&&ap.hiringOrganization.sameAs===''&&row.nativeLegalEmployer===LEGAL&&row.brandName==='NIKE','native brand/legal employer conflict')
 const places=postalLocations(p.jobLocation),atsPlaces=postalLocations(ap.jobLocation,true)
 const expected=row.locations.map(l=>({street:l.streetAddress,city:l.city,region:l.stateAbbr,zip:l.zipCode,country:l.countryAbbr})).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))
 const actual=places.map(l=>({street:l.streetAddress,city:l.addressLocality,region:l.addressRegion,zip:l.postalCode,country:l.addressCountry})).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))
 need(same(expected,actual)&&atsPlaces.length===places.length,'native complete list/detail all-location conflict')
 // Workday's native addressLocality is the reviewed facility label, not the
 // own site's city. Bind both complete original representations for this
 // known requisition; never rewrite or infer an alias between those fields.
 const binding=profile.nativeLocationBindings?.[row.jobId]
 need(binding&&binding.sourceUrl===row.sourceUrl&&binding.applyUrl===row.applyURL&&binding.nativeLegalEmployer===LEGAL
  &&same(p.jobLocation,binding.ownJobLocation)&&same(ap.jobLocation,binding.atsJobLocation),'unreviewed complete own/ATS native location/facility model; address changes require review')
 const postedAt=isoDate(p.datePosted),atsDate=isoDate(ap.datePosted,true)
 need(postedAt.slice(0,10)===atsDate.slice(0,10)&&Date.parse(postedAt)<=Date.parse(now),'native future or conflicting publication date')
 need(same(p.employmentType,['FULL_TIME'])&&ap.employmentType==='FULL_TIME','native employment type conflict')
 const ownDescription=documentOf(p.description).text(rootOf(documentOf(p.description))),atsDescription=documentOf(ap.description).text(rootOf(documentOf(ap.description)))
 need(currentDescriptionShape(p.description)===profile.descriptionShapes.role&&currentDescriptionShape(ap.description)===profile.descriptionShapes.application,'unreviewed complete native description structure/control values')
 // The exact current DOM/program/style cohort is tied to the retained ordinary
 // browser rendering. Retain its complete native active article, while the
 // separate authored-context guard also accounts for known inactive furniture.
 const full=d.text(owner)
 need(full.length>=5000&&ownDescription.length>=3000&&full.includes(ownDescription)&&atsDescription.startsWith(ownDescription)&&atsDescription.length>ownDescription.length,'complete original own/ATS criteria unavailable or contradictory')
 need(!owner.inert&&nodes.filter(n=>n.tag==='h1'&&d.text(n)===row.title).length===1,'native visible own title unavailable')
 const summary=all(owner).filter(n=>['dt','dd'].includes(n.tag))
 need(same(summary.map(n=>n.tag),['dt','dd','dt','dd','dt','dd','dt','dd'])&&summary.every(n=>!n.inert),'native authored summary field structure changed')
 need(same(summary.filter(n=>n.tag==='dt').map(n=>d.text(n)),['Position Type','Career area','Location','Job ID'])
  &&same(summary.filter(n=>n.tag==='dd').map(n=>d.text(n)),[row.employmentType.join(', '),row.customFields.find(f=>f.cfKey==='cf_job_family')?.value,row.locations.map(l=>l.locationParsedText).join(' | '),row.jobId]),'native visible summary country/location/identity conflicts with native model and JobPosting')
 const applies=all(owner).filter(n=>n.tag==='a'&&hasClass(n,'apply-button'))
 need(applies.length===2&&applies.every(n=>!n.inert&&n.attrs.href===row.applyURL&&d.text(n)==='Apply Now'&&!Object.hasOwn(n.attrs,'disabled')&&n.attrs['aria-disabled']!=='true'),'native enabled public application binding changed')
 const authority=currentAuthorityProfile(html,'role',{row,posting:p}),applicationAuthority=currentAuthorityProfile(application,'application',{row,posting:ap})
 need(same(authority,profile.authority.role)&&same(applicationAuthority,profile.authority.application),'unreviewed full native owner/context/control/property/attribute values')
 const canonical=one(an.filter(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'ATS canonical')
 need(canonical.attrs.href.startsWith(ATS+'/en-US/nke/job/')&&canonical.attrs.href.endsWith('_'+row.jobId),'public ATS canonical account/identity conflict')
 const locationTexts=row.locations.map(l=>l.locationParsedText),cities=[...new Set(row.locations.map(l=>l.city))],regions=[...new Set(row.locations.map(l=>l.stateAbbr))]
 return{source:'nike',company:'Nike',jobId:row.jobId,requisitionId:row.jobId,title:row.title,sourceUrl:row.sourceUrl,link:row.sourceUrl,applyUrl:row.applyURL,
  country:'India',city:cities.length===1?cities[0]:null,state:regions.length===1?regions[0]:null,location:locationTexts.join(' | '),locations:locationTexts,
  department:row.customFields.find(f=>f.cfKey==='cf_job_family')?.value??null,employmentType:'Full Time',remoteStatus:null,postingDate:postedAt,postedAt,closingDate:null,
  jobDescription:full+'\n\n'+atsDescription.slice(ownDescription.length).trim(),sourceDescription:owner.children.map(safeHTML).join('')+'\n'+ap.description,
  sourceNativeDescription:p.description,sourceNativeAtsDescription:ap.description,nativeLocations:row.locations,nativeHiringOrganization:p.hiringOrganization,nativeLegalEmployer:LEGAL,nativeBrand:row.brandName,
  sourceNativeJobPosting:p,sourceNativeAtsJobPosting:ap,
  sourceDetailComplete:true,sourceWholeVisibleOwnerRetained:true,sourceScopeComplete:false,sourceListingComplete:false,sourceCompanyCoverageComplete:false,lifecycleCleanupAllowed:false,
  sourceRenderedApplicationQualified:false,sourcePublicApplicationMetadataQualified:true,sourceNativeClosingReconciled:true,scrapedAt:now}
}

export async function runCurrentNike(options={}){
 options.signal?.throwIfAborted();need(!(options.fetchPage||options.fetchText||options.fetchJson),'original byte/HTTP transport required')
 const now=typeof options.now==='function'?options.now():options.now??new Date().toISOString(),duration=options.sourceDeadlineMs??85000,interval=options.requestIntervalMs??500,maxPages=options.maxPages??10
 need(Number.isFinite(Date.parse(now))&&Number.isSafeInteger(duration)&&duration>0&&duration<=180000,'invalid source clock/deadline')
 need(Number.isInteger(maxPages)&&maxPages>0&&maxPages<=10&&Number.isInteger(interval)&&interval>=0&&interval<=60000&&(interval>=500||options.fetchImpl),'invalid existing page bound or host pacing')
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(problem('source deadline exceeded')),duration),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
 const receipts=[],allowed=new Set([START]),lastReads=new Map();let reads=0,totalBytes=0,opening,closing
 const byteLength=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteLength').get
 const read=async(url,kind,documentKind)=>{
  signal.throwIfAborted();need(allowed.has(url)&&++reads<=100,'unbound native URL or read budget')
  const origin=new URL(url).origin,wait=Math.max(0,interval-(performance.now()-(lastReads.get(origin)??-Infinity)))
  if(wait)await delay(wait,undefined,{signal});lastReads.set(origin,performance.now())
  const packet=await boundedDeclaredPublicRead(url,{signal,timeoutMs:15000,overflowError:problem('native byte bound'),fetchImpl:async(value,init)=>{
   const response=await(options.fetchImpl??globalThis.fetch)(value,{...init,cache:'no-store',credentials:'omit',headers:{...init.headers,'User-Agent':'Mozilla/5.0 (compatible; Jobverify Nike scraper)',...(kind==='html'?{Accept:'text/html,application/xhtml+xml'}:{})}});let size=0
   const body=response.body===null?null:{cancel:reason=>response.body.cancel(reason),getReader(){const reader=response.body.getReader();return{
    async read(){const part=await reader.read();if(!part.done){need(types.isUint8Array(part.value),'native chunk must be bytes');const length=byteLength.call(part.value);need(length<=4_000_000-size&&length<=16_000_000-totalBytes,'native streaming byte bound');size+=length;totalBytes+=length}return part},cancel:reason=>reader.cancel(reason),releaseLock:()=>reader.releaseLock()}}}
   return{status:response.status,url:response.url,headers:response.headers,body}
  }})
  const bytes=Buffer.from(packet.bodyBase64,'base64');receipts.push({requestedURL:url,...packet,bodySHA256:sha(bytes)})
  need(packet.status===200&&packet.url===url,'native HTTP status or final URL changed')
  const headerSHA=kind==='html'?profile.documentHeaderSHA256[documentKind]:profile.assets[url]?.headerSHA256
  need(headerSHA&&same(currentEffectiveHeaderContract(packet.headers,{url,documentKind}),profile.effectiveHeaderContracts[headerSHA]),'native effective response headers/full declared MIME, navigation, execution or reporting context changed')
  if(kind!=='html'){const expected=profile.assets[url];need(expected&&expected.bytes===bytes.length&&expected.sha256===sha(bytes),'complete declared client/style bytes changed')}
  try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{throw problem('native invalid UTF-8')}
 }
 const pass=async()=>{
  const assets=new Map(),seen=new Set(),rows=[],pages=[]
  const asset=async url=>{
   if(assets.has(url))return
   need(Object.hasOwn(profile.assets,url),'unreviewed declared native asset');allowed.add(url)
   const body=await read(url,'asset');assets.set(url,body)
   for(const dependency of profile.imports[url]??[]){need(body.includes(dependency.literal),'native declared module import changed');await asset(new URL(dependency.literal,url).href)}
  }
  const document=async(url,kind)=>{
   const html=await read(url,'html',kind),d=documentOf(html),nodes=nodesOf(d)
   if(kind!=='application'){
    const {state}=currentState(html);need(currentConfigurationProfile(state)===profile.stateConfigurationSHA256[kind],'native publisher configuration changed')
    if(kind==='role')need(same(state.jobSearch,{params:{filter:{}},totalJob:0,isLoading:false,jobs:[],similarJobs:[],triggerSearch:0,facets:[]}),'native role client search state changed; empty role state is not a vacancy inventory')
   }
   need(!nodes.some(n=>n.tag==='base'),'unreviewed native base')
   need(currentProgramProfile(html,kind)===profile.programs[kind],'unreviewed whole '+kind+' program/mode/order')
   need(currentStyleProfile(html)===profile.styles[kind],'unreviewed '+kind+' stylesheet declaration/mode/order')
   for(const node of nodes.filter(n=>n.tag==='link'&&n.attrs.rel==='stylesheet'||n.tag==='script'&&Object.hasOwn(n.attrs,'src'))){
    const url=new URL(node.attrs.href??node.attrs.src,ORIGIN).href
    if(profile.passiveExternalScripts.includes(url)){need(node.tag==='script','unexpected passive dependency');continue}
    need(!node.inert&&!Object.hasOwn(node.attrs,'disabled'),'native client/style inactive');await asset(url)
   }
   return html
  }
  let url=START
  for(let page=1;page<=maxPages;page++){
   const html=await document(url,'listing'),list=listing(html,page,seen);rows.push(...list.rows);pages.push({url,page,reportedBoardTotal:list.total,next:list.next})
   if(!list.next)break;allowed.add(list.next);url=list.next
  }
  const jobs=[],held=[]
  for(const row of rows){
   const scope=countryScope(row)
   if(scope!=='India'||row.brandName!=='NIKE'||row.nativeLegalEmployer!==LEGAL){held.push({row,holdReason:scope!=='India'?scope:row.brandName!=='NIKE'?'other-native-brand':'unqualified-native-legal-employer'});continue}
   allowed.add(row.sourceUrl);const html=await document(row.sourceUrl,'role');allowed.add(row.applyURL)
   const application=await document(row.applyURL,'application');jobs.push(verifyRole(html,application,row,now))
  }
  need(jobs.length>0,'partial current observations establish no publishable India vacancy; zero authority unavailable')
  return{rows,pages,jobs,held}
 }
 try{
  opening=await pass();closing=await pass();need(same(opening,closing),'closing native membership/full criteria/employer/location changed');signal.throwIfAborted()
  const jobs=opening.jobs
  attachSourceObservationEvidence(jobs,{source:'nike',recordKind:'vacancy-rows',observedRecordCount:opening.rows.length,observedVacancyCount:opening.rows.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{source:'nike',openingRows:opening.rows,closingRows:closing.rows,openingPages:opening.pages,closingPages:closing.pages,heldNativeRows:opening.held,originalResponses:receipts,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,applicationSubmissions:0,publicApplicationMetadataReads:jobs.length*2,independentNativeClosingReconciled:true},configurable:true})
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:START,firstParty:true,listingComplete:false,reportedTotal:null,indiaFacetCount:null,pagesFetched:reads,verifiedAt:now,reason:'bounded-current-unfiltered-native-observations;complete-own-India-and-public-ATS-criteria;whole-company-zero-rendered-application-unqualified;cleanup-forbidden'})
 }catch(error){
  if(options.signal?.aborted)throw options.signal.reason
  if(error&&typeof error==='object'&&Object.isExtensible(error))try{Object.defineProperty(error,'sourceAudit',{value:{source:'nike',opening,closing,originalResponses:receipts,sourceScopeComplete:false,lifecycleCleanupAllowed:false},enumerable:true,configurable:true})}catch{}
  throw error
 }finally{clearTimeout(timer)}
}
