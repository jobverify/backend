import {parse} from 'acorn'
import {createHash} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {criteria} from '../../scraper-support/native-sources/declaredGreenhouse/nativeData.js'
import {decode as decodeEntities} from '../../scraper-support/native-sources/cisVeeam/publishedData.js'
import {failure} from './runtime20261107.js'

export const PROFILE=Object.freeze({
 primaryURL:'https://cribl.io/careers/',
 assetURL:'https://cribl.io/_next/static/chunks/3o88zli53gdwb.js',
 assetSHA256:'457981998a3ffd693f3e53855c06afd62b19e3b6c1ea834f8d2994bf6b33f84d',
 factorySHA256:'8ff545bdacc01231a5099cbc00cef85aab8d5efacc641e8a8d0beaac24b86ffd',
 feedURL:'https://boards-api.greenhouse.io/v1/boards/cribl/jobs?content=true',
 moduleId:656347,roleModuleId:468325,
})
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex')
export const requireNative=(ok,reason)=>{if(!ok)throw failure('Cribl native contract: '+reason,'CRIBL_NATIVE_PROOF')}
const norm=value=>String(value??'').replace(/\s+/g,' ').trim()
const executable=node=>!Object.hasOwn(node.attrs,'nomodule')&&['','text/javascript','application/javascript','module'].includes((node.attrs.type||'').trim().toLowerCase())
const property=(node,key)=>node?.type==='MemberExpression'&&!node.computed&&node.property?.name===key
const nextPush=node=>node?.type==='CallExpression'&&property(node.callee,'push')&&property(node.callee.object,'__next_f')&&node.callee.object.object?.name==='self'
const decode=bytes=>new TextDecoder('utf-8',{fatal:true}).decode(bytes)

// This is a data reader. Publisher JavaScript is parsed for literal push
// arguments; it is never evaluated, imported or run in a browser.
export function flightDocument(html){
 const doc=readNativeDocument(html),parts=[]
 requireNative(!doc.nodes(n=>n.tag==='base').length,'unreviewed document base')
 for(const script of doc.nodes(n=>n.tag==='script'&&!n.attrs.src&&executable(n))){
  if(!(script.raw||'').includes('self.__next_f'))continue
  const ast=parse(script.raw,{ecmaVersion:'latest',sourceType:'script'})
  for(const statement of ast.body){
   const call=statement.type==='ExpressionStatement'?statement.expression:null
   if(!nextPush(call))continue
   requireNative(call.arguments.length===1,'nonliteral Flight argument')
   const arg=call.arguments[0];let value
   try{value=JSON.parse(script.raw.slice(arg.start,arg.end))}catch{requireNative(false,'nonliteral Flight packet')}
   requireNative(Array.isArray(value),'invalid Flight packet')
   if(value[0]===1){requireNative(value.length===2&&typeof value[1]==='string','invalid Flight text packet');parts.push(value[1])}
  }
 }
 requireNative(parts.length>0,'active literal Flight packets unavailable')
 const stream=Buffer.from(parts.join('')),models=new Map(),imports=new Map(),texts=new Map(),seen=new Set();let at=0
 while(at<stream.length){
  if(stream[at]===10||stream[at]===13){at++;continue}
  const colon=stream.indexOf(58,at)
  requireNative(colon>=at&&colon-at<16,'invalid Flight frame identity')
  const id=decode(stream.subarray(at,colon));requireNative(/^[a-f0-9]*$/.test(id),'invalid Flight frame identity')
  at=colon+1
  if(id){requireNative(!seen.has(id),'duplicate Flight frame');seen.add(id)}
  if(stream[at]===84){
   const comma=stream.indexOf(44,at+1),lengthText=decode(stream.subarray(at+1,comma))
   requireNative(id&&comma>at+1&&/^[a-f0-9]{1,8}$/.test(lengthText),'invalid Flight text length')
   const length=parseInt(lengthText,16),end=comma+1+length
   requireNative(length<=4000000&&end<=stream.length,'truncated Flight text')
   texts.set(id,decode(stream.subarray(comma+1,end)));at=end;continue
  }
  let end=stream.indexOf(10,at);if(end<0)end=stream.length
  const row=decode(stream.subarray(at,end));at=end+1
  if(!id)continue
  if(row.startsWith('I'))imports.set(id,JSON.parse(row.slice(1)))
  else if(/^[\[{\"]/.test(row)||['null','true','false'].includes(row))models.set(id,JSON.parse(row))
 }
 requireNative(models.has('0'),'Flight root unavailable')
 const resolve=(value,chain=new Set(),depth=0)=>{
  requireNative(depth<128,'Flight model depth exceeded')
  if(typeof value==='string'){
   if(value.startsWith('$$'))return value.slice(1)
   const match=/^\$([a-f0-9]+)$/.exec(value)
   if(!match)return value
   const key=match[1];requireNative(!chain.has(key),'cyclic Flight reference')
   if(texts.has(key))return texts.get(key)
   requireNative(models.has(key),'unresolved Flight native field')
   return resolve(models.get(key),new Set([...chain,key]),depth+1)
  }
  if(Array.isArray(value))return value.map(v=>resolve(v,chain,depth+1))
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,resolve(v,chain,depth+1)]))
  return value
 }
 // Follow only server model references reachable from the root. Orphaned
 // lookalike props cannot supply publisher identity or a native role.
 const elements=[],visited=new Set()
 const visit=(value,depth=0)=>{
  requireNative(depth<256,'Flight tree depth exceeded')
  if(typeof value==='string'){
   const match=/^\$(?:@|L)?([a-f0-9]+)$/.exec(value)
   if(match&&models.has(match[1])&&!visited.has(match[1])){visited.add(match[1]);visit(models.get(match[1]),depth+1)}
   return
  }
  if(Array.isArray(value)){
   if(value[0]==='$'&&/^\$L[a-f0-9]+$/.test(value[1])&&value[3]&&typeof value[3]==='object')elements.push(value)
   for(const child of value)visit(child,depth+1)
  }else if(value&&typeof value==='object')for(const child of Object.values(value))visit(child,depth+1)
 }
 visited.add('0');visit(models.get('0'))
 return {doc,imports,elements,resolve,textFrames:texts.size,streamBytes:stream.length}
}
const canonical=(doc,expected)=>{
 const nodes=doc.nodes(n=>n.tag==='link'&&(n.attrs.rel||'').toLowerCase().split(/\s+/).includes('canonical'))
 requireNative(nodes.length===1&&nodes[0].attrs.href===expected,'canonical route mismatch')
}
const title=(doc,expected)=>{
 const titles=doc.nodes(n=>n.tag==='title')
 requireNative(titles.length===1&&norm(decodeEntities(titles[0].raw))===norm(expected),'native page title mismatch')
}
export function primaryDeclaration(html){
 const parsed=flightDocument(html),{doc,imports,elements}=parsed
 title(doc,'Careers Homepage | Cribl');canonical(doc,PROFILE.primaryURL)
 requireNative(doc.nodes(n=>n.tag==='section'&&n.attrs.id==='open-roles').length===1,'active open-roles section unavailable')
 const bound=elements.filter(v=>v[3].sectionId==='open-roles')
 requireNative(bound.length===1,'ambiguous open-roles component')
 const binding=imports.get(bound[0][1].slice(2)),path=new URL(PROFILE.assetURL).pathname
 requireNative(Array.isArray(binding)&&binding[0]===PROFILE.moduleId&&binding[2]==='default'&&Array.isArray(binding[1])&&binding[1].includes(path),'reviewed native component binding changed')
 requireNative(doc.nodes(n=>n.tag==='script'&&executable(n)&&n.attrs.src===path).length===1,'reviewed component not actively declared')
 return {moduleId:binding[0],assetURL:PROFILE.assetURL,componentReference:bound[0][1],sectionId:'open-roles'}
}
export function reviewedAsset(bytes){
 requireNative(sha256(bytes)===PROFILE.assetSHA256,'reviewed current component changed')
 const source=decode(bytes),ast=parse(source,{ecmaVersion:'latest',sourceType:'script'}),matches=[],stack=[ast]
 while(stack.length){
  const node=stack.pop()
  if(node.type==='ArrayExpression')for(let i=0;i<node.elements.length-1;i++)if(node.elements[i]?.value===PROFILE.moduleId&&['ArrowFunctionExpression','FunctionExpression'].includes(node.elements[i+1]?.type))matches.push(node.elements[i+1])
  for(const value of Object.values(node))if(Array.isArray(value)){for(const child of value)if(child?.type)stack.push(child)}else if(value?.type)stack.push(value)
 }
 requireNative(matches.length===1,'native module factory ambiguous')
 const factory=source.slice(matches[0].start,matches[0].end)
 requireNative(sha256(Buffer.from(factory))===PROFILE.factorySHA256&&factory.includes(PROFILE.feedURL)&&factory.includes('"/job-detail/".concat('),'reviewed literal native contract changed')
 return {assetSHA256:PROFILE.assetSHA256,factorySHA256:PROFILE.factorySHA256,feedURL:PROFILE.feedURL,roleRoute:'/job-detail/<native-id>'}
}
export const roleURL=id=>'https://cribl.io/job-detail/'+id
export function nativeCollection(body){
 const value=JSON.parse(body)
 requireNative(value&&Array.isArray(value.jobs)&&Number.isSafeInteger(value.meta?.total)&&value.meta.total===value.jobs.length,'native collection total/shape mismatch')
 const ids=new Set()
 for(const job of value.jobs){
  requireNative(job&&Number.isSafeInteger(job.id)&&job.id>0&&!ids.has(job.id),'native post identity missing or duplicated');ids.add(job.id)
  requireNative(job.company_name==='Cribl'&&typeof job.title==='string'&&norm(job.title)&&typeof job.content==='string'&&job.content.length>100&&typeof job.location?.name==='string','native publisher or complete role model unavailable')
  const absolute=new URL(job.absolute_url)
  requireNative(absolute.origin==='https://cribl.io'&&!absolute.username&&!absolute.password&&!absolute.hash&&absolute.pathname==='/job-detail/'&&absolute.search==='?gh_jid='+job.id,'native listing identity URI mismatch')
 }
 return value
}
export function ownRole(html,listing){
 const parsed=flightDocument(html);canonical(parsed.doc,roleURL(listing.id)+'/');title(parsed.doc,listing.title)
 const bound=parsed.elements.filter(v=>v[3]?.data&&typeof v[3].data==='object'&&Object.hasOwn(v[3].data,'id'))
 requireNative(bound.length===1,'own native role data ambiguous or missing')
 const element=bound[0],binding=parsed.imports.get(element[1].slice(2))
 requireNative(Array.isArray(binding)&&binding[0]===PROFILE.roleModuleId&&binding[2]==='default','own role component changed')
 const model=parsed.resolve(element[3].data)
 requireNative(isDeepStrictEqual(model,listing),'own complete native model conflicts with collection')
 const full=criteria(model);requireNative(full.jobDescription&&full.sourceNativeContentText.length>100,'full native criteria unavailable')
 return {model,full,flight:{textFrames:parsed.textFrames,streamBytes:parsed.streamBytes,roleModuleId:binding[0]}}
}
const countries=new Map(),names=new Intl.DisplayNames(['en'],{type:'region',fallback:'none'})
for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){
 const code=String.fromCharCode(a,b),name=names.of(code)
 if(name&&name.length>3&&!['Georgia','Jersey'].includes(name))countries.set(name.toLowerCase(),name)
}
countries.set('united states of america','United States')
export function geography(label){
 const clean=norm(label),withoutRemote=clean.replace(/^remote\s*(?:-\s*)?/i,''),tail=withoutRemote.split(',').at(-1).trim()
 const declarations=[...new Set(withoutRemote.split(/\s*(?:[,;|/]|\s+or\s+|\s+and\s+)\s*/i).map(v=>countries.get(v.toLowerCase())).filter(Boolean))]
 const conflict=declarations.length>1,country=conflict?null:countries.get(withoutRemote.toLowerCase())??countries.get(tail.toLowerCase())??null
 return {location:label,country,countryUnresolved:country===null,sourceCountryScopeUnresolved:country===null,sourceNativeCountryConflict:conflict,city:null,state:null,workplaceType:/^remote\b/i.test(clean)?'Remote':null,
  sourceNativeWorksiteEvidence:{field:'location.name',originalLabel:label,explicitCountryDeclarations:declarations,countryBasis:country?'explicit-written-native-role-country':null,organizationalOfficesUsed:false,corporationAddressUsed:false}}
}

const nativeInstant=value=>{
 if(typeof value!=='string')return null
 const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/.exec(value)
 if(!m)return null
 const [year,month,day,hour,minute,second]=m.slice(1,7).map(Number),millisecond=Number((m[7]||'').padEnd(3,'0'))
 if(year<1000||month<1||month>12||day<1||day>31||hour>23||minute>59||second>59)return null
 const calendar=new Date(Date.UTC(year,month-1,day,hour,minute,second,millisecond))
 if(calendar.getUTCFullYear()!==year||calendar.getUTCMonth()!==month-1||calendar.getUTCDate()!==day)return null
 if(m[8]!=='Z'){
  const zoneHour=Number(m[8].slice(1,3)),zoneMinute=Number(m[8].slice(4,6))
  if(zoneHour>14||zoneMinute>59||zoneHour===14&&zoneMinute!==0)return null
 }
 const instant=Date.parse(value);return Number.isFinite(instant)?instant:null
}
export function publicationState(record,observedAt){
 const issues=[],now=Date.parse(observedAt),published=nativeInstant(record.first_published),updated=nativeInstant(record.updated_at)
 if(published===null)issues.push('native-first-publication-calendar-invalid-or-missing')
 else if(published>now)issues.push('native-first-publication-is-in-the-future')
 if(updated===null)issues.push('native-updated-calendar-invalid-or-missing')
 else if(updated>now)issues.push('native-update-is-in-the-future')
 if(record.application_deadline!==null){
  const deadline=nativeInstant(record.application_deadline)
  if(deadline===null)issues.push('native-application-deadline-calendar-invalid-or-missing')
  else if(deadline<=now)issues.push('native-application-deadline-expired')
  else if(published!==null&&deadline<published)issues.push('native-application-deadline-precedes-publication')
 }
 return {qualified:issues.length===0,issues}
}
