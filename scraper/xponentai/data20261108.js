import {parse} from 'acorn'
import {isDeepStrictEqual} from 'node:util'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {document as rawDocument} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {nativeHTMLText} from '../../scraper-support/native-sources/declaredGreenhouse/nativeData.js'
import {countryName} from '../../scraper-support/native-sources/jobPostingData.js'
import {failure} from './runtime20261108.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
export const PRIMARY='https://xponent.ai/career/',INDEX='https://xponent.ai/wp-json/',FEED='https://xponent.ai/wp-json/wp/v2/awsm_job_openings'
export const need=(ok,message)=>{if(!ok)throw failure('xponent.ai native: '+message,'XPONENT_NATIVE_PROOF')}
// Validate decoded keys before ordinary decoding, preserving standard object
// prototypes and every original native field without last-key-wins evidence.
const strictJSON=text=>{try{readLiteralModel(text);return JSON.parse(text)}catch(error){need(false,'invalid/ambiguous native JSON: '+error.message)}}
const executable=n=>!Object.hasOwn(n.attrs,'nomodule')&&['','text/javascript','application/javascript','module'].includes((n.attrs.type||'').toLowerCase())
const cls=(n,value)=>(n.attrs.class||'').split(/\s+/).includes(value)
const one=(rows,label)=>{need(rows.length===1,'missing/ambiguous '+label);return rows[0]}
const plain=value=>nativeHTMLText(value)
const canonical=(doc,url)=>need(one(doc.nodes(n=>n.tag==='link'&&(n.attrs.rel||'').split(/\s+/).includes('canonical')),'canonical').attrs.href===url,'canonical identity changed')
function jobBootstrap(doc){
 const script=one(doc.nodes(n=>n.tag==='script'&&!n.attrs.src&&executable(n)&&n.attrs.id==='awsm-job-scripts-js-extra'),'active native job bootstrap'),ast=parse(script.raw,{ecmaVersion:'latest'}),statements=ast.body.filter(n=>n.type!=='EmptyStatement')
 need(statements.length===1&&statements[0].type==='VariableDeclaration'&&statements[0].declarations.length===1,'nonliteral native job bootstrap')
 const declaration=statements[0].declarations[0]
 need(declaration.id.type==='Identifier'&&declaration.id.name==='awsmJobsPublic'&&declaration.init?.type==='ObjectExpression','native job bootstrap ownership changed')
 let value;try{value=strictJSON(script.raw.slice(declaration.init.start,declaration.init.end))}catch{need(false,'native job bootstrap is not literal JSON')}
 return value
}
export function primary(html){
 const doc=readNativeDocument(html);canonical(doc,PRIMARY)
 const title=one(doc.nodes(n=>n.tag==='title'),'primary title')
 need(/^Career\b/.test(plain(title.raw))&&plain(title.raw).includes('xponent.ai'),'primary publisher changed')
 need(one(doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='https://api.w.org/'),'current public API declaration').attrs.href===INDEX,'public API handoff changed')
 const script=one(doc.nodes(n=>n.tag==='script'&&executable(n)&&n.attrs.id==='awsm-job-scripts-js'),'active job plugin declaration'),uri=new URL(script.attrs.src)
 need(uri.origin==='https://xponent.ai'&&uri.pathname==='/wp-content/plugins/wp-job-openings/assets/js/script.min.js'&&jobBootstrap(doc).job_id==='0','current careers/native job plugin binding changed')
 return {primaryURL:PRIMARY,indexURL:INDEX,jobPluginURL:uri.href,publisherProgramsExecuted:false}
}
export function indexContract(text){
 const value=strictJSON(text),route=value.routes?.['/wp/v2/awsm_job_openings'],gets=route?.endpoints?.filter(v=>v.methods?.length===1&&v.methods[0]==='GET')||[]
 need(value.home==='https://xponent.ai'&&value.url==='https://xponent.ai'&&typeof value.name==='string'&&value.name.includes('xponent.ai'),'native REST publisher changed')
 need(gets.length===1&&gets[0].args?.status?.default==='publish'&&gets[0].args?.context?.default==='view'&&gets[0].args?.per_page?.default===10&&route._links?.self?.[0]?.href===FEED,'native public published-job read declaration changed')
 return {collectionURL:FEED,defaultPageSize:10,defaultStatus:'publish',context:'view',nativeSiteName:value.name}
}
export const roleURL=record=>{
 const url=new URL(record.link)
 need(url.origin==='https://xponent.ai'&&!url.username&&!url.password&&!url.search&&!url.hash&&url.pathname==='/jobs/'+record.slug+'/','native own-role URL changed')
 return url.href
}
export function nativeRecord(record){
 need(record&&Number.isSafeInteger(record.id)&&record.id>0&&record.type==='awsm_job_openings'&&record.status==='publish','native published post identity/status changed')
 need(typeof record.slug==='string'&&/^[a-z0-9-]+$/.test(record.slug)&&typeof record.title?.rendered==='string'&&plain(record.title.rendered),'native post title/slug missing')
 need(typeof record.content?.rendered==='string'&&record.content.protected===false&&record.meta&&typeof record.meta==='object'&&!Array.isArray(record.meta)&&Array.isArray(record.class_list),'complete public native post shape missing')
 need(record.class_list.includes('post-'+record.id)&&record.class_list.includes('type-awsm_job_openings')&&record.class_list.includes('status-publish'),'native post class identity disagrees')
 roleURL(record);need(record._links?.self?.length===1&&record._links.self[0].href===FEED+'/'+record.id&&record._links.collection?.[0]?.href===FEED,'native own JSON declaration changed')
 return record
}
export function collection(text,onRecord){
 const values=strictJSON(text);need(Array.isArray(values),'native collection is not an array');const ids=new Set()
 for(const value of values){nativeRecord(value);need(!ids.has(value.id),'duplicate native post identity');ids.add(value.id);onRecord?.(value)}
 return values
}
export function ownJSON(text,listing){const value=nativeRecord(strictJSON(text));need(isDeepStrictEqual(value,listing),'complete own JSON/listing model conflict');return value}
const instant=(value,gmt=false)=>{
 if(typeof value!=='string')return null
 if(gmt){if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?$/.test(value))return null;value+='Z'}
 const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/.exec(value)
 if(!m)return null
 const [year,month,day,hour,minute,second]=m.slice(1,7).map(Number),date=new Date(Date.UTC(year,month-1,day,hour,minute,second,Number((m[7]||'').padEnd(3,'0'))))
 if(year<1000||month<1||month>12||day<1||hour>23||minute>59||second>59||date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)return null
 if(m[8]!=='Z'&&(Number(m[8].slice(1,3))>14||Number(m[8].slice(4,6))>59||Number(m[8].slice(1,3))===14&&Number(m[8].slice(4,6))!==0))return null
 return Number.isFinite(Date.parse(value))?Date.parse(value):null
}
export function publication(record,schema,at){
 const issues=[],now=Date.parse(at),posted=instant(record.date_gmt,true),updated=instant(record.modified_gmt,true),schemaDate=instant(schema.datePosted)
 if(posted===null||schemaDate===null||posted!==schemaDate)issues.push('native-publication-calendar-or-own-schema-conflict')
 if(posted!==null&&posted>now||schemaDate!==null&&schemaDate>now)issues.push('native-publication-is-in-the-future')
 if(updated===null||updated>now)issues.push('native-update-calendar-invalid-or-future')
 const expiry=record.meta.awsm_job_expiry
 if(expiry!==null&&expiry!==undefined&&expiry!==''){
  const deadline=instant(expiry);if(deadline===null)issues.push('native-expiry-calendar-or-timezone-unqualified');else if(deadline<=now)issues.push('native-post-expired')
 }
 if(schema.validThrough!==undefined){const deadline=instant(schema.validThrough);if(deadline===null||deadline<=now)issues.push('own-schema-expiry-invalid-or-past')}
 return {qualified:issues.length===0,issues,originalWPDate:record.date,originalWPDateGMT:record.date_gmt,originalWPModified:record.modified,originalWPModifiedGMT:record.modified_gmt,originalSchemaDatePosted:schema.datePosted,originalExpiryMetadata:{awsm_set_exp_list:record.meta.awsm_set_exp_list,awsm_job_expiry:expiry,awsm_exp_list_display:record.meta.awsm_exp_list_display},activeHiringVerified:false}
}
function geography(schema,record){
 const values=schema.jobLocation===undefined?[]:Array.isArray(schema.jobLocation)?schema.jobLocation:[schema.jobLocation],countries=[],unresolved=[]
 for(const value of values){const native=value?.address?.addressCountry,country=countryName(typeof native==='object'?native?.name:native);if(country)countries.push(country);else unresolved.push(structuredClone(value))}
 const labels=record.class_list.filter(v=>v.startsWith('job-location-')).map(v=>v.slice(13).replaceAll('-',' '))
 for(const label of labels){if(label==='anywhere in india')countries.push('India');else if(label.length>3&&!['georgia','jersey'].includes(label)){const country=countryName(label);if(country)countries.push(country)}}
 const distinct=[...new Set(countries)],conflict=distinct.length>1,country=distinct.length===1&&!unresolved.length?distinct[0]:null
 const modes=record.class_list.filter(v=>/^(?:job-mode|work-mode|work-module)-/.test(v)),workplaces=[...new Set([schema.jobLocationType==='TELECOMMUTE'?'Remote':null,...modes.map(v=>/-(?:remote)$/.test(v)?'Remote':/-(?:hybrid)$/.test(v)?'Hybrid':/-(?:onsite|on-site)$/.test(v)?'On-site':null)].filter(Boolean))],workplace=workplaces.length===1?workplaces[0]:null
 return {country,countryUnresolved:country===null,sourceCountryScopeUnresolved:country===null,sourceNativeCountryConflict:conflict,sourceNativeCountryEvidence:{jobLocation:structuredClone(schema.jobLocation??null),nativeLocationClassLabels:labels,explicitCountries:distinct,unresolvedWorksites:unresolved,companyAddressUsed:false,applicationFormCountryUsed:false},location:null,city:null,state:null,
  workplaceType:workplace,remoteStatus:workplace,sourceNativeWorkplaceConflict:workplaces.length>1,sourceNativeWorkplaceEvidence:{nativeJobLocationType:schema.jobLocationType??null,nativeModeClasses:modes}}
}
export function ownRole(html,record,at){
 const doc=readNativeDocument(html),url=roleURL(record);canonical(doc,url)
 need(!doc.nodes(n=>n.tag==='base').length,'unreviewed document base')
 const body=one(doc.nodes(n=>n.tag==='body'),'role body'),ids=(body.attrs.class||'').split(/\s+/).filter(v=>/^postid-\d+$/.test(v))
 need(ids.length===1&&ids[0]==='postid-'+record.id&&jobBootstrap(doc).job_id===String(record.id),'native own body/bootstrap ID conflict')
 const title=plain(record.title.rendered),heading=one(doc.nodes(n=>n.tag==='h2'&&cls(n,'banner-title')),'own role heading')
 need(doc.text(heading)===title,'own role heading conflicts with native post')
 const head=plain(one(doc.nodes(n=>n.tag==='title'),'own page title').raw)
 need(head.startsWith(title+' – ')&&head.includes('xponent.ai'),'own role head title changed')
 const schemas=[]
 const visit=value=>{if(Array.isArray(value))return value.forEach(visit);if(!value||typeof value!=='object')return;const types=Array.isArray(value['@type'])?value['@type']:[value['@type']];if(types.includes('JobPosting'))schemas.push(value);if(value['@graph'])visit(value['@graph'])}
 for(const script of doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json'))visit(strictJSON(script.raw))
 const schema=one(schemas,'own JobPosting schema')
 need(plain(schema.title)===title&&['Xponent AI','xponent.ai'].includes(schema.hiringOrganization?.name)&&schema.hiringOrganization.sameAs==='https://xponent.ai','own native publisher/title conflict')
 // Optional schema identity must identify this canonical role before its
 // address or publication fields can qualify the native model.
 const identity=(reference,field)=>{
  need(typeof reference==='string'&&reference.length>0,'own schema '+field+' identity missing')
  let target;try{target=new URL(reference,url)}catch{need(false,'invalid own schema '+field+' URL')}
  need(!target.username&&!target.password&&!target.search,'own schema '+field+' identity changed')
  target.hash='';need(target.href===url,'own schema '+field+' identifies another role')
 }
 for(const field of ['url','@id'])if(schema[field]!==undefined)identity(schema[field],field)
 if(schema.mainEntityOfPage!==undefined){
  const value=schema.mainEntityOfPage
  if(typeof value==='string')identity(value,'mainEntityOfPage')
  else{need(value&&typeof value==='object'&&!Array.isArray(value),'own schema mainEntityOfPage identity malformed');const keys=['@id','url'].filter(key=>value[key]!==undefined);need(keys.length>0,'own schema mainEntityOfPage identity missing');for(const key of keys)identity(value[key],'mainEntityOfPage.'+key)}
 }
 one(doc.nodes(n=>n.tag==='div'&&cls(n,'job-extennn')),'active complete role criteria')
 const raw=rawDocument(html),carrier=one(raw.nodes(n=>n.tag==='div'&&raw.hasClass(n,'job-extennn')),'exact complete criteria carrier'),descriptionHTML=raw.outer(carrier),description=plain(descriptionHTML)
 need(description.length>100&&!raw.nodes(n=>n.tag==='form',carrier).length,'complete role criteria missing or includes an application form')
 return {title,description,descriptionHTML,schema:structuredClone(schema),nativePublication:publication(record,schema,at),...geography(schema,record)}
}
