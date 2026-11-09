import {extractActiveDescription} from './nativeContent.js'
const ORG='3e818601-0baa-429c-b6f8-4b21903ae0e6'
const fail=message=>{throw new Error('Navi native contract: '+message)}
const requireProof=(ok,message)=>{if(!ok)fail(message)}
const clean=value=>typeof value==='string'?value.replace(/\s+/g,' ').trim():''
const guid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const names=new Intl.DisplayNames(['en'],{type:'region'})
const codes='AE AR AT AU BD BE BG BH BR CA CH CL CN CO CZ DE DK EG ES FI FR GB GR HK HU ID IE IL IN IT JP KE KR LK LT LU LV MA MX MY NG NL NO NP NZ OM PE PH PK PL PT QA RO RS RU SA SE SG SK TH TR TW UA US VN ZA'.split(' ')
const countryCodes=new Map(codes.flatMap(code=>[[code.toLowerCase(),code],[names.of(code).toLowerCase(),code]]))
countryCodes.set('hong kong','HK');countryCodes.set('turkey','TR')
const country=value=>countryCodes.get(clean(value).toLowerCase())
export function nativeLocationScope(value){
 requireProof(typeof value==='string','Location must be native JSON text')
 let locations;try{locations=JSON.parse(value)}catch{fail('Malformed native locations')}
 requireProof(Array.isArray(locations)&&locations.length>0,'Native locations unavailable')
 const mapped=locations.map(p=>{
  requireProof(p&&typeof p==='object'&&!Array.isArray(p)&&typeof p.Address==='string'&&clean(p.Address),'Native address missing')
  const address=clean(p.Address),parts=address.split(',').map(clean),code=country(parts.at(-1))
  requireProof(parts.length>=2&&code&&!/\b(?:global|worldwide|anywhere|distributed|unspecified)\b/i.test(address),'Unknown or unbounded native country scope')
  requireProof(parts.slice(0,-1).every(part=>!country(part)||country(part)===code),'Conflicting explicit native country segments')
  const city=parts.length>=3?parts.at(-3):parts[0],state=parts.length>=3?parts.at(-2):null
  for(const key of ['Country','CountryCode','country','countryCode'])if(p[key]!=null)requireProof(typeof p[key]==='string'&&country(p[key])===code,'Native country conflicts with full address')
  for(const key of ['City','city'])if(p[key]!=null)requireProof(typeof p[key]==='string'&&clean(p[key]).toLowerCase()===city.toLowerCase(),'Native city conflicts with full address')
  for(const key of ['State','state'])if(p[key]!=null)requireProof(typeof p[key]==='string'&&state&&clean(p[key]).toLowerCase()===state.toLowerCase(),'Native state conflicts with full address')
  return{address,city,state,countryCode:code}
 })
 return{locations:mapped,indiaLocations:mapped.filter(p=>p.countryCode==='IN')}
}
export function validateNativeDate(value,{now,publication=false}={}){
 if(value==null||value==='')return null
 requireProof(typeof value==='string','Native date must be a string')
 // The public feed also uses timezone-less midnight for calendar-only closing
 // dates. Preserve the stated day without inventing an exact UTC instant.
 if(!publication&&/^\d{4}-\d{2}-\d{2}T00:00:00$/.test(value)){
  const day=value.slice(0,10),time=Date.parse(day+'T00:00:00Z')
  requireProof(Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===day,'Impossible native closing calendar date');return day
 }
 const m=value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(?:\.(\d{1,7}))?Z$/)
 requireProof(m,'Native date lacks explicit UTC calendar contract')
 const milliseconds=(m[3]||'').padEnd(3,'0').slice(0,3),canonical=`${m[1]}T${m[2]}.${milliseconds}Z`,time=Date.parse(canonical)
 requireProof(Number.isFinite(time)&&new Date(time).toISOString()===canonical,'Impossible native calendar date')
 if(publication)requireProof(Number.isFinite(Date.parse(now))&&time<=Date.parse(now),'Native publication is future or check time invalid')
 return value
}
const checkError=payload=>{
 requireProof(payload&&typeof payload==='object'&&!Array.isArray(payload),'Native response malformed')
 for(const key of ['Error','Errors','error','errors','Exception','exception','Message','message','ErrorMessage','errorMessage'])if(payload[key]!=null&&payload[key]!==''&&!(Array.isArray(payload[key])&&payload[key].length===0))fail('Upstream error envelope')
 for(const key of ['Success','success'])if(payload[key]!=null)requireProof(payload[key]===true,'Upstream failure')
 for(const key of ['StatusCode','statusCode','Status','status','Code','code'])if(payload[key]!=null)requireProof(payload[key]===200,'Upstream status failure')
}
const validateIdentity=row=>{
 requireProof(row&&typeof row==='object'&&!Array.isArray(row),'Native role malformed')
 requireProof(typeof row.JobId==='string'&&guid.test(row.JobId),'Native GUID missing')
 requireProof(typeof row.JobIdObfuscated==='string'&&/^[A-Za-z0-9_%+-]{30,400}$/.test(row.JobIdObfuscated),'Native public application identity missing')
 let decoded;try{decoded=decodeURIComponent(row.JobIdObfuscated)}catch{fail('Malformed native public ID encoding')}
 requireProof(/^[A-Za-z0-9_+/-]{30,300}$/.test(decoded),'Unsafe native public ID')
 requireProof(typeof row.JobTitle==='string'&&clean(row.JobTitle)&&typeof row.JobCode==='string'&&clean(row.JobCode),'Native title/code missing')
 requireProof(row.OrgDetails?.OrgID===ORG,'Wrong native employer')
 if(row.OrgDetails.OrgName!=null)requireProof(['NAVI TECHNOLOGIES LIMITED','Navi','Navi Limited'].includes(row.OrgDetails.OrgName),'Native employer name conflict')
 return nativeLocationScope(row.Location)
}
export function validateNativeInventory(payload,{now=new Date().toISOString()}={}){
 checkError(payload)
 requireProof(Number.isSafeInteger(payload.Total)&&payload.Total>=0&&payload.Total<=10000&&Array.isArray(payload.Result),'Native total/results unavailable')
 requireProof(payload.Result.length===payload.Total,'Native total differs from returned full-list count; no guessed pagination')
 const seen=new Set(),publicIds=new Set(),rows=payload.Result.map(row=>{
  const scope=validateIdentity(row),nativeId=row.JobId.toLowerCase(),publicId=decodeURIComponent(row.JobIdObfuscated)
  requireProof(!seen.has(nativeId)&&!publicIds.has(publicId),'Duplicate native identities');seen.add(nativeId);publicIds.add(publicId)
  validateNativeDate(row.PublishedDate,{now,publication:true});validateNativeDate(row.ExpiryDates?.CAREERPAGE,{now})
  return{record:row,scope}
 })
 return{total:payload.Total,rows,snapshot:JSON.stringify(payload.Result.map(r=>Object.fromEntries(['JobId','JobIdObfuscated','JobCode','JobTitle','OrgDetails','Location','PublishedDate','ExpiryDates','JobDescV2'].map(k=>[k,r[k]??null]))))}
}
export function validateNativeDetail(detail,listing,{now=new Date().toISOString()}={}){
 checkError(detail);const scope=validateIdentity(detail)
 for(const key of ['JobId','JobIdObfuscated','JobCode','JobTitle'])requireProof(detail[key]===listing[key],'Native detail '+key+' conflicts')
 requireProof(JSON.stringify(scope)===JSON.stringify(nativeLocationScope(listing.Location)),'Native detail location conflicts')
 requireProof(detail.IsPublic===true&&detail.IsDraft===false&&detail.JobStatus==='Active'&&Array.isArray(detail.PublishedJobBoards)&&detail.PublishedJobBoards.includes('CAREERPAGE'),'Native detail is not an active public career role')
 requireProof((detail.PublishedDates?.CAREERPAGE??null)===(listing.PublishedDate??null),'Native CareerPage publication conflicts')
 const postingDate=validateNativeDate(detail.PublishedDates?.CAREERPAGE,{now,publication:true}),closingDate=validateNativeDate(detail.ExpiryDates?.CAREERPAGE,{now})
 requireProof(typeof detail.JobDescriptionV2==='string','Native full description field unavailable')
 const sections=[detail.JobDescriptionV2]
 for(const key of ['RolesAndResponsibilitiesV2','EligibilityV2'])if(detail[key]!=null){requireProof(typeof detail[key]==='string','Native description section malformed');sections.push(detail[key])}
 const jobDescription=sections.map(extractActiveDescription).filter(Boolean).join('\n\n')||null
 let attachment=null
 if(detail.JobDescriptionBlobUrl!=null&&detail.JobDescriptionBlobUrl!==''){
  requireProof(typeof detail.JobDescriptionBlobUrl==='string','Native attachment URL malformed');const u=new URL(detail.JobDescriptionBlobUrl)
  const observedPath=/^\/attachments\/[0-9a-f-]{36}\/.+\.(?:docx|pdf)$/i.test(u.pathname)||new RegExp(`^/resumebank/${detail.JobId}/JobDescription/[^/]+\\.(?:docx|pdf)$`,'i').test(u.pathname)
  requireProof(u.origin==='https://hiringsolutions.blob.core.windows.net'&&!u.search&&!u.hash&&!u.username&&!u.password&&observedPath,'Unexpected native attachment surface');attachment=u.href
 }
 return{jobDescription,postingDate,closingDate,sourceNativeClosingDate:detail.ExpiryDates?.CAREERPAGE??null,sourceClosingDateIsExact:Boolean(closingDate?.endsWith('Z')),sourceDetailComplete:Boolean(jobDescription),sourceDetailStatus:jobDescription?'complete':attachment?'attachment-unavailable':'missing-content',sourceDescriptionAttachment:attachment,scope,nativeDetail:detail}
}
