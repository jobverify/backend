import {extractOfficialRecruitmentLinks} from '../../scripts/officialRecruitmentLinks.js'
import {readNativeDocument,extractActiveDescription,decodeNativeHtml} from './nativeHtml.js'
export const CORPORATE='https://www.castrol.com/en_in/india/home/about-castrol/careers.html',BOARD='https://job-boards.eu.greenhouse.io/castrol',API='https://boards-api.greenhouse.io/v1/boards/castrol/jobs?content=true'
const check=(ok,message)=>{if(!ok)throw new Error('Castrol native contract: '+message)},norm=x=>typeof x==='string'?x.replace(/\s+/g,' ').trim():'',object=x=>x&&typeof x==='object'&&!Array.isArray(x),id=x=>typeof x==='number'&&Number.isSafeInteger(x)&&x>0
const names=new Intl.DisplayNames(['en'],{type:'region',fallback:'none'}),countries=new Map()
for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){const code=String.fromCharCode(a,b),name=names.of(code);if(name&&!['ZZ','XA','XB','UN','EU','EZ','QO'].includes(code)){const canonical=new Intl.Locale('und-'+code).region;countries.set(name.toLowerCase(),canonical);countries.set(code.toLowerCase(),canonical)}}
for(const[name,code]of [['United States of America','US'],['UK','GB'],['USA','US'],['Turkey','TR']])countries.set(name.toLowerCase(),code)
const country=x=>typeof x==='string'?countries.get(norm(x).toLowerCase())||null:null
const title=x=>typeof x==='string'&&norm(x).length>2&&!/[<>]|&(?:lt|gt);/i.test(x)
function nativeCountryFields(value,expected){for(const[k,v]of Object.entries(value))if(['country','countrycode','country_code','addresscountry'].includes(k.toLowerCase())&&v!=null)check(typeof v==='string'&&country(v)&&expected.includes(country(v)),'Explicit native country contradiction')}
function fullDescription(value){const text=extractActiveDescription(value);if(!text)return null;const rest=text.replace(/\b(?:job\s+description\s+sample|sample\s+(?:job\s+)?description|sample|test\s+description|job\s+description|apply\s+now|read\s+more|coming\s+soon)\b/gi,'');return /[\p{L}\p{N}]/u.test(rest)?text:null}
function failureEnvelope(p){check(object(p),'Malformed native object');for(const[k,v]of Object.entries(p)){if(['error','errors'].includes(k.toLowerCase())&&v!=null)check(v===''||Array.isArray(v)&&v.length===0,'Native error envelope');if(['status','statuscode'].includes(k.toLowerCase())&&v!=null)check(v===200,'Native failure status');if(['success','ok'].includes(k.toLowerCase())&&v!=null)check(v===true,'Native failure flag')}}
function iso(value,now,publication=false){
 check(typeof value==='string','Native date type invalid');const m=value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/);check(m,'Native date invalid')
 const[,year,month,day,hour,minute,second,,zone]=m,y=Number(year),mo=Number(month),d=Number(day);check(mo>=1&&mo<=12&&d>=1&&d<=new Date(Date.UTC(y,mo,0)).getUTCDate()&&Number(hour)<24&&Number(minute)<60&&Number(second)<60&&(zone==='Z'||Number(zone.slice(1,3))<=14&&Number(zone.slice(4))<60),'Native calendar invalid')
 const ms=Date.parse(value);check(Number.isFinite(ms)&&(!publication||ms<=Date.parse(now)),'Future/invalid native publication');return new Date(ms).toISOString()
}
function model(html,isJob){
 const doc=readNativeDocument(html),scripts=doc.nodes(n=>n.tag==='script'&&!n.attrs.src&&!Object.hasOwn(n.attrs,'nomodule')&&[undefined,'','text/javascript','application/javascript'].includes(n.attrs.type)&&n.raw?.includes('window.__remixContext'))
 check(scripts.length===1,'Native active model unavailable or ambiguous');const match=scripts[0].raw.match(/^\s*window\.__remixContext\s*=\s*([\s\S]+);\s*$/);check(match,'Native static model invalid');const data=JSON.parse(match[1]);failureEnvelope(data);failureEnvelope(data.state);check(data.state.errors===null,'Native loader error')
 const root=data.state.loaderData?.root;check(object(root)&&root.urlToken==='castrol'&&root.internal===false&&root.preview===false&&root.isJobPost===isJob,'Native public board identity mismatch')
 return{doc,loaders:data.state.loaderData}
}
export function parseCastrolBoard(corporate,html){
 check(extractOfficialRecruitmentLinks(corporate,CORPORATE).some(l=>l.href===BOARD),'Current official Castrol India handoff unavailable')
 return parseCastrolNativeBoard(html)
}
export function parseCastrolNativeBoard(html){
 const{doc,loaders}=model(html,false),board=loaders['routes/$url_token'];check(object(board)&&board.urlToken==='castrol'&&board.board?.name==='Castrol'&&board.board.public_url===BOARD&&board.board.redirect_to===null,'Native board company mismatch')
 check(doc.nodes(n=>n.tag==='h1').some(n=>doc.text(n)==='Current positions at Castrol'),'Visible native board identity unavailable')
 for(const key of ['departmentIds','officeIds'])check(Array.isArray(board[key])&&board[key].length===0,'Native board is filtered')
 check(object(board.customFieldFilters)&&Object.keys(board.customFieldFilters).length===0,'Native board custom filters changed')
 const posts=board.jobPosts;check(object(posts)&&Array.isArray(posts.data)&&Number.isSafeInteger(posts.total)&&posts.total>=0&&posts.total<=1000&&posts.page===1&&posts.count===posts.data.length&&posts.total_pages===Math.max(1,Math.ceil(posts.total/50))&&posts.data.length===Math.min(posts.total,50),'Native public board pagination metadata invalid')
 const officeMap=new Map();check(Array.isArray(board.offices),'Native office hierarchy unavailable')
 function walk(nodes,parentId=null,parentCountry=null){for(const n of nodes){check(object(n)&&id(n.id)&&n.value===n.id&&typeof n.name==='string'&&n.label===n.name&&Array.isArray(n.children)&&!officeMap.has(n.id),'Native office hierarchy malformed');const scope=country(n.name)||parentCountry;officeMap.set(n.id,{id:n.id,name:n.name,parentId,country:scope});if(n.children.length)walk(n.children,n.id,scope);else check(scope,'Unknown native office country')}}walk(board.offices)
 return{posts,officeMap}
}
function geography(raw,officeMap){
 check(object(raw.location)&&typeof raw.location.name==='string'&&norm(raw.location.name),'Native location unavailable');check(Array.isArray(raw.offices)&&raw.offices.length>0,'Native office evidence missing')
 const offices=raw.offices.map(o=>{const current=officeMap.get(o?.id);check(object(o)&&id(o.id)&&current&&o.name===current.name&&o.parent_id===current.parentId,'Native office identity mismatch');nativeCountryFields(o,[current.country]);if(o.location!=null){check(typeof o.location==='string'&&norm(o.location),'Malformed native office location');check(current.country&&country(o.location.split(',').at(-1))===current.country,'Native office country contradiction')}return{...o,country:current.country}})
 const parts=raw.location.name.split(';').map(norm);check(parts.every(Boolean),'Empty native location segment');const scopes=parts.map(label=>{const match=label.match(/^(.+?)\s+-\s+(.+)$/),code=match?country(match[1]):null;return{label,country:code,place:match?norm(match[2]):null}})
 nativeCountryFields(raw,scopes.map(s=>s.country).filter(Boolean));nativeCountryFields(raw.location,scopes.map(s=>s.country).filter(Boolean))
 for(const scope of scopes){if(!scope.country)continue;const tailCountries=scope.place.split(/,|\s+-\s+/).map(country).filter(Boolean);check(tailCountries.every(c=>c===scope.country),'Contradictory native location country labels')}
 const unresolved=scopes.filter(s=>!s.country);if(!unresolved.length)check(offices.every(o=>!o.country||scopes.some(s=>s.country===o.country)),'Native primary office/country contradiction')
 const india=scopes.filter(s=>s.country==='IN'),locations=india.map(s=>{const matched=offices.find(o=>o.country==='IN'&&o.location&&(norm(o.name)===s.place||o.location.split(',')[0].trim()===s.place));return matched?.location||s.place+', India'})
 // An India label is positive native scope even when a multi-country opening's
 // administrative office is abroad. Keep both original fields and the gap.
 return{nativeLocation:raw.location.name,nativeOffices:offices,location:locations.join(' / '),locations,city:locations.length===1?locations[0].split(',')[0].trim():null,scopeComplete:unresolved.length===0&&offices.every(o=>o.country),unresolvedLocations:[...unresolved.map(s=>s.label),...offices.filter(o=>!o.country).map(o=>'native-office-region:'+o.name)],india:india.length>0}
}
export function validateCastrolInventory(payload,board,{now=new Date().toISOString()}={}){
 failureEnvelope(payload);failureEnvelope(payload.meta);check(Array.isArray(payload.jobs)&&Number.isSafeInteger(payload.meta?.total)&&payload.meta.total===payload.jobs.length&&payload.jobs.length===board.posts.total,'Native full API/board totals disagree');check(Number.isFinite(Date.parse(now)),'Invalid observation time')
 const seen=new Set(),rows=payload.jobs.map(raw=>{failureEnvelope(raw);check(id(raw.id)&&!seen.has(raw.id)&&id(raw.internal_job_id),'Duplicate or malformed native job ID');seen.add(raw.id);check(title(raw.title)&&raw.company_name==='Castrol'&&raw.absolute_url===BOARD+'/jobs/'+raw.id,'Native role company/title/URL mismatch');check(typeof raw.content==='string','Native content type invalid');const geo=geography(raw,board.officeMap),postedAt=iso(raw.first_published,now,true),closingDate=raw.application_deadline==null?null:iso(raw.application_deadline,now);check(closingDate==null||Date.parse(closingDate)>=Date.parse(postedAt),'Native expiry before publication');return{raw,...geo,postedAt,closingDate}})
 check(new Set(board.posts.data.map(j=>j.id)).size===board.posts.data.length,'Duplicate visible board ID')
 for(const item of board.posts.data){const row=rows.find(r=>r.raw.id===item.id);check(row&&row.raw.title===item.title&&row.raw.location.name===item.location&&row.raw.absolute_url===item.absolute_url,'Native visible board/API role mismatch')}
 // An explicit own India alternative proves configured inclusion even when
 // another alternative remains unresolved. A negative row needs every native
 // alternative and office to explicitly exclude India.
 for(const row of rows)row.configuredCountryMembershipComplete=row.india||row.scopeComplete
 return{rows,india:rows.filter(r=>r.india),scopeComplete:rows.every(r=>r.scopeComplete),configuredCountryMembershipComplete:rows.every(r=>r.configuredCountryMembershipComplete)}
}
export function validateCastrolDetail(html,row,{now=new Date().toISOString()}={}){
 const{doc,loaders}=model(html,true),r=loaders['routes/$url_token_.jobs_.$job_post_id'],raw=row.raw;failureEnvelope(r);const p=r.jobPost;failureEnvelope(p)
 check(r.jobPostId===String(raw.id)&&r.urlToken==='castrol'&&r.submitPath==='https://boards.eu.greenhouse.io/castrol/jobs/'+raw.id,'Native application identity mismatch')
 check(p.post_type==='job_post'&&p.title===raw.title&&p.company_name==='Castrol'&&p.public_url===raw.absolute_url&&p.hiring_plan_id===raw.internal_job_id&&p.job_post_location===raw.location.name&&p.redirect_to===null,'Native full detail identity mismatch')
 check(iso(p.published_at,now,true)===row.postedAt&&p.application_deadline===raw.application_deadline,'Native detail/publication/expiry mismatch')
 const h1=doc.nodes(n=>n.tag==='h1');check(h1.length===1&&doc.text(h1[0])===norm(raw.title),'Native visible title mismatch');const form=doc.nodes(n=>n.attrs.id==='application-form');check(form.length===1&&form[0].tag==='form'&&new URL(form[0].attrs.action,raw.absolute_url).href===raw.absolute_url,'Native visible application role mismatch')
 check(typeof p.content==='string','Native full role content unavailable')
 const description=fullDescription(p.content),apiDescription=fullDescription(decodeNativeHtml(decodeNativeHtml(raw.content)))
 check(!description||apiDescription?.includes(description),'Native API/detail full content disagreement')
 // A missing/hidden role field remains incomplete. API company introduction
 // and conclusion are never used as replacement role content.
 return{jobId:String(raw.id),title:norm(raw.title),location:row.location,locations:row.locations,city:row.city,country:'India',sourceUrl:raw.absolute_url,applyUrl:raw.absolute_url,link:raw.absolute_url,nativeLocation:row.nativeLocation,nativeOffices:row.nativeOffices,nativeUnresolvedLocations:row.unresolvedLocations,nativeEmployer:raw.company_name,nativeInternalJobId:raw.internal_job_id,postedAt:row.postedAt,postingDate:row.postedAt,closingDate:row.closingDate,sourceClosingDateIsExact:row.closingDate!=null,jobDescription:description,sourceDescription:description,nativeRoleCriteriaHtml:p.content,sourceDetailComplete:Boolean(description),sourceDetailStatus:description?'complete':'native-full-description-missing',sourceScopeComplete:row.scopeComplete,sourceListingComplete:false,scrapedAt:now}
}
