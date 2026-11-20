import {isDeepStrictEqual} from 'node:util'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {normalizeNativeAttributeBoundaries} from '../../scraper-support/utils/nativeHtmlAttributes.js'
import {parseEightfoldJson} from '../../scraper-support/utils/recruitmentEightfoldData.js'
import {nativeCountryName,nativeDate} from '../../scraper-support/shared/nativeJobPosting.js'
import {findExplicitNativeClosure,readNativeStatusTextBlocks} from '../../scraper-support/utils/sourceAvailability.js'

export const norm=value=>String(value??'').replace(/\s+/g,' ').trim()
export const failure=message=>Object.assign(Error('Current own native publication: '+message),{abortRetries:true,failureKind:'parser_or_contract_error'})
export const need=(ok,message)=>{if(!ok)throw failure(message)}
export const one=(values,label)=>{need(values.length===1,'missing/ambiguous '+label);return values[0]}
export const cls=(n,c)=>(n.attrs.class??'').split(/\s+/).includes(c)
export const enabled=n=>!n.inert&&!Object.hasOwn(n.attrs,'disabled')&&n.attrs['aria-disabled']?.toLowerCase()!=='true'&&!cls(n,'disabled')&&!cls(n,'w-condition-invisible')
export const key=value=>String(value).replace(/^data[-_:]/i,'').replace(/[-_\s]/g,'').toLowerCase()
export function ownURL(href,base,origin){const u=new URL(href,base);need(u.protocol==='https:'&&u.origin===origin&&!u.username&&!u.password&&!u.hash,'native URL leaves the current own publisher');return u}
export function normalizeNativeSchema(raw){
 const repairs=[];let normalized='',quoted=false
 for(let i=0;i<raw.length;i++){const c=raw[i];if(c==='"'){quoted=!quoted;normalized+=c}else if(quoted&&c==='\\'){if(raw[i+1]==='x'){const hex=raw.slice(i+2,i+4);need(/^[a-f\d]{2}$/i.test(hex),'malformed native JSON hex escape');normalized+='\\u00'+hex;repairs.push({offset:i,originalEscape:raw.slice(i,i+4),normalizedEscape:'\\u00'+hex});i+=3}else{normalized+=c+(raw[++i]??'')}}else normalized+=c}
 return{normalized,repairs}
}
export function page(html,url,{canonical=true}={}){
 const d=readNativeDocument(normalizeNativeAttributeBoundaries(html)),root=one(d.nodes(n=>n.tag==='root'),'native document root')
 need(!d.nodes(n=>n.tag==='base'||n.tag==='meta'&&n.attrs['http-equiv']?.toLowerCase()==='refresh').length,'unreviewed base/refresh navigation')
 if(canonical){const values=d.nodes(n=>n.tag==='link'&&(n.attrs.rel??'').split(/\s+/).includes('canonical')).map(n=>n.attrs.href);need(values.length===1&&new URL(values[0],url).href===url,'native canonical identity changed')}
 const originalSchemaBodies=d.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').map(n=>n.raw),normalizedSchemas=originalSchemaBodies.map(normalizeNativeSchema),models=normalizedSchemas.map(n=>parseEightfoldJson(n.normalized)),schemaNormalizations=normalizedSchemas.flatMap((n,modelIndex)=>n.repairs.map(repair=>({modelIndex,...repair}))),entries=[]
 const walk=(n,ancestors=[])=>{entries.push({node:n,ancestors});for(const c of n.children)if(typeof c!=='string')walk(c,[...ancestors,n])};walk(root)
 return{...d,root,models,entries,html,url,originalSchemaBodies,schemaNormalizations}
}
export function countries(value){const words=String(value??'').match(/[\p{L}]+/gu)??[],out=new Set();for(let start=0;start<words.length;start++)for(let count=1;count<=5&&start+count<=words.length;count++){const phrase=words.slice(start,start+count).join(' ');if(phrase.length>3){const name=nativeCountryName(phrase);if(name)out.add(name)}}return[...out].sort()}
export function indiaWorkplace(value){const found=countries(value);return found.length===1&&found[0]==='India'}
export function dateFact(raw){
 need(typeof raw==='string'&&raw.length>0,'native date type unavailable')
 const local=/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(raw)
 if(local){const projected=local[1]+'T'+local[2]+':'+local[3]+':'+(local[4]??'00')+'.000Z',n=new Date(projected);need(Number.isFinite(+n)&&n.toISOString()===projected,'impossible native local calendar/time');return{raw,iso:null,calendarDate:local[1],precision:local[4]?'second':'minute',exact:false,timeZone:null,earliestPossible:+n-14*3600000,latestPossible:+n+12*3600000,unqualifiedTimeZone:true}}
 let parsed;try{parsed=nativeDate(raw,{required:true})}catch(error){throw failure(error.message)}return{...parsed,calendarDate:parsed.iso.slice(0,10),timeZone:parsed.exact?'UTC':null}
}
const publicationPositive=new Set(['active','isactive','published','ispublished','posted','isposted','open','isopen','canapply','allowapplications','acceptingapplications']),publicationNegative=new Set(['closed','isclosed','expired','isexpired','archived','isarchived','disabled','isdisabled','removed','isremoved','deleted','isdeleted'])
const postedKeys=new Set(['dateposted','postingdate','posteddate','publishedat','publicationdate']),expiryKeys=new Set(['validthrough','closingdate','applicationdeadline','expirydate','expirationdate','lastdatetoapply'])
export function fieldsFacts(fields,{employers,at,dates={publications:[],expiries:[]}}){
 for(const [original,value]of Object.entries(fields)){const name=key(original),raw=typeof value==='string'?value.trim().toLowerCase():value
  if(publicationPositive.has(name))need(raw===true||raw==='true','native publication disabled: '+original)
  if(publicationNegative.has(name))need(raw===false||raw==='false','native publication unavailable: '+original)
  if(['status','jobstatus','postingstatus','publicationstatus','availability','availabilitystatus'].includes(name))need(typeof raw==='string'&&/^(?:open|active|published|available|approved|accepting applications)$/.test(raw),'native publication status unavailable: '+original)
  if(['employer','employername','company','companyname','legalemployer','hiringorganization'].includes(name)){const label=typeof value==='string'?value:value?.name;need(employers.includes(norm(label)),'native employer contradiction: '+original)}
  if(['country','countrycode','workcountry','jobcountry','addresscountry','workplacecountry'].includes(name)){const label=typeof value==='string'?value:value?.name;need(nativeCountryName(label)==='India','native workplace country contradiction: '+original)}
  if(['location','joblocation','worklocation','workplace','workplacelocation'].includes(name))need(countries(value).every(c=>c==='India'),'native whole workplace contradicts India: '+original)
  if((postedKeys.has(name)||expiryKeys.has(name))&&value!==null&&value!==''){const fact=dateFact(value),expiry=expiryKeys.has(name),now=Date.parse(at);need(Number.isFinite(now),'invalid observation clock');if(fact.unqualifiedTimeZone)need(expiry?fact.earliestPossible>=now:fact.latestPossible<=now,expiry?'native local expiry passed or time-zone ambiguous':'native local publication future or time-zone ambiguous');else need(expiry?(fact.exact?Date.parse(fact.iso)>=now:fact.calendarDate>=at.slice(0,10)):(fact.exact?Date.parse(fact.iso)<=now:fact.calendarDate<=at.slice(0,10)),expiry?'native role expired':'native publication date is in the future');dates[expiry?'expiries':'publications'].push({field:original,...fact})}
 }
 return dates
}
export function scopeFacts(d,root,{employers,at,additionalFields=[]}={}){
 const dates={publications:[],expiries:[]},nodes=d.nodes(()=>true,root);for(const n of nodes){fieldsFacts(n.attrs,{employers,at,dates});for(const property of(n.attrs.itemprop??'').split(/\s+/).filter(Boolean))fieldsFacts({[property]:n.attrs.content??d.text(n)},{employers,at,dates});if(n.attrs['data-cms-field'])fieldsFacts({[n.attrs['data-cms-field']]:d.text(n)},{employers,at,dates})}for(const fields of additionalFields)fieldsFacts(fields,{employers,at,dates})
 const lines=readNativeStatusTextBlocks(root);need(!findExplicitNativeClosure(lines),'own native role explicitly closed')
 for(const line of lines){const m=/^([^:]{1,40}):\s*(.+)$/.exec(norm(line));if(!m)continue;const label=key(m[1]),value=m[2];if(['location','joblocation','worklocation','workplace','workplacelocation'].includes(label)){need(countries(value).every(c=>'India'===c),'authored whole workplace contradicts India')}else if(['status','jobstatus','publicationstatus','postingstatus','availability','employer','company','companyname','legalemployer','hiringorganization','country','workcountry','jobcountry','workplacecountry',...postedKeys,...expiryKeys].includes(label))fieldsFacts({[label]:value},{employers,at,dates})}
 for(const values of Object.values(dates))values.sort((a,b)=>(a.iso??a.calendarDate).localeCompare(b.iso??b.calendarDate));return{dates,lines,text:d.text(root)}
}
export function schemaJobs(models){const out=[];let count=0;const walk=(v,depth=0)=>{need(depth<=32&&++count<20000,'native schema bound');if(!v||typeof v!=='object')return;if(Array.isArray(v)){v.forEach(x=>walk(x,depth+1));return}if([v['@type']].flat().includes('JobPosting'))out.push(v);if(v['@graph'])walk(v['@graph'],depth+1)};for(const m of models)walk(m);return out}
export const projectedDate=dates=>dates[0]?(dates[0].iso??dates[0].calendarDate):null
export function closeRole(opening,closing){
 need(isDeepStrictEqual(opening.sourceNativeIdentity,closing.sourceNativeIdentity),'closing native role/employer/workplace/application identity changed')
 need(isDeepStrictEqual(opening.sourceNativeUnknownModel,closing.sourceNativeUnknownModel),'closing native non-criteria business fields changed')
 const different=!isDeepStrictEqual(opening.sourceNativeCriteria,closing.sourceNativeCriteria),job={...opening,sourceNativeRoleClosingQualified:true,sourceNativeClosingRole:closing.sourceNativeRole,sourceNativeClosingCriteria:closing.sourceNativeCriteria,sourceNativeClosingDates:closing.sourceNativeDates}
 if(different){job.sourceNativeCriteriaAlternatives=[opening.sourceNativeCriteria,closing.sourceNativeCriteria];job.sourceCriteriaChangedDuringRead=true;job.sourceDetailComplete=false;job.sourceDetailStatus='partial'}
 const merged={publications:[...opening.sourceNativeDates.publications,...closing.sourceNativeDates.publications],expiries:[...opening.sourceNativeDates.expiries,...closing.sourceNativeDates.expiries]};for(const values of Object.values(merged))values.sort((a,b)=>(a.iso??a.calendarDate).localeCompare(b.iso??b.calendarDate));job.sourceNativeDates=merged;job.postingDate=projectedDate(merged.publications);job.closingDate=projectedDate(merged.expiries);return job
}
export function partialJob({source,company,id,title,url,application,location,criteria,identity,unknownModel={},role,dates,at,countryEvidence,employerEvidence}){return{source,company,jobId:id,requisitionId:null,title,sourceUrl:url,applyUrl:application,link:application,country:'India',location,city:null,state:null,sourceDescription:criteria.text,jobDescription:criteria.text,postingDate:projectedDate(dates.publications),closingDate:projectedDate(dates.expiries),sourceNativeDates:dates,sourceNativeIdentity:identity,sourceNativeUnknownModel:unknownModel,sourceNativeCriteria:criteria,sourceNativeRole:role,sourceCountryEvidence:countryEvidence,sourceNativeEmployerProof:employerEvidence,sourceDetailComplete:false,sourceDetailStatus:'partial',sourceDetailFailureKind:'current-own-published-record;full-renderer-authentication-application-controls-and-backend-unverified',sourceClosingQualified:true,sourceNativeRoleClosingQualified:false,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,backendApplicationActivationVerified:false,applicationSubmitted:false,scrapedAt:at}}
