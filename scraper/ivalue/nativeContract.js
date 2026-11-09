import {extractActiveDescription,activeHead} from './nativeContent.js'
const ORIGIN='https://ivgroup.greythr.com'
const requireProof=(ok,message)=>{if(!ok)throw new Error('iValue native contract: '+message)}
const norm=value=>typeof value==='string'?value.replace(/\s+/g,' ').trim():''
const INDIA=new Set(['Mumbai','Delhi','Chennai','Bangalore','Hyderabad','Pune','New Delhi','Kolkata','Ahmedabad','Kochi','Telangana','Kerala','Coimbatore','Jaipur','Bhopal','Nashik','Lucknow'])
const FOREIGN=Object.freeze({UAE:'AE',Dubai:'AE',Singapore:'SG',Bangladesh:'BD',Cambodia:'KH',Srilanka:'LK',Nepal:'NP',Kenya:'KE',Vietnam:'VN',Philippines:'PH',Thailand:'TH',Malaysia:'MY'})
const guid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function nativeEnvelope(payload){
 requireProof(payload&&typeof payload==='object'&&!Array.isArray(payload),'Native response malformed')
 for(const key of ['error','Error','errors','Errors','message','Message','exception','Exception'])if(payload[key]!=null&&payload[key]!==''&&!(Array.isArray(payload[key])&&!payload[key].length))requireProof(false,'Upstream error envelope')
 for(const key of ['success','Success'])if(payload[key]!=null)requireProof(payload[key]===true,'Upstream failure')
 for(const key of ['code','Code','status','Status','statusCode','StatusCode'])if(payload[key]!=null)requireProof(payload[key]===200,'Upstream status failure')
}
export function validateCompany(payload){
 nativeEnvelope(payload)
 requireProof(payload.company_name==='iValue Group'&&payload.other_details?.website==='https://ivaluegroup.com/'&&payload.other_details?.social?.in==='https://www.linkedin.com/company/ivalue-group/','Current native company identity changed')
 return true
}
export function validateBoard(html){
 const head=activeHead(html)
 requireProof(head.titles.length===1&&head.titles[0]==='Jobs at iValue Group','Native board title mismatch')
 const url=head.metas.filter(m=>m.property==='og:url')
 requireProof(url.length===1&&['https://ivgroup.greythr.com/hire/jobs/','https://ivgroup.greythr.com/hire/jobs'].includes(url[0].content),'Native board canonical identity mismatch')
 return true
}
export function resolveNativeLocations(job,categories){
 nativeEnvelope(categories)
 const category=categories.cat_extfield?.location,values=categories.value
 requireProof(typeof category==='string'&&/^\d+$/.test(category)&&values&&typeof values==='object'&&!Array.isArray(values),'Native category catalog missing')
 requireProof(Array.isArray(job.locations)&&job.locations.length>0,'Native role locations unavailable')
 const seen=new Set(),locations=job.locations.map(id=>{
  requireProof(typeof id==='string'&&/^\d+$/.test(id)&&!seen.has(id),'Malformed or duplicate native location ID');seen.add(id)
  const item=values[id];requireProof(item?.cat_id===category&&typeof item.name==='string','Unknown native location category')
  const name=norm(item.name);requireProof(INDIA.has(name)||Object.hasOwn(FOREIGN,name),'Unreviewed native location; country cannot be guessed')
  return{id,name,countryCode:INDIA.has(name)?'IN':FOREIGN[name]}
 })
 for(const key of ['country','country_code','countryCode'])if(job[key]!=null)requireProof(typeof job[key]==='string'&&locations.every(l=>[l.countryCode,l.countryCode==='IN'?'India':null].includes(job[key])),'Native country conflicts with location category')
 return{locations,indiaLocations:locations.filter(l=>l.countryCode==='IN')}
}
export function nativeDate(value,{now,publication=false}={}){
 if(value==null||value==='')return null
 requireProof(typeof value==='string','Native date must be a string')
 const m=value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(?:\.(\d{1,7}))?Z$/)
 requireProof(m,'Unknown native date format')
 const canonical=`${m[1]}T${m[2]}.${(m[3]||'').padEnd(3,'0').slice(0,3)}Z`,time=Date.parse(canonical)
 requireProof(Number.isFinite(time)&&new Date(time).toISOString()===canonical,'Invalid native calendar date')
 if(publication)requireProof(Number.isFinite(Date.parse(now))&&time<=Date.parse(now),'Future native publication or invalid check time')
 return value
}
const identity=(job,categories,now)=>{
 requireProof(job&&typeof job==='object'&&!Array.isArray(job)&&typeof job.id==='string'&&guid.test(job.id),'Malformed native GUID')
 requireProof(typeof job.title==='string'&&norm(job.title)&&typeof job.slug==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(job.slug),'Native title or slug missing')
 requireProof(typeof job.req_id==='string'&&/^\d+$/.test(job.req_id),'Native requisition ID missing')
 requireProof(job.apply_url===`${ORIGIN}/hire/jobs/${job.slug}`,'Native apply identity or host mismatch')
 requireProof(typeof job.is_remote==='boolean'&&typeof job.description==='string','Native role fields malformed')
 const scope=resolveNativeLocations(job,categories)
 nativeDate(job.created_at,{now,publication:true});nativeDate(job.published_on_career_page,{now,publication:true})
 for(const key of ['closing_date','expires_at','expiry_date'])if(job[key]!=null)nativeDate(job[key],{now})
 return scope
}
export function validateIValueFeed(payload,categories,{now=new Date().toISOString()}={}){
 nativeEnvelope(payload);requireProof(Object.keys(payload).length===1&&Array.isArray(payload.data)&&payload.data.length<=10000,'Full-feed contract changed or pagination appeared')
 const ids=new Set(),groups=new Map(),rows=payload.data.map(record=>{
  const scope=identity(record,categories,now)
  requireProof(!ids.has(record.id.toLowerCase()),'Duplicate native role identities')
  ids.add(record.id.toLowerCase());const group=groups.get(record.apply_url)||[];group.push(record.id);groups.set(record.apply_url,group);return{record,scope}
 })
 return{rows,total:rows.length,publicIdentityCollisions:[...groups].filter(([,ids])=>ids.length>1).map(([applyUrl,nativeIds])=>({applyUrl,nativeIds})),snapshot:JSON.stringify(rows.map(({record:r})=>Object.fromEntries(['id','title','slug','req_id','apply_url','locations','description','published_on_career_page','created_at','is_remote','closing_date','expires_at','expiry_date'].map(k=>[k,r[k]??null]))))}
}
export function validateIValueDetail(payload,listing,categories,{now=new Date().toISOString()}={}){
 nativeEnvelope(payload);requireProof(payload.job_status==='published','Native detail is not published')
 const record=payload.job,scope=identity(record,categories,now)
 for(const key of ['id','title','slug','req_id','apply_url','description','published_on_career_page','created_at','is_remote'])requireProof(record[key]===listing[key],'Native detail '+key+' does not match listing')
 for(const key of ['closing_date','expires_at','expiry_date'])requireProof(Object.hasOwn(record,key)===Object.hasOwn(listing,key)&&record[key]===listing[key],'Native detail '+key+' does not match listing')
 requireProof(JSON.stringify(record.locations)===JSON.stringify(listing.locations),'Native detail location IDs conflict')
 const description=extractActiveDescription(record.description),closingDate=nativeDate(record.closing_date??record.expires_at??record.expiry_date,{now})
 return{record,scope,description,sourceDetailComplete:Boolean(description),sourceDetailStatus:description?'complete':'missing-content',postingDate:nativeDate(record.published_on_career_page,{now,publication:true}),closingDate,sourceClosingDateIsExact:Boolean(closingDate)}
}
