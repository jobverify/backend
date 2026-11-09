// These qualifications describe native declarations, not rendered criteria,
// application availability or complete company inventory. Raw values survive.
const own=(v,k)=>v!==null&&typeof v==='object'&&Object.hasOwn(v,k)
const geoKey=/location|country|countries|office|address|region|geograph|latitude|longitude|postal|territor|continent|workplace|worksite|^city$|^state$|^geo$/i
const hasValue=v=>v!=null&&(Array.isArray(v)?v.some(hasValue):typeof v==='string'?!!v.trim():true)
const companyKeys=new Set(['hiring_organization','hiringOrganization'])
const applicantKeys=new Set(['questions','location_questions','compliance','data_compliance','demographic_questions'])
function unknownGeo(value,allowed=()=>false,path=[]){
 if(!value||typeof value!=='object')return false
 return Object.entries(value).some(([key,v])=>geoKey.test(key)&&hasValue(v)&&!allowed([...path,key],v)||unknownGeo(v,allowed,[...path,key]))
}
export function hasUnhandledNestedWorkplace(record){
 const workplace=Object.fromEntries(Object.entries(record).filter(([key])=>!companyKeys.has(key)&&!applicantKeys.has(key)))
 return unknownGeo(workplace,path=>path.length===1&&['location','offices'].includes(path[0])||path.length===3&&path[0]==='offices'&&/^\d+$/.test(path[1])&&path[2]==='location')
}
const types=v=>[v?.['@type']].flat().filter(v=>typeof v==='string').map(v=>v.replace(/^https?:\/\/schema.org\//,''))
const objects=v=>!v||typeof v!=='object'?[]:[...(Array.isArray(v)?[]:[v]),...Object.values(v).flatMap(objects)]
const norm=v=>String(v??'').replace(/\s+/g,' ').trim()
const strings=v=>v==null?[]:Array.isArray(v)?v.flatMap(strings):typeof v==='string'||typeof v==='number'?[String(v)]:strings(v.value??v['@id'])
const countryLabel=v=>/^(?:IN|IND|India)$/i.test(v)?'India':v
function postingGeography(posting){
 const labels=[];let unhandled=false
 const country=value=>{
  if(Array.isArray(value)){if(!value.length)unhandled=true;for(const v of value)country(v)}
  else if(typeof value==='string'&&value.trim())labels.push(countryLabel(value.trim()))
  else if(value&&typeof value==='object'&&typeof value.name==='string'&&value.name.trim()){labels.push(countryLabel(value.name.trim()));if(unknownGeo(value,path=>path.length===1&&path[0]==='name'))unhandled=true}
  else unhandled=true
 }
 const place=value=>{
  if(Array.isArray(value)){if(!value.length)unhandled=true;for(const v of value)place(v);return}
  if(!value||typeof value!=='object'){unhandled=true;return}
  const address=value.address
  if(!address||typeof address!=='object'||Array.isArray(address)){unhandled=true;return}
  if(own(address,'addressCountry'))country(address.addressCountry);else unhandled=true
  if(unknownGeo(value,path=>path.length===1&&path[0]==='address'||path.length===2&&path[0]==='address'&&['addressCountry','addressLocality','addressRegion','streetAddress','postalCode'].includes(path[1])))unhandled=true
 }
 if(own(posting,'jobLocation'))place(posting.jobLocation)
 if(own(posting,'applicantLocationRequirements'))country(posting.applicantLocationRequirements)
 if(own(posting,'jobLocationType')&&posting.jobLocationType!=='TELECOMMUTE')unhandled=true
 const other=Object.fromEntries(Object.entries(posting).filter(([key])=>!companyKeys.has(key)&&!['jobLocation','applicantLocationRequirements','jobLocationType'].includes(key)))
 if(unknownGeo(other))unhandled=true
 return{labels,unhandledGeography:unhandled}
}
export function rolePostingEvidence(role,record){
 const documents=[],malformedDeclarations=[],boundPostings=[],unresolvedPostings=[],unrelatedPostings=[]
 for(const[declarationIndex,s]of (role?.jsonLDDeclarations??[]).entries())try{documents.push({declarationIndex,value:JSON.parse(s.children.join(''))})}catch{malformedDeclarations.push(declarationIndex)}
 for(const {value}of documents)for(const posting of objects(value).filter(v=>types(v).includes('JobPosting'))){
  const ids=strings(posting.identifier),urls=strings(posting.url??posting.mainEntityOfPage).map(v=>{try{return new URL(v,role.canonicalURL).href}catch{return v}}),idMatch=ids.includes(String(record.id)),urlMatch=urls.includes(role.canonicalURL)||urls.includes(record.absolute_url),titleMatch=norm(posting.title)===norm(record.title)
  const conflictingId=ids.some(v=>v!==String(record.id)),conflictingURL=urls.some(v=>![role.canonicalURL,record.absolute_url].includes(v))
  if(titleMatch&&(idMatch||urlMatch)&&!conflictingId&&!conflictingURL)boundPostings.push(posting)
  else if(ids.length&&urls.length&&!idMatch&&!urlMatch&&!titleMatch)unrelatedPostings.push(posting)
  else unresolvedPostings.push(posting)
 }
 const geography=boundPostings.map(postingGeography)
 return{documents,malformedDeclarations,boundPostings,unresolvedPostings,unrelatedPostings,labels:geography.flatMap(v=>v.labels),unhandledGeography:malformedDeclarations.length>0||unresolvedPostings.length>0||geography.some(v=>v.unhandledGeography),publisherProgramsExecuted:false}
}
function dateValue(raw,deadline=false){
 if(typeof raw!=='string'||!/^\d{4}-\d\d-\d\d(?:T\d\d:\d\d:\d\d(?:\.\d{1,9})?(?:Z|[+-]\d\d:\d\d))?$/.test(raw))return null
 const [year,month,day]=raw.slice(0,10).split('-').map(Number),check=new Date(0);check.setUTCFullYear(year,month-1,day);check.setUTCHours(0,0,0,0)
 if(year<1||check.getUTCFullYear()!==year||check.getUTCMonth()!==month-1||check.getUTCDate()!==day)return null
 const time=Date.parse(raw);return Number.isFinite(time)?time+(deadline&&raw.length===10?86400000-1:0):null
}
export function calendarEvidence(record,detail,at,boundPostings=[]){
 const declarations=[]
 const add=(source,value,key,kind)=>{if(own(value,key)&&value[key]!==null)declarations.push({source,field:key,kind,raw:value[key],time:dateValue(value[key],kind==='deadline')})}
 for(const[source,value]of [['inventory',record],['detail',detail]]){add(source,value,'first_published','publication');add(source,value,'application_deadline','deadline')}
 boundPostings.forEach((v,i)=>{add('role-JobPosting-'+i,v,'datePosted','publication');add('role-JobPosting-'+i,v,'validThrough','deadline')})
 const publications=declarations.filter(v=>v.kind==='publication'),deadlines=declarations.filter(v=>v.kind==='deadline'),issues=[]
 if(!publications.length)issues.push('native-publication-absent')
 if(declarations.some(v=>v.time===null))issues.push('invalid-native-calendar')
 if(publications.some(v=>v.time!==null&&v.time>at))issues.push('future-native-publication')
 if(deadlines.some(v=>v.time!==null&&v.time<=at))issues.push('expired-native-deadline')
 if(publications.some(p=>deadlines.some(d=>p.time!==null&&d.time!==null&&d.time<p.time)))issues.push('impossible-native-calendar-interval')
 for(const kind of ['publication','deadline'])if(new Set(declarations.filter(v=>v.kind===kind&&v.time!==null).map(v=>v.time)).size>1)issues.push('conflicting-native-'+kind)
 return{declarations,issues,activePublicationQualified:issues.length===0,firstEverPublicationQualified:false,observationTime:new Date(at).toISOString()}
}
