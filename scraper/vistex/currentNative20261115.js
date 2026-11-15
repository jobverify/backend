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

const profile=JSON.parse(fs.readFileSync(new URL('./currentScope20261115.json',import.meta.url),'utf8'))
export const CURRENT_INDIA='https://www.vistex.com/careers/careers-in-india/'
export const CURRENT_BOARD='https://recruiting2.ultipro.com/VIS1012VISX/JobBoard/23e64b4e-ff01-4579-9e5a-835480ac7a51/?q=&o=postedDateDesc&f4=AFRPpIe5p0uCZgc2LdGixQ'
const BASE='https://recruiting2.ultipro.com/VIS1012VISX/JobBoard/23e64b4e-ff01-4579-9e5a-835480ac7a51',BOARD_ID='23e64b4e-ff01-4579-9e5a-835480ac7a51'
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const ACCEPT='text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
const sha=value=>createHash('sha256').update(value).digest('hex'),norm=value=>String(value??'').replace(/\s+/g,' ').trim(),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const problem=message=>Object.assign(Error('Vistex current native: '+message),{softFailure:true,abortRetries:true,failureKind:'coverage_gap',sourceScopeComplete:false,lifecycleCleanupAllowed:false})
const need=(condition,message)=>{if(!condition)throw problem(message)}
const one=(values,label)=>{need(values.length===1,'missing or ambiguous '+label);return values[0]}
const all=node=>[node,...node.children.filter(n=>typeof n!=='string').flatMap(all)]
const documentOf=html=>readNativeDocument(normalizeNativeAttributeBoundaries(html))
const rootOf=d=>one(d.nodes(n=>n.tag==='root'),'native document root'),nodesOf=d=>all(rootOf(d))
const walk=node=>node&&typeof node==='object'?[node,...Object.values(node).filter(v=>v&&typeof v==='object').flatMap(v=>Array.isArray(v)?v.flatMap(walk):walk(v))]:[]
const own=(object,keys,label)=>need(object&&typeof object==='object'&&!Array.isArray(object)&&same(Object.keys(object).sort(),[...keys].sort()),'unreviewed '+label+' fields')
const astOf=source=>{try{return parseBoundedProgram(source)}catch{throw problem('unsupported or oversized native initializer program')}}
const literal=(source,node)=>{try{return parseRemoteLiteral(source.slice(node.start,node.end))}catch{throw problem('duplicate decoded or unsupported native literal')}}
const sourceCall=(source,ast,name)=>one(walk(ast).filter(n=>n.type==='NewExpression'&&source.slice(n.callee.start,n.callee.end)===name),'native '+name+' constructor')
const property=(object,name)=>one(object.properties.filter(n=>n.type==='Property'&&(n.key.name??n.key.value)===name),'native '+name+' property').value
const ordered=(source,replacements)=>replacements.sort((a,b)=>b.start-a.start).reduce((value,r)=>value.slice(0,r.start)+r.value+value.slice(r.end),source)

export function currentVistexInitializers(html,kind){
 const d=documentOf(html),nodes=nodesOf(d)
 if(kind==='corporate')return{document:d,nodes}
 const name=kind==='board'?'US.Opportunity.OpportunitiesViewModel':'US.Opportunity.CandidateOpportunityDetail'
 const script=one(nodes.filter(n=>n.tag==='script'&&(n.raw??'').includes('new '+name+'(')),'current '+kind+' initializer')
 need(Object.keys(script.attrs).length===0,'native initializer execution mode changed')
 const source=script.raw,ast=astOf(source),call=sourceCall(source,ast,name)
 need(call.arguments.length===1&&call.arguments[0].type==='ObjectExpression','native constructor data owner changed')
 const dataNode=kind==='board'?property(call.arguments[0],'initialFeaturedOpportunities'):call.arguments[0],model=literal(source,dataNode)
 if(kind==='board'){
  need(Array.isArray(model)&&model.length>0&&model.length<=20,'native initial featured cohort unavailable; empty is not whole inventory')
  const board=literal(source,property(call.arguments[0],'jobBoard')),template=literal(source,property(call.arguments[0],'opportunityLinkUrl'))
  need(board.Id===BOARD_ID&&board.Name==='Vistex Career Opportunities'&&board.AllowExternal===true&&board.AllowInternal===false&&board.HasThirdPartyPostings===false,'native exact employer/board publication context changed')
  need(template===new URL(BASE).pathname+'/OpportunityDetail?opportunityId=00000000-0000-0000-0000-000000000000','native published role template changed')
  return{document:d,nodes,script,source,ast,dataNode,rows:model,template,board}
 }
 const view=sourceCall(source,ast,'US.Opportunity.OpportunityDetailViewModel'),viewArg=view.arguments[0]
 need(view.arguments.length===1&&viewArg.type==='ObjectExpression','native current role/application view owner changed')
 const application=literal(source,property(viewArg,'opportunityApplyRedirectUrl'))
 need(literal(source,property(viewArg,'currentJobBoardId'))===BOARD_ID&&literal(source,property(viewArg,'tenantAlias'))==='VIS1012VISX'&&literal(source,property(viewArg,'userIsRecOrHM'))===false&&literal(source,property(viewArg,'currentUserRequiresReconsent'))===false,'native anonymous current application board binding changed')
 return{document:d,nodes,script,source,ast,dataNode,model,application}
}

const modifiers='(?:(?:now|currently|already|permanently|temporarily)\\s+)*'
const closed=new RegExp('\\b(?:(?:(?:this|the)\\s+)?(?:job|role|position|vacancy|opening|opportunity)\\s+(?:(?:is|was|are|were|has|have)\\s+'+modifiers+'(?:been\\s+)?)?'+modifiers+'(?:closed|filled|withdrawn|cancelled|canceled|expired|removed|unavailable|not\\s+(?:currently\\s+)?available|no\\s+longer\\s+(?:available|active|open))|(?:no\\s+longer|not(?:\\s+currently)?)\\s+accepting\\s+(?:(?:any|new)\\s+)?applications|(?:applications|recruitment|hiring)\\s+(?:for\\s+(?:(?:this|the)\\s+)?(?:role|position|job|vacancy)\\s+)?(?:(?:is|was|are|were|has|have)\\s+'+modifiers+'(?:been\\s+)?)?'+modifiers+'(?:closed|ended|stopped|suspended|unavailable))\\b','i')
const closureOnly=new RegExp('^(?:'+closed.source+')[.!]?$','i')
const rawText=node=>typeof node==='string'?decodeNativeEntities(node):['script','style','meta','link'].includes(node.tag)?'':node.raw!==undefined?decodeNativeEntities(node.raw):node.children.map(rawText).join(' ')
function inactiveClosure(node){
 if(typeof node==='string')return false
 if(!closureOnly.test(norm(rawText(node))))return false
 const definite=['template','noscript'].includes(node.tag)||Object.hasOwn(node.attrs,'hidden')||/^display\s*:\s*none\s*(?:!important)?\s*;?$/i.test(node.attrs.style??'')
 return definite&&all(node).every(n=>['div','p','span','template','noscript'].includes(n.tag)&&Object.entries(n.attrs).every(([k,v])=>k==='hidden'&&['','hidden'].includes(v)||k==='style'&&/^display\s*:\s*none\s*(?:!important)?\s*;?$/i.test(v)))
}
const authored=node=>typeof node==='string'?decodeNativeEntities(node):inactiveClosure(node)||['script','style','meta','link'].includes(node.tag)?'':node.raw!==undefined?decodeNativeEntities(node.raw):node.children.map(authored).join(' ')

export function normalizedVistexProgram(node,initial,kind){
 let body=node.raw??'',replacements=[]
 if(node===initial.script)replacements.push({...initial.dataNode,value:'<COMPLETE-NATIVE-DATA>'})
 if(kind==='role'&&node!==initial.script&&body.includes('opportunityTitle')){
  for(const n of walk(astOf(body)).filter(n=>n.type==='Literal'&&n.value===initial.model.Title))replacements.push({...n,value:'<NATIVE-ROLE-TITLE>'})
 }
 if(kind==='role'&&node===initial.script){
  for(const n of walk(initial.ast).filter(n=>n.type==='Literal'&&(n.end<=initial.dataNode.start||n.start>=initial.dataNode.end)&&typeof n.value==='string'&&n.value.includes(initial.model.Id))){
   need(n.value.startsWith('/VIS1012VISX/')||n.value.startsWith('https://recruiting2.ultipro.com/VIS1012VISX/'),'unreviewed identity-bearing program value')
   replacements.push({...n,value:JSON.stringify(n.value.replaceAll(initial.model.Id,'<NATIVE-OPPORTUNITY-ID>'))})
  }
 }
 if(body.includes('__RequestVerificationToken')){
  const tokens=walk(astOf(body)).filter(n=>n.type==='Literal'&&typeof n.value==='string'&&n.value.includes('<input name="__RequestVerificationToken"'))
  const token=one(tokens,'anonymous native antiforgery input'),match=token.value.match(/^<input name="__RequestVerificationToken" type="hidden" value="(CfDJ8[A-Za-z0-9_-]{140,250})" \/>$/)
  need(match,'unreviewed anonymous native token carrier');replacements.push({...token,value:'<ANONYMOUS-NATIVE-ANTI-CSRF-INPUT>'})
 }
 if(body.includes('Recruiting.TenantFeatureToggle.setFeatureToggles(')){
  const ast=astOf(body),call=one(walk(ast).filter(n=>n.type==='CallExpression'&&body.slice(n.callee.start,n.callee.end)==='Recruiting.TenantFeatureToggle.setFeatureToggles'),'complete native feature-set assignment')
  need(call.arguments.length===1,'native feature-set assignment arguments changed');const flags=literal(body,call.arguments[0])
  need(Array.isArray(flags)&&flags.length>0&&flags.length<=1000&&flags.every(v=>typeof v==='string')&&new Set(flags).size===flags.length,'native feature-set values/duplicates changed')
  // The pinned native consumer stores the array and tests membership with
  // indexOf. Its full set is authoritative; incidental server order is not.
  replacements.push({...call.arguments[0],value:JSON.stringify(flags.toSorted())})
 }
 if(body.includes('var faroSdk = window.GrafanaFaroWebSdk;')){
  const ast=astOf(body),prop=one(walk(ast).filter(n=>n.type==='Property'&&(n.key.name??n.key.value)==='featureToggles'),'native telemetry feature-set companion'),value=literal(body,prop.value)
  const setter=one(initial.nodes.filter(n=>n.tag==='script'&&(n.raw??'').includes('Recruiting.TenantFeatureToggle.setFeatureToggles(')),'native feature-set owner'),setterAST=astOf(setter.raw)
  const call=one(walk(setterAST).filter(n=>n.type==='CallExpression'&&setter.raw.slice(n.callee.start,n.callee.end)==='Recruiting.TenantFeatureToggle.setFeatureToggles'),'native feature-set owner call'),flags=literal(setter.raw,call.arguments[0])
  const telemetry=typeof value==='string'?value.split(','):[]
  need(telemetry.length>0&&new Set(telemetry).size===telemetry.length&&telemetry.every(flag=>flags.includes(flag)),'native telemetry feature-set crossed or changed')
  // Native telemetry publishes330 of the352 current flags. Pin that complete
  // observed subset independently; no flag is discarded or inferred.
  replacements.push({...prop.value,value:JSON.stringify(telemetry.toSorted().join(','))})
 }
 body=ordered(body,replacements)
 return sha(body)
}

const completeHTTPDate=value=>{
 need(typeof value==='string'&&/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} (?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d GMT$/.test(value),'native complete HTTP cache timestamp unavailable')
 const time=Date.parse(value)
 need(Number.isFinite(time)&&new Date(time).toUTCString()===value,'native invalid HTTP cache weekday/calendar')
 return time
}
export function currentVistexDocumentContract(html,kind,{headers}={}){
 const initial=currentVistexInitializers(html,kind),{nodes,document:d}=initial
 const body=one(nodes.filter(n=>n.tag==='body'),'native body')
 let cacheMeta
 if(kind!=='corporate'){
  cacheMeta=one(nodes.filter(n=>n.tag==='meta'&&(n.attrs['http-equiv']??'').toLowerCase()==='expires'),'native document cache meta')
  own(cacheMeta.attrs,['http-equiv','content'],'native document cache meta')
  const offset=completeHTTPDate(headers?.date)-completeHTTPDate(cacheMeta.attrs.content)
  // All nine genuine native documents publish this HTTP cache date exactly
  // 32 days before the response Date, with zero or one second generation lag.
  // This is document cache metadata, never a vacancy expiration property.
  need(offset===2_764_800_000||offset===2_764_801_000,'native document cache timestamp is not bound to response Date')
 }
 const normalize=value=>kind==='role'?value.replaceAll(initial.model.Id,'<NATIVE-OPPORTUNITY-ID>').replaceAll(initial.model.Title,'<NATIVE-ROLE-TITLE>'):value
 const tree=node=>inactiveClosure(node)?null:{tag:node.tag,attrs:Object.fromEntries(Object.entries(node.attrs).map(([k,v])=>[k,node===cacheMeta&&k==='content'?'<DATE-BOUND-NATIVE-HTTP-CACHE>':normalize(v)])),inert:Boolean(node.inert),children:node.children.filter(n=>typeof n!=='string').map(tree).filter(Boolean)}
 let comments=html
 for(const node of nodes.filter(n=>n.raw!==undefined))comments=comments.replace(node.raw,'<RETAINED-RAW-CARRIER>')
 return{
  programs:sha(JSON.stringify(nodes.filter(n=>n.tag==='script').map(n=>({attrs:Object.fromEntries(Object.entries(n.attrs).map(([k,v])=>[k,normalize(v)])),inert:Boolean(n.inert),bodySHA256:normalizedVistexProgram(n,initial,kind)})))),
  styles:sha(JSON.stringify(nodes.filter(n=>n.tag==='style'||n.tag==='link'&&(n.attrs.rel??'').split(/\s+/).includes('stylesheet')).map(n=>({tag:n.tag,attrs:n.attrs,inert:Boolean(n.inert),body:n.raw??null})))),
  authority:sha(JSON.stringify({tree:tree(rootOf(d)),authored:norm(normalize(authored(body))),comments:[...comments.matchAll(/<!--[\s\S]*?-->/g)].map(n=>n[0]),raw:nodes.filter(n=>n.raw!==undefined&&!['script','style'].includes(n.tag)&&!inactiveClosure(n)).map(n=>({tag:n.tag,text:normalize(n.raw)}))})),
 }
}

const effectiveHeaders=['content-type','refresh','content-security-policy','content-security-policy-report-only','x-content-security-policy','x-webkit-csp','content-disposition','link','location','content-location','x-content-type-options','x-frame-options','report-to','reporting-endpoints']
export const currentVistexHeaders=headers=>Object.fromEntries(effectiveHeaders.map(name=>[name,headers[name]??null]))
export function currentVistexRoleInvariant(model){
 const dynamic=new Set(['Id','Title','JobCategoryName','Locations','PostedDate','UpdatedDate','RequisitionNumber','Description','EducationCriteria','WorkExperienceCriteria','JobBoardMemberships','JobLocationType','Salaried'])
 return Object.fromEntries(Object.entries(model).filter(([k])=>!dynamic.has(k)))
}
const isoDate=value=>{
 const m=String(value).match(/^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d{1,6})?Z$/),time=Date.parse(value)
 need(m&&Number.isFinite(time),'native posting timestamp unavailable');const date=new Date(time)
 need(date.getUTCFullYear()===Number(m[1])&&date.getUTCMonth()+1===Number(m[2])&&date.getUTCDate()===Number(m[3]),'invalid native calendar date; rollover forbidden');return date.toISOString()
}
const typedCountry=value=>value&&typeof value==='object'&&!Array.isArray(value)&&same(Object.keys(value).sort(),(Object.hasOwn(value,'Id')?['Code','Id','Name']:['Code','Name']))&&/^[A-Z]{3}$/.test(value.Code)&&typeof value.Name==='string'&&value.Name.trim()&&(!Object.hasOwn(value,'Id')||/^[a-f0-9-]{36}$/.test(value.Id))
const country=locations=>locations.length&&locations.every(l=>typedCountry(l.Address?.Country)&&l.Address.Country.Code==='IND'&&l.Address.Country.Name==='India')?'India':locations.length&&locations.every(l=>typedCountry(l.Address?.Country)&&l.Address.Country.Code!=='IND'&&l.Address.Country.Name!=='India')?'foreign':'mixed-or-unresolved'
const place=l=>({id:l.Id,name:l.LocalizedName,locationId:l.LocalizedLocationId,description:l.LocalizedDescription,display:[l.DisplayName,l.DisplayLocationId,l.DisplayAddress,l.DisplayStreetAddress,l.DisplayDescription],sourceOfTruth:l.SourceOfTruth,line1:l.Address?.Line1??null,line2:l.Address?.Line2??null,city:l.Address?.City??null,region:l.Address?.State?{code:l.Address.State.Code,name:l.Address.State.Name}:null,postal:l.Address?.PostalCode??null,country:l.Address?.Country?.Code??null,countryName:l.Address?.Country?.Name??null})
const places=locations=>locations.map(place).sort((a,b)=>a.id.localeCompare(b.id))
function qualifyLocations(locations,detail){
 need(Array.isArray(locations)&&locations.length>0&&locations.length<=30&&new Set(locations.map(l=>l.Id)).size===locations.length,'native complete distinct location scope unavailable')
 for(const l of locations){
  own(l,profile.locationKeys[detail?'detail':'listing'],'complete native location');own(l.Address,['Line1','Line2','City','PostalCode','State','Country'],'native location address')
  if(l.Address.State!==null)own(l.Address.State,['Code','Name'],'native typed state')
  own(l.Address.Country,detail?['Id','Name','Code']:['Code','Name'],'native typed country')
  need(typeof l.Id==='string'&&typedCountry(l.Address.Country)&&[l.DisplayName,l.DisplayLocationId,l.DisplayAddress,l.DisplayStreetAddress,l.DisplayDescription].every(v=>typeof v==='boolean')&&[0,1].includes(l.SourceOfTruth),'native location meaning changed')
  if(detail)need(l.Shapes===null&&l.IsAvailableForOpportunities===true,'native current location availability/geometry changed')
 }
}
const escape=value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
const entities={amp:'&',quot:'"',apos:"'",nbsp:'\u00a0',lt:'<',gt:'>',ndash:'–',mdash:'—',hellip:'…',rsquo:'’',lsquo:'‘',rdquo:'”',ldquo:'“',trade:'™',reg:'®',copy:'©',bull:'•'}
const decodeRich=value=>String(value).replace(/&(?:#x([a-f\d]+)|#(\d+)|([a-z]+));/gi,(token,hex,decimal,name)=>{
 if(name)return entities[name]??token
 const code=Number.parseInt(hex??decimal,hex?16:10);need(code>0&&code<=0x10ffff&&!(code>=0xd800&&code<=0xdfff),'invalid native description character reference');return String.fromCodePoint(code)
})
const richText=node=>typeof node==='string'?decodeRich(node):node.inert||['script','style'].includes(node.tag)?'':node.raw!==undefined?decodeRich(node.raw):node.children.map(richText).join(' ')
export function currentVistexEmployerIntroduction(description){const d=documentOf(description),p=nodesOf(d).find(n=>n.tag==='p');need(p&&!p.inert,'native employer introduction unavailable');return norm(richText(p))}

function descriptionOf(model){
 const d=documentOf(model.Description),nodes=nodesOf(d)
 const knownSpacer=n=>n.tag==='span'&&same(n.attrs,{'aria-hidden':'true'})&&n.children.every(v=>typeof v==='string')&&norm(rawText(n))===''
 need(typeof model.Description==='string'&&model.Description.length>=500&&nodes.every(n=>(!n.inert||knownSpacer(n))&&['root','p','span','strong','b','i','em','u','ul','ol','li','br','a','div'].includes(n.tag)),'unreviewed non-text or inactive native description carrier')
 for(const n of nodes){
  need(profile.descriptionAttributes.some(value=>value.tag===n.tag&&same(value.attrs,n.attrs)),'unreviewed authored description attribute/value')
 }
 const employer=currentVistexEmployerIntroduction(model.Description)
 need(profile.employerIntroductions.includes(employer),'native original Vistex employer introduction changed')
 let html=model.Description+'<h2>Qualifications</h2>'
 need(Array.isArray(model.EducationCriteria)&&Array.isArray(model.WorkExperienceCriteria),'native full education/experience criteria absent')
 for(const required of [true,false]){
  const education=model.EducationCriteria.filter(n=>n.Required===required)
  if(education.length){html+='<h3>Education</h3><h4>'+(required?'Required':'Preferred')+'</h4><ul>'
   for(const e of education){own(e,['Required','Related','DegreeId','DegreeName','MajorId','MajorName'],'education criterion');need(typeof e.Required==='boolean'&&typeof e.Related==='boolean'&&norm(e.DegreeName)&&norm(e.MajorName),'native education meaning unavailable');html+='<li>'+escape(e.DegreeName)+' or better in '+escape(e.MajorName)+(e.Related?' or related field':'')+'.</li>'}html+='</ul>'}
  const experience=model.WorkExperienceCriteria.filter(n=>n.Required===required)
  if(experience.length){html+='<h3>Experience</h3><h4>'+(required?'Required':'Preferred')+'</h4><ul>'
   for(const e of experience){own(e,['Required','MinimumRequiredYears','MaximumRequiredYears','Description'],'experience criterion');need(typeof e.Required==='boolean'&&norm(e.Description)&&[e.MinimumRequiredYears,e.MaximumRequiredYears].every(v=>v===null||Number.isSafeInteger(v)&&v>=0&&v<=100)&&!(e.MaximumRequiredYears!==null&&e.MinimumRequiredYears===null)&&!(e.MinimumRequiredYears!==null&&e.MaximumRequiredYears!==null&&e.MaximumRequiredYears<e.MinimumRequiredYears),'native experience meaning unavailable')
    const years=e.MinimumRequiredYears===null?'':e.MaximumRequiredYears===null?e.MinimumRequiredYears+' years: ':e.MinimumRequiredYears+' - '+e.MaximumRequiredYears+' years: '
    html+='<li>'+escape(years+e.Description)+'</li>'}html+='</ul>'}
 }
 need(model.EducationCriteria.every(n=>typeof n.Required==='boolean')&&model.WorkExperienceCriteria.every(n=>typeof n.Required==='boolean'),'native criteria grouping unavailable')
 const full=documentOf(html),text=norm(richText(rootOf(full)));need(text.length>=500&&!closed.test(text),'current description explicitly unavailable or incomplete')
 return{html,text,employer}
}

function verifyRole(html,row,now){
 const {model:m,application,document:d,nodes}=currentVistexInitializers(html,'role')
 own(m,profile.modelKeys,'complete role model');need(same(currentVistexRoleInvariant(m),profile.modelInvariant),'unsupported original role criteria/condition values; cannot omit')
 qualifyLocations(m.Locations,true)
 need(m.Id===row.Id&&m.Title===row.Title&&m.RequisitionNumber===row.RequisitionNumber&&m.Featured===row.Featured&&m.FullTime===row.FullTime&&m.JobCategoryName===row.JobCategoryName&&m.OpportunityType===row.OpportunityType,'native title/requisition/employer cohort mismatch')
 need(Array.isArray(m.Locations)&&country(m.Locations)==='India'&&same(places(m.Locations),places(row.Locations)),'native full all-location/country mismatch')
 need([null,0,1,2].includes(m.JobLocationType)&&m.JobLocationType===row.JobLocationType&&typeof m.Salaried==='boolean','native location/pay-type binding changed')
 need(m.OpportunityIsClosed===false&&m.PublishingStatus===1&&m.OpportunityType===0,'current native opportunity is closed or not published')
 need(Array.isArray(m.JobBoardMemberships)&&m.JobBoardMemberships.length>0,'native external job-board publication absent')
 const membership=one(m.JobBoardMemberships.filter(n=>n.JobBoardId===BOARD_ID),'exact native external membership')
 need(membership.PublishedExternal===true&&membership.PublishedInternal===false&&isoDate(membership.ExternalPostedDate)===isoDate(row.PostedDate),'native current external membership/posting mismatch')
 need(Date.parse(isoDate(m.PostedDate))<=Date.parse(now)&&Date.parse(isoDate(m.UpdatedDate))<=Date.parse(now),'native future role timestamp')
 const expected=new URL(BASE).pathname+'/Account/Login?redirectUrl='+encodeURIComponent(new URL(BASE).pathname+'/OpportunityApply?opportunityId='+m.Id)
 need(application===expected,'native public application identity changed')
 const sourceUrl=BASE+'/OpportunityDetail?opportunityId='+m.Id,sourceDescription=descriptionOf(m)
 const active=nodes.filter(n=>!n.inert&&!['script','style','template','noscript'].includes(n.tag)).map(n=>d.text(n)).join(' ')
 need(!closed.test(active),'current visible role unavailable/closed notice')
 const locationTexts=m.Locations.map(l=>[l.Address.City,l.Address.State?.Name,l.Address.Country.Name].filter(Boolean).join(', ')),cities=[...new Set(m.Locations.map(l=>l.Address.City))],states=[...new Set(m.Locations.map(l=>l.Address.State?.Name??null))]
 return{source:'vistex',company:'Vistex',title:m.Title,jobId:m.RequisitionNumber,requisitionId:m.RequisitionNumber,nativeOpportunityId:m.Id,sourceUrl,link:sourceUrl,applyUrl:new URL(application,BASE).href,
  country:'India',city:cities.length===1?cities[0]:null,state:states.length===1?states[0]:null,location:locationTexts.join(' | '),locations:locationTexts,nativeLocations:m.Locations,
  department:m.JobCategoryName,employmentType:'Full Time',remoteStatus:m.JobLocationType===1?'On-site':null,nativeSalaried:m.Salaried,postedAt:isoDate(membership.ExternalPostedDate),postingDate:isoDate(membership.ExternalPostedDate),closingDate:null,
  jobDescription:sourceDescription.text,sourceDescription:sourceDescription.html,sourceNativeDescription:m.Description,sourceNativeModel:m,sourceNativeEmployerIntroduction:sourceDescription.employer,sourceNativeEducationCriteria:m.EducationCriteria,sourceNativeWorkExperienceCriteria:m.WorkExperienceCriteria,
  sourceDetailComplete:true,sourceWholeOriginalCriteriaRetained:true,sourceScopeComplete:false,sourceListingComplete:false,sourceCompanyCoverageComplete:false,lifecycleCleanupAllowed:false,sourceRenderedApplicationQualified:false,sourcePublicApplicationMetadataQualified:true,sourceNativeClosingReconciled:true,scrapedAt:now}
}

export async function runCurrentVistex(options={}){
 options.signal?.throwIfAborted();need(!(options.fetchText||options.fetchPage||options.fetchJson),'original byte/HTTP metadata transport required')
 const now=typeof options.now==='function'?options.now():options.now??new Date().toISOString(),duration=options.sourceDeadlineMs??85000,interval=options.requestIntervalMs??0
 need(Number.isFinite(Date.parse(now))&&Number.isSafeInteger(duration)&&duration>0&&duration<=85000&&Number.isSafeInteger(interval)&&interval>=0&&interval<=60000,'invalid native deadline/clock/pacing')
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(problem('source deadline exceeded')),duration),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
 const allowed=new Set([CURRENT_INDIA]),receipts=[],headersByURL=new Map();let reads=0,totalBytes=0,opening,closing,lastRead=-Infinity
 const byteLength=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteLength').get
 async function read(url,kind){
  signal.throwIfAborted();need(allowed.has(url)&&++reads<=190,'unbound native URL or finite read bound exceeded')
  const wait=Math.max(0,interval-(performance.now()-lastRead));if(wait)await delay(wait,undefined,{signal});lastRead=performance.now()
  const packet=await boundedDeclaredPublicRead(url,{signal,timeoutMs:15000,overflowError:problem('native entity byte bound'),fetchImpl:async(value,init)=>{
   const response=await(options.fetchImpl??globalThis.fetch)(value,{...init,cache:'no-store',credentials:'omit',headers:{...init.headers,'User-Agent':UA,Accept:kind==='asset'?'*/*':ACCEPT}});let size=0
   const body=response.body===null?null:{cancel:reason=>response.body.cancel(reason),getReader(){const reader=response.body.getReader();return{async read(){const part=await reader.read();if(!part.done){need(types.isUint8Array(part.value),'native transport chunks must be bytes');const length=byteLength.call(part.value);need(length<=12_000_000-size&&length<=64_000_000-totalBytes,'native streaming entity/total byte bound');size+=length;totalBytes+=length}return part},cancel:reason=>reader.cancel(reason),releaseLock:()=>reader.releaseLock()}}}
   return{status:response.status,url:response.url,headers:response.headers,body}
  }})
  const bytes=Buffer.from(packet.bodyBase64,'base64');receipts.push({requestedURL:url,...packet,bodySHA256:sha(bytes)})
  headersByURL.set(url,packet.headers)
  need(packet.status===200&&packet.url===url,'native HTTP status or exact final URL changed')
  const expected=kind==='asset'?profile.assets[url]:profile.headers[kind]
  need(expected&&same(currentVistexHeaders(packet.headers),expected.headers),'native effective headers/full MIME, navigation, execution or representation changed')
  if(kind==='asset')need(expected.bytes===bytes.length&&expected.sha256===sha(bytes),'complete authoritative declared client/style bytes changed')
  try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{throw problem('native invalid UTF-8')}
 }
 async function pass(){
  const assets=new Map()
  async function asset(url){
   if(assets.has(url))return
   need(Object.hasOwn(profile.assets,url),'unreviewed authoritative declared asset');allowed.add(url)
   const body=await read(url,'asset');assets.set(url,body)
   for(const dependency of profile.dependencies[url]??[]){need(body.includes(dependency.literal),'current native declared module dependency changed');await asset(dependency.url)}
  }
  async function document(url,kind){
   const html=await read(url,kind),contract=currentVistexDocumentContract(html,kind,{headers:headersByURL.get(url)}),expected=profile.contracts[kind]
   need(expected.some(value=>same(value,contract)),'unreviewed full '+kind+' program/style/context/control/property authority')
   const {nodes}=currentVistexInitializers(html,kind)
   need(!nodes.some(n=>n.tag==='base'),'native base qualification changed')
   for(const dependency of profile.dependencies[url]??[]){need(html.includes(dependency.literal),'current native document data dependency changed');await asset(dependency.url)}
   for(const node of nodes.filter(n=>n.tag==='script'&&Object.hasOwn(n.attrs,'src')||n.tag==='link'&&(n.attrs.rel??'').split(/\s+/).includes('stylesheet'))){
    const target=new URL(node.attrs.src??node.attrs.href,url).href
    if(profile.passiveDeclarations.includes(target))continue
    need(!Object.hasOwn(node.attrs,'disabled')&&!node.attrs.media,'current authoritative native client/style mode changed');await asset(target)
   }
   return html
  }
  const corporate=await document(CURRENT_INDIA,'corporate'),cd=documentOf(corporate),cn=nodesOf(cd)
  need(cd.text(one(cn.filter(n=>n.tag==='h1'),'corporate India heading'))==='Careers in India'&&cn.some(n=>n.tag==='title'&&n.raw==='Careers in India - Vistex, Inc.'),'own current Vistex publisher identity changed')
  const handoffs=cn.filter(n=>n.tag==='a'&&!n.inert&&n.attrs.href===CURRENT_BOARD)
  need(handoffs.length===3&&handoffs.every(n=>/^(?:Find Your Opportunity|LEARN MORE|FIND YOUR OPPORTUNITY)$/.test(cd.text(n))),'own advertised current native handoff missing/ambiguous')
  allowed.add(CURRENT_BOARD);const boardHTML=await document(CURRENT_BOARD,'board'),board=currentVistexInitializers(boardHTML,'board'),seen=new Set(),requisitions=new Set()
  const rows=board.rows,held=[],jobs=[]
  for(const row of rows){
   own(row,profile.rowKeys,'complete native observed row')
   need(/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(row.Id)&&/^[A-Z0-9]{5,30}$/.test(row.RequisitionNumber)&&norm(row.Title),'native complete row identity unavailable')
   need(!seen.has(row.Id)&&!requisitions.has(row.RequisitionNumber),'repeated native opportunity/requisition identity');seen.add(row.Id);requisitions.add(row.RequisitionNumber)
   qualifyLocations(row.Locations,false)
   const scope=country(row.Locations)
   if(scope!=='India'){held.push({row,holdReason:scope});continue}
   const url=new URL(board.template.replace('00000000-0000-0000-0000-000000000000',row.Id),BASE).href;allowed.add(url)
   const html=await document(url,'role');jobs.push(verifyRole(html,row,now))
  }
  need(jobs.length>0,'partial observations establish no qualified positive; zero/company scope unqualified')
  return{rows,held,jobs}
 }
 try{
  opening=await pass();closing=await pass();need(same(opening,closing),'fresh closing native membership/full original criteria/employer/location changed');signal.throwIfAborted()
  const jobs=opening.jobs,audit={source:'vistex',opening,closing,originalResponses:receipts,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,sourceRenderedApplicationQualified:false,applicationSubmissions:0,independentNativeClosingReconciled:true}
  attachSourceObservationEvidence(jobs,{source:'vistex',recordKind:'vacancy-rows',observedRecordCount:opening.rows.length,observedVacancyCount:opening.rows.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  Object.defineProperty(jobs,'sourceAudit',{value:audit,configurable:true});Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CURRENT_INDIA,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:reads,reportedTotal:null,indiaFacetCount:null,verifiedAt:now,reason:'bounded-current-native-featured-cohort;complete-original-India-description-and-all-education-experience-criteria;whole-company-zero-rendered-application-unqualified;cleanup-forbidden'})
 }catch(error){
  if(options.signal?.aborted)throw options.signal.reason
  if(error&&typeof error==='object'&&Object.isExtensible(error))try{Object.defineProperty(error,'sourceAudit',{value:{source:'vistex',opening,closing,originalResponses:receipts,sourceScopeComplete:false,lifecycleCleanupAllowed:false},enumerable:true,configurable:true})}catch{}
  throw error
 }finally{clearTimeout(timer)}
}
