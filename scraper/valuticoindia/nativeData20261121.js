import {parseExpressionAt} from 'acorn'
import {decodeHTML,decodeHTMLAttribute} from 'entities'
import {readNativeDocument,readNativeAttributeTokens,extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
export const SOURCE='valuticoindia',HOME='https://www.valutico.com/',ROOT='https://valutico.com/',CAREERS=ROOT+'careers/',ACCOUNT='valutico-2',API_ACCOUNT='https://apply.workable.com/api/v1/accounts/'+ACCOUNT+'?full=true'
export const fail=(message,fields={})=>Object.assign(Error('[valuticoindia] '+message),{code:'VALUTICO_CURRENT_HOLD',failureKind:'coverage_gap',source:SOURCE,...fields})
export function need(value,message){if(!value)throw fail(message)}
export const norm=value=>String(value??'').replace(/\s+/g,' ').trim()
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)
const keys=(value,expected)=>object(value)&&Object.keys(value).length===expected.length&&expected.every(k=>Object.hasOwn(value,k))
export function strictJSON(input){
 const text=Buffer.isBuffer(input)?new TextDecoder('utf8',{fatal:true,ignoreBOM:true}).decode(input):String(input),value=JSON.parse(text),ast=parseExpressionAt(text,0,{ecmaVersion:'latest'})
 need(text.slice(ast.end).trim()==='','Additional native JSON entity')
 function visit(n){if(n.type==='ObjectExpression'){const names=new Set;for(const p of n.properties){need(p.type==='Property'&&typeof p.key.value==='string'&&!names.has(p.key.value),'Duplicate or non-JSON native property');names.add(p.key.value);visit(p.value)}}else if(n.type==='ArrayExpression')for(const v of n.elements)visit(v)}
 visit(ast);return value
}
export function legacyId(url){const match=/^https:\/\/valutico-2\.workable\.com\/jobs\/([1-9][0-9]*)$/.exec(url);return match&&Number.isSafeInteger(+match[1])?+match[1]:null}
export function modernCode(url){const match=/^https:\/\/apply\.workable\.com\/valutico-2\/j\/([A-F0-9]{10})\/?$/.exec(url);return match?.[1]??null}
export const jobAPI=code=>'https://apply.workable.com/api/v2/accounts/'+ACCOUNT+'/jobs/'+code
function document(html){
 need(typeof html==='string','Original native HTML required')
 const doc=readNativeDocument(html,{sourceRanges:true,excludeObjectFallback:false}),root=doc.nodes(n=>n.tag==='root')[0],entries=[]
 // Read lexical source tokens rather than decoding the shared reader's
 // already-decoded values again. HTML attribute references decode once.
 function visit(node,ancestors){
  if(node.tag!=='root'){
   const opening=html.slice(node.sourceStart,node.sourceOpenEnd),name=/^<[^\t\n\f\r />]+/.exec(opening)
   need(name&&opening.endsWith('>'),'Original native opening tag range required')
   const tokens=readNativeAttributeTokens(opening.slice(name[0].length,-1)),attrs={}
   for(const[key,value]of tokens)if(!Object.hasOwn(attrs,key))Object.defineProperty(attrs,key,{value:decodeHTMLAttribute(value),enumerable:true,configurable:true,writable:true})
   node.attrs=attrs;node.rawAttributeTokens=tokens
   const style=(attrs.style??'').replace(/\/\*[\s\S]*?\*\//g,'')
   const hidden=Object.hasOwn(attrs,'hidden')||Object.hasOwn(attrs,'inert')||attrs['aria-hidden']?.toLowerCase()==='true'||/(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse)|content-visibility\s*:\s*hidden)\s*(?:!important\s*)?(?:;|$)/i.test(style)
   node.inert=ancestors.some(n=>n.inert)||hidden||node.nativeTagUnqualified===true||['template','style','textarea','xmp','iframe','noembed','noframes','plaintext','noscript'].includes(node.tag)
  }
  entries.push({node,ancestors,active:!node.inert&&!ancestors.some(n=>n.inert||['template','noscript','svg','math','object'].includes(n.tag))})
  for(const child of node.children??[])if(typeof child!=='string')visit(child,[...ancestors,node])
 }
 visit(root,[])
 // Decode each original text segment once; parent aggregation only joins
 // already-decoded text. Never fold nested entities into a role identity.
 const text=node=>{
  if(node.inert||['script','style','svg','math'].includes(node.tag))return ''
  if(node.tag==='title')return norm(decodeHTML(node.raw??''))
  return norm(node.children.map(child=>typeof child==='string'?decodeHTML(child):text(child)).join(' '))
 }
 return{doc:{...doc,text},entries}
}
function one(rows,message){need(rows.length===1,message);return rows[0]}
function head(parsed,tag,predicate=()=>true){return one(parsed.entries.filter(e=>e.node.tag===tag&&predicate(e.node)&&e.active),'Unique active native '+tag+' required').node}
const roleType=/(?:^|[/#:])JobPosting$/i,hiring=/\b(?:careers?|jobs?|openings?|vacanc(?:y|ies)|apply|recruit(?:ment|ing)?|eligib\w*|applicants?|requirements?)\b/i
const hiringURL=/ashbyhq|workable|greenhouse|lever\.co|workdayjobs|smartrecruiters|icims|\/(?:careers?|jobs?|openings?|positions?|vacancies)(?:[/#?]|$)/i
function carriers(parsed){
 const closure=/\b(?:applications?|vacancies|openings|positions|jobs|hiring|recruitment)\b[\s\S]{0,100}\b(?:closed|paused|suspended|filled|cancelled|canceled|frozen|no longer available)\b|\b(?:not|no longer)\s+accepting\s+applications\b/i
 for(const {node,ancestors}of parsed.entries){
  for(const name of ['itemtype','typeof'])need(!norm(node.attrs[name]).split(/\s+/).some(v=>roleType.test(v)),'Additional unbound structured vacancy')
  if(node.tag==='script'&&(/json/i.test(node.attrs.type??'')||/^\s*[{[]/.test(node.raw??''))){
   for(const token of (node.raw??'').matchAll(/"(?:\\.|[^"\\])*"/g)){let value;try{value=JSON.parse(token[0])}catch{continue}need(!roleType.test(value),'Additional unbound structured vacancy')}
  }
  if(node.tag==='form')need(!hiringURL.test(Object.values(node.attrs).join(' '))&&!hiring.test(parsed.doc.text(node)),'Additional native recruitment form/channel')
  if(['iframe','object','embed'].includes(node.tag))need(!hiringURL.test(Object.values(node.attrs).join(' '))&&!hiring.test(Object.values(node.attrs).join(' ')),'Additional embedded recruitment programme')
  if(['template','noscript'].includes(node.tag))need(!hiringURL.test(decodeHTML(node.raw??''))&&!/JobPosting/i.test(node.raw??''),'Additional inert recruitment declaration')
  if(![node,...ancestors].some(n=>['script','style','svg','math'].includes(n.tag)))need(!closure.test(parsed.doc.text(node)),'Corporate applications or vacancy availability changed')
 }
}
export function readCorporate(html,url){
 need(url===ROOT||url===CAREERS,'Unbound corporate final URL')
 const parsed=document(html),title=parsed.doc.text(head(parsed,'title')),canonical=head(parsed,'link',n=>n.attrs.rel==='canonical').attrs.href
 need(canonical===url&&/\bValutico\b/.test(title),'Corporate canonical or publisher identity changed')
 carriers(parsed)
 const declarations=[],cards=[],containers=parsed.entries.filter(e=>parsed.doc.hasClass(e.node,'workable-jobs'))
 if(url===CAREERS)need(containers.length===1&&containers[0].active,'Unique active own native vacancy container required')
 const cardNodes=url===CAREERS?containers[0].node.children.filter(n=>typeof n!=='string'):[]
 const seen=new Set
 for(const node of cardNodes){
  need(node.tag==='div'&&node.attrs.class==='job'&&!node.inert,'Unreviewed own native card carrier')
  need(keys(node.attrs,['class']),'Additional card data/eligibility attribute')
  const children=node.children.filter(n=>typeof n!=='string')
  need(children.length===4&&children[0].tag==='h5'&&children[1].tag==='p'&&children[2].tag==='p'&&children[3].tag==='a','Additional or missing authored own card criterion')
  const [h,departmentNode,countriesNode,a]=children,title=parsed.doc.text(h),department=parsed.doc.text(departmentNode),locations=parsed.doc.text(countriesNode),id=legacyId(a.attrs.href)
  need(title&&/^Department:\s*\S/.test(department)&&/^Locations:\s*\S/.test(locations)&&id&&!seen.has(id),'Unbound, duplicate or incomplete own vacancy card')
  need(norm(parsed.doc.text(a))==='Apply Now'&&!a.inert,'Active original application declaration required')
  seen.add(id)
  const countries=locations.replace(/^Locations:\s*/,'').split(',').map(norm)
  need(countries.every(Boolean)&&new Set(countries).size===countries.length,'Ambiguous authored country list')
  cards.push({legacyNativeId:id,title,department:department.replace(/^Department:\s*/,''),countries,legacyURL:a.attrs.href,nativeCardText:parsed.doc.text(node),applicationDeclaration:{label:norm(parsed.doc.text(a)),literalHref:a.attrs.href,attributes:{...a.attrs},rawAttributeTokens:structuredClone(a.rawAttributeTokens)},nativeCardHTML:html.slice(node.sourceStart,node.sourceEnd)})
 }
 if(url===CAREERS)need(cards.length>0,'No observed own current vacancy cards; unknown inventory')
 for(const {node,active,ancestors}of parsed.entries){
  if(node.tag!=='a')continue
  const href=node.attrs.href??'',label=parsed.doc.text(node)
  if(!hiringURL.test(href)&&!hiring.test(label))continue
  let resolved;try{resolved=new URL(href,url).href}catch{throw fail('Malformed authored hiring declaration')}
  const inCard=ancestors.some(n=>cardNodes.includes(n)),allowedOwn=new Set([CAREERS,CAREERS+'#positions',ROOT,ROOT+'#positions'])
  need(active,'Hidden or inert recruitment declaration')
  if(legacyId(href))need(url===CAREERS&&inCard&&cards.some(c=>c.legacyURL===href),'Additional unaccounted native vacancy declaration')
  else need(allowedOwn.has(resolved),'Additional unreviewed recruitment handoff')
  declarations.push({literalHref:href,resolvedURL:resolved,label,attributes:{...node.attrs},rawAttributeTokens:structuredClone(node.rawAttributeTokens)})
 }
 if(url===ROOT)need(declarations.some(d=>d.resolvedURL===CAREERS),'Own active Careers declaration absent')
 const outside=parsed.entries.filter(e=>e.active&&!e.ancestors.some(n=>cardNodes.includes(n))&&!cardNodes.includes(e.node)&&!['script','style','svg','math'].includes(e.node.tag))
 const recruitmentText=[...new Set(outside.map(e=>norm(e.node.children.filter(c=>typeof c==='string').map(c=>decodeHTML(c)).join(' '))).filter(t=>hiring.test(t)))]
 const unboundEligibility=recruitmentText.filter(t=>/\b(?:mandatory|eligib\w*|must|work\s+permit|visa|citizenship|work\s+authori[sz]ation|only\s+applicants)\b/i.test(t))
 return{publisher:'Valutico',title,canonical,careersURL:CAREERS,cards,declarations,recruitmentText,unboundEligibility}
}
export function readModernShell(html,finalURL,card){
 const shortcode=modernCode(finalURL);need(shortcode&&legacyId(card.legacyURL)===card.legacyNativeId,'Foreign modern account or invalid own role mapping')
 const parsed=document(html),canonical=head(parsed,'link',n=>n.attrs.rel==='canonical').attrs.href
 carriers(parsed)
 need(canonical===finalURL,'Whole own role canonical disagrees with native final URL')
 const meta=name=>head(parsed,'meta',n=>n.attrs.name===name).attrs.content
 need(meta('subdomain')===ACCOUNT&&meta('domain')==='workable.com'&&meta('hasCustomDomain')===''&&meta('job')===String(card.legacyNativeId),'Native role shell employer/account/legacy ID changed')
 need(parsed.doc.nodes(n=>n.attrs.id==='app').length===1,'Current native public application shell absent')
 const clients=parsed.entries.filter(e=>e.node.tag==='script'&&/^https:\/\/dcvxs6ggqztsa\.cloudfront\.net\/candidate\/releases\/careers\.[a-f0-9]{16}\.js$/.test(e.node.attrs.src??''))
 need(clients.length===1&&clients[0].active&&Object.hasOwn(clients[0].node.attrs,'defer'),'Unique active current role programme required')
 return{canonical,shortcode,legacyNativeId:card.legacyNativeId,account:ACCOUNT,clientURL:clients[0].node.attrs.src,meta:{subdomain:meta('subdomain'),domain:meta('domain'),hasCustomDomain:meta('hasCustomDomain'),job:meta('job')}}
}
export function readAccount(body){
 const value=strictJSON(body)
 need(keys(value,['id','uid','logo','subdomain','name','url','languages','details']),'Unreviewed complete native account schema')
 need(value.name==='Valutico'&&value.subdomain===ACCOUNT&&value.url===ROOT&&typeof value.uid==='string'&&/^[a-f0-9-]{36}$/.test(value.uid),'Foreign native employer account')
 need(keys(value.details,['overview','ofccp','ofccpDisability','ofccpVeteran','applyWithIndeed','departmentsPublicLevel','gdpr','guessAvatar','hasPrivacyPolicies','mailbox']),'Unreviewed account criteria/application metadata')
 need(keys(value.details.overview,['description'])&&typeof value.details.overview.description==='string','Complete native employer authored overview required')
 return value
}
const JOB_FIELDS=['id','shortcode','title','remote','location','locations','state','isInternal','code','published','type','language','department','accountUid','approvalStatus','workplace','description','requirements','benefits']
const COMPENSATION_FIELDS=['salary_from','salary_to','salary_currency_iso_code','salary_frequency']
const JOB_COMPENSATION_FIELDS=[...JOB_FIELDS,...COMPENSATION_FIELDS]
// The paired current native DTOs publish this complete optional group: safe
// positive whole-number bounds, an explicit open maximum, EUR/USD and year.
// Keep literal values in the full native model. No coercion, bound/currency
// inference, broader frequency support or unknown-field admission is implied.
const validCompensation=j=>COMPENSATION_FIELDS.every(key=>Object.hasOwn(j,key))
 &&Number.isSafeInteger(j.salary_from)&&j.salary_from>0
 &&(j.salary_to===null||Number.isSafeInteger(j.salary_to)&&j.salary_to>=j.salary_from)
 &&['EUR','USD'].includes(j.salary_currency_iso_code)&&j.salary_frequency==='year'
export function readJob(body,account,card,shell){
 const j=strictJSON(body);need(object(j),'Native role object required')
 need(j.id===card.legacyNativeId&&j.shortcode===shell.shortcode&&j.accountUid===account.uid&&j.title===card.title,'Native role ID/shortcode/employer/title identity mismatch')
 const issues=[],issue=v=>{if(!issues.includes(v))issues.push(v)}
 if(!keys(j,JOB_FIELDS)&&!keys(j,JOB_COMPENSATION_FIELDS))issue('unreviewed-native-fields')
 if(COMPENSATION_FIELDS.some(key=>Object.hasOwn(j,key))&&!validCompensation(j))issue('unqualified-native-compensation')
 if(j.state!=='published'||j.isInternal!==false||j.approvalStatus!=='approved')issue('not-current-public-publication')
 if(typeof j.published!=='string'||!Number.isFinite(Date.parse(j.published)))issue('unqualified-native-publication-date')
 if(j.code!==null&&typeof j.code!=='string')issue('unqualified-native-requisition-code')
 if(typeof j.description!=='string'||!extractActiveDescription(j.description)||typeof j.requirements!=='string'||typeof j.benefits!=='string')issue('incomplete-native-authored-criteria')
 if(!Array.isArray(j.department)||j.department.some(v=>typeof v!=='string')||j.department.join(', ')!==card.department)issue('corporate-native-department-mismatch')
 const validLocation=(v,additional)=>keys(v,additional?['city','country','countryCode','hidden','region']:['city','country','countryCode','region'])&&typeof v.city==='string'&&typeof v.country==='string'&&v.country.length>0&&/^[A-Z]{2}$/.test(v.countryCode??'')&&(v.region===null||typeof v.region==='string')&&(!additional||v.hidden===false)
 if(!validLocation(j.location,false)||!Array.isArray(j.locations)||!j.locations.length||j.locations.some(v=>!validLocation(v,true)))issue('unqualified-native-location')
 const locations=Array.isArray(j.locations)?j.locations:[],countries=[...new Set(locations.map(v=>v?.country))]
 if(JSON.stringify(countries)!==JSON.stringify(card.countries))issue('corporate-native-country-mismatch')
 if(!locations.some(v=>v?.country===j.location?.country&&v?.countryCode===j.location?.countryCode&&v?.city===j.location?.city))issue('unqualified-native-location')
 if(locations.some(v=>(v?.countryCode==='IN')!==(v?.country==='India')))issue('unqualified-native-location')
 const india=issues.length===0&&j.location?.country==='India'&&j.location?.countryCode==='IN'&&locations.every(v=>v.country==='India'&&v.countryCode==='IN'&&v.hidden===false)
 return{legacyNativeId:card.legacyNativeId,corporateCard:structuredClone(card),nativeJob:structuredClone(j),nativeAccountUid:account.uid,nativeCountry:j.location?.country??null,nativePublicationDate:j.published??null,currentCounterpartObserved:true,nativeCountries:structuredClone(locations),sourceDescription:[j.description??'',j.requirements?'<h2>Requirements</h2>'+j.requirements:'',j.benefits?'<h2>Benefits</h2>'+j.benefits:''].filter(Boolean).join('\n'),roleFactsQualified:issues.length===0,sourceCountryQualifiedForIndia:india,qualificationIssues:issues,applicationDeclaration:structuredClone(card.applicationDeclaration),currentApplicationRoleURL:shell.canonical,activeApplyVerified:false,sourceRoleQualified:false}
}
