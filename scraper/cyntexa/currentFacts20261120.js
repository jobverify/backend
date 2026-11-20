import {isDeepStrictEqual} from 'node:util'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {normalizeNativeAttributeBoundaries} from '../../scraper-support/utils/nativeHtmlAttributes.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {countryName} from '../../scraper-support/native-sources/jobPostingData.js'
import {nativeDate} from '../../scraper-support/shared/nativeJobPosting.js'
import {findExplicitNativeClosure,readNativeStatusTextBlocks} from '../../scraper-support/utils/sourceAvailability.js'

export const norm=value=>String(value??'').replace(/\s+/g,' ').trim()
export const failure=message=>Object.assign(Error('Current own native publication: '+message),{abortRetries:true,failureKind:'parser_or_contract_error'})
export const need=(ok,message)=>{if(!ok)throw failure(message)}
export const one=(values,label)=>{need(values.length===1,'missing/ambiguous '+label);return values[0]}
export const cls=(n,c)=>(n.attrs.class??'').split(/\s+/).includes(c)
export const enabled=n=>!n.inert&&!Object.hasOwn(n.attrs,'disabled')&&n.attrs['aria-disabled']?.toLowerCase()!=='true'&&!cls(n,'disabled')&&!cls(n,'w-condition-invisible')
export const key=value=>String(value).replace(/^data[-_:]/i,'').replace(/[-_\s]/g,'').toLowerCase()
export function ownURL(href,base,origin){const u=new URL(href,base);need(u.protocol==='https:'&&u.origin===origin&&!u.username&&!u.password&&!u.hash,'native URL leaves the current own publisher');return u}
export function page(html,url,{canonical=true}={}){
 const d=readNativeDocument(normalizeNativeAttributeBoundaries(html)),root=one(d.nodes(n=>n.tag==='root'),'native document root')
 need(!d.nodes(n=>n.tag==='base'||n.tag==='meta'&&n.attrs['http-equiv']?.toLowerCase()==='refresh').length,'unreviewed base/refresh navigation')
 if(canonical){const values=d.nodes(n=>n.tag==='link'&&(n.attrs.rel??'').split(/\s+/).includes('canonical')).map(n=>n.attrs.href);need(values.length===1&&new URL(values[0],url).href===url,'native canonical identity changed')}
 const models=d.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').map(n=>readLiteralModel(n.raw,{rawControls:true}).value),entries=[]
 const walk=(n,ancestors=[])=>{entries.push({node:n,ancestors});for(const c of n.children)if(typeof c!=='string')walk(c,[...ancestors,n])};walk(root)
 // This is a labelled DOM projection, never an original response-byte slice.
 // Full response bytes and their hashes remain with the capture transport.
 const escape=value=>String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;'),voids=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'])
 const outer=node=>typeof node==='string'?node:'<'+node.tag+Object.entries(node.attrs).map(([k,v])=>' '+k+'="'+escape(v)+'"').join('')+'>'+(voids.has(node.tag)?'':(node.raw??node.children.map(outer).join(''))+'</'+node.tag+'>')
 return{...d,root,models,entries,html,url,outer,nativeMarkupProjection:true}
}
export function countries(value){const words=String(value??'').match(/[\p{L}]+/gu)??[],out=new Set();for(let start=0;start<words.length;start++)for(let count=1;count<=5&&start+count<=words.length;count++){const phrase=words.slice(start,start+count).join(' ');if(phrase.length>3||phrase===phrase.toUpperCase()){const name=countryName(phrase);if(name)out.add(name)}}return[...out].sort()}
export function indiaWorkplace(value){const found=countries(value);return found.length===1&&found[0]==='India'}
export function dateFact(raw){
 need(typeof raw==='string'&&raw.length>0,'native date type unavailable')
 const offset=/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?([+-])(\d{2}):(\d{2})$/.exec(raw)
 if(offset){const local=offset[1]+'T'+offset[2]+':'+offset[3]+':'+offset[4]+'.'+(offset[5]??'').padEnd(3,'0')+'Z',base=new Date(local),hours=Number(offset[7]),minutes=Number(offset[8]);need(Number.isFinite(+base)&&base.toISOString()===local&&hours<=14&&minutes<60&&(hours<14||minutes===0),'impossible native offset calendar/time');const instant=new Date(+base-(offset[6]==='+'?1:-1)*(hours*60+minutes)*60000);return{raw,iso:instant.toISOString(),calendarDate:offset[1],precision:offset[5]?'millisecond':'second',exact:true,timeZone:offset[6]+offset[7]+':'+offset[8]}}
 const local=/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(raw)
 if(local){const projected=local[1]+'T'+local[2]+':'+local[3]+':'+(local[4]??'00')+'.000Z',n=new Date(projected);need(Number.isFinite(+n)&&n.toISOString()===projected,'impossible native local calendar/time');return{raw,iso:null,calendarDate:local[1],precision:local[4]?'second':'minute',exact:false,timeZone:null,earliestPossible:+n-14*3600000,latestPossible:+n+12*3600000,unqualifiedTimeZone:true}}
 let parsed;try{parsed=nativeDate(raw,{required:true})}catch(error){throw failure(error.message)}return{...parsed,calendarDate:parsed.iso.slice(0,10),timeZone:parsed.exact?'UTC':null}
}
const publicationPositive=new Set(['active','isactive','published','ispublished','posted','isposted','open','isopen','canapply','allowapplications','acceptingapplications']),publicationNegative=new Set(['closed','isclosed','expired','isexpired','archived','isarchived','disabled','isdisabled','removed','isremoved','deleted','isdeleted'])
const postedKeys=new Set(['dateposted','postingdate','posteddate','publishedat','publicationdate']),expiryKeys=new Set(['validthrough','closingdate','applicationdeadline','expirydate','expirationdate','lastdatetoapply','expires','dateexpires'])
export function fieldsFacts(fields,{employers,at,dates={publications:[],expiries:[]},allowedCountries=['India']}){
 for(const [original,value]of Object.entries(fields)){const name=key(original),raw=typeof value==='string'?value.trim().toLowerCase():value
  if(publicationPositive.has(name))need(raw===true||raw==='true','native publication disabled: '+original)
  if(publicationNegative.has(name))need(raw===false||raw==='false','native publication unavailable: '+original)
  if(['test','istest','dummy','isdummy'].includes(name)&&(typeof value==='boolean'||raw==='true'||raw==='false'))need(raw===false||raw==='false','native test/dummy publication: '+original)
  if(['status','jobstatus','postingstatus','publicationstatus','availability','availabilitystatus'].includes(name))need(typeof raw==='string'&&/^(?:open|active|published|available|approved|accepting applications)$/.test(raw),'native publication status unavailable: '+original)
  if(['employer','employername','company','companyname','legalemployer','hiringorganization'].includes(name)){const label=typeof value==='string'?value:value?.name;need(employers.includes(norm(label)),'native employer contradiction: '+original)}
  if(['country','countrycode','workcountry','jobcountry','addresscountry','workplacecountry'].includes(name)){const label=typeof value==='string'?value:value?.name;need(allowedCountries.includes(countryName(label)),'native workplace country contradiction: '+original)}
  if(['location','joblocation','worklocation','workplace','workplacelocation'].includes(name)&&typeof value==='string')need(countries(value).every(c=>allowedCountries.includes(c)),'native whole workplace contradicts India: '+original)
  if((postedKeys.has(name)||expiryKeys.has(name))&&value!==null&&value!==''){const fact=dateFact(value),expiry=expiryKeys.has(name),now=Date.parse(at);need(Number.isFinite(now),'invalid observation clock');if(fact.unqualifiedTimeZone)need(expiry?fact.earliestPossible>=now:fact.latestPossible<=now,expiry?'native local expiry passed or time-zone ambiguous':'native local publication future or time-zone ambiguous');else need(expiry?(fact.exact?Date.parse(fact.iso)>=now:fact.calendarDate>=at.slice(0,10)):(fact.exact?Date.parse(fact.iso)<=now:fact.calendarDate<=at.slice(0,10)),expiry?'native role expired':'native publication date is in the future');dates[expiry?'expiries':'publications'].push({field:original,...fact})}
 }
 return dates
}
export function scopeFacts(d,root,{employers,at,additionalFields=[],allowedCountries=['India']}={}){
 const dates={publications:[],expiries:[]},nodes=d.nodes(()=>true,root);for(const n of nodes){fieldsFacts(n.attrs,{employers,at,dates,allowedCountries});for(const property of(n.attrs.itemprop??'').split(/\s+/).filter(Boolean)){const dateProperty=postedKeys.has(key(property))||expiryKeys.has(key(property)),values=dateProperty?['content','datetime',...(n.tag==='input'?['value']:[])].filter(k=>Object.hasOwn(n.attrs,k)).map(k=>n.attrs[k]):[n.attrs.content??d.text(n)];for(const value of values.length?values:[d.text(n)])fieldsFacts({[property]:value},{employers,at,dates,allowedCountries})}if(n.attrs['data-cms-field'])fieldsFacts({[n.attrs['data-cms-field']]:d.text(n)},{employers,at,dates,allowedCountries})}for(const fields of additionalFields)fieldsFacts(fields,{employers,at,dates,allowedCountries})
 const lines=readNativeStatusTextBlocks(root);need(!findExplicitNativeClosure(lines),'own native role explicitly closed')
 for(const line of lines){const m=/^([^:]{1,40}):\s*(.+)$/.exec(norm(line));if(!m)continue;const label=key(m[1]),value=m[2];if(['location','joblocation','worklocation','workplace','workplacelocation'].includes(label)){need(countries(value).every(c=>allowedCountries.includes(c)),'authored whole workplace contradicts India')}else if(['status','jobstatus','publicationstatus','postingstatus','availability','employer','company','companyname','legalemployer','hiringorganization','country','workcountry','jobcountry','workplacecountry',...postedKeys,...expiryKeys].includes(label))fieldsFacts({[label]:value},{employers,at,dates,allowedCountries})}
 for(const values of Object.values(dates))values.sort((a,b)=>(a.iso??a.calendarDate).localeCompare(b.iso??b.calendarDate));return{dates,lines,text:d.text(root)}
}
export function schemaJobs(models){const out=[];let count=0;const walk=(v,depth=0)=>{need(depth<=32&&++count<20000,'native schema bound');if(!v||typeof v!=='object')return;if(Array.isArray(v)){v.forEach(x=>walk(x,depth+1));return}if([v['@type']].flat().some(t=>['JobPosting','https://schema.org/JobPosting','http://schema.org/JobPosting'].includes(t)))out.push(v);if(v['@graph'])walk(v['@graph'],depth+1)};for(const m of models)walk(m);return out}
export const projectedDate=dates=>dates[0]?(dates[0].exact?dates[0].iso:dates[0].calendarDate):null
export function markupFacts(html,options){const d=readNativeDocument(html),root=one(d.nodes(n=>n.tag==='root'),'native markup root');return scopeFacts(d,root,options)}
export function authoredModelFacts(model,options){
 const values=[],walk=(value,depth=0)=>{need(depth<=32,'native authored criteria nesting bound');if(!value||typeof value!=='object')return;for(const[key,part]of Object.entries(value)){if(part&&typeof part==='object'){walk(part,depth+1);continue}if(typeof part!=='string'||!/description|criteria|qualification|requirement|responsibilit|skills|education|experience/i.test(key))continue;const d=readNativeDocument(part),root=one(d.nodes(n=>n.tag==='root'),'authored native criteria root');values.push(scopeFacts(d,root,options).dates)}};walk(model);return values
}
export function mergeKnownDates(job,...observations){
 const dates={publications:[...job.sourceNativeDates.publications],expiries:[...job.sourceNativeDates.expiries]};for(const observation of observations)for(const group of['publications','expiries'])dates[group].push(...observation[group]);for(const values of Object.values(dates))values.sort((a,b)=>(a.iso??a.calendarDate).localeCompare(b.iso??b.calendarDate));return{...job,sourceNativeDates:dates,postingDate:projectedDate(dates.publications),closingDate:projectedDate(dates.expiries)}
}
export function closeRole(opening,closing){
 need(isDeepStrictEqual(opening.sourceNativeIdentity,closing.sourceNativeIdentity),'closing native role/employer/workplace/application identity changed')
 need(isDeepStrictEqual(opening.sourceNativeUnknownModel,closing.sourceNativeUnknownModel),'closing native non-criteria business fields changed')
 const different=!isDeepStrictEqual(opening.sourceNativeCriteria,closing.sourceNativeCriteria),job={...opening,sourceNativeRoleClosingQualified:true,sourceNativeClosingRole:closing.sourceNativeRole,sourceNativeClosingCriteria:closing.sourceNativeCriteria,sourceNativeClosingDates:closing.sourceNativeDates}
 if(different){job.sourceNativeCriteriaAlternatives=[opening.sourceNativeCriteria,closing.sourceNativeCriteria];job.sourceCriteriaChangedDuringRead=true;job.sourceDetailComplete=false;job.sourceDetailStatus='partial'}
 const merged={publications:[...opening.sourceNativeDates.publications,...closing.sourceNativeDates.publications],expiries:[...opening.sourceNativeDates.expiries,...closing.sourceNativeDates.expiries]};for(const values of Object.values(merged))values.sort((a,b)=>(a.iso??a.calendarDate).localeCompare(b.iso??b.calendarDate));job.sourceNativeDates=merged;job.postingDate=projectedDate(merged.publications);job.closingDate=projectedDate(merged.expiries);return job
}
export function partialJob({source,company,id,title,url,application,location,criteria,identity,unknownModel={},role,dates,at,countryEvidence,employerEvidence}){return{source,company,jobId:id,requisitionId:null,title,sourceUrl:url,applyUrl:application,link:application,country:'India',location,city:null,state:null,sourceDescription:criteria.text,jobDescription:criteria.text,postingDate:projectedDate(dates.publications),closingDate:projectedDate(dates.expiries),sourceNativeDates:dates,sourceNativeIdentity:identity,sourceNativeUnknownModel:unknownModel,sourceNativeCriteria:criteria,sourceNativeRole:role,sourceCountryEvidence:countryEvidence,sourceNativeEmployerProof:employerEvidence,sourceDetailComplete:false,sourceDetailStatus:'partial',sourceDetailFailureKind:'current-own-published-record;full-renderer-authentication-application-controls-and-backend-unverified',sourceClosingQualified:true,sourceNativeRoleClosingQualified:false,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,backendApplicationActivationVerified:false,applicationSubmitted:false,scrapedAt:at}}
