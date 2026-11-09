import{createHash}from'node:crypto'
import{nativeCountryName}from'../../scraper-support/shared/nativeJobPosting.js'
import{validatePublicPostingScope}from'../../scraper-support/utils/publishingGapAts.js'

export const SIGMA_OFFICES_URL='https://boards-api.greenhouse.io/v1/boards/sigmacomputing/offices'
const clean=value=>typeof value==='string'?value.replace(/\s+/g,' ').trim():''
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):value
const signature=value=>createHash('sha256').update(JSON.stringify(stable(value))).digest('hex')
const plain=value=>value&&typeof value==='object'&&!Array.isArray(value)
const requireOffice=ok=>{if(!ok)throw Object.assign(Error('Sigma native office directory is malformed or ambiguous'),{failureKind:'parser_or_contract_error',abortRetries:true})}
const identity=(row,id)=>{
 if(row?.id!==id||typeof row.title!=='string')return false
 try{const url=new URL(row.absolute_url);return url.protocol==='https:'&&!url.username&&!url.password&&!url.search&&!url.hash&&['boards.greenhouse.io','job-boards.greenhouse.io'].includes(url.hostname)&&url.pathname===`/sigmacomputing/jobs/${id}`}catch{return false}
}
const provider={source:'sigmacomputing',boardToken:'sigmacomputing',atsPlatform:'greenhouse'}

// This projection is for the existing mapper only. Original role payloads and
// all original location alternatives remain separate, unmodified evidence.
// Neither office/HQ country alone nor a city dictionary can qualify a role.
export function projectSigmaWorksiteCountries(records,directory){
 requireOffice(Array.isArray(records)&&plain(directory)&&Object.keys(directory).length===1&&Array.isArray(directory.offices)&&directory.offices.length<=100)
 const master=new Map(),advertised=new Map(),proofs=[]
 for(const office of directory.offices){
  requireOffice(plain(office)&&Object.keys(office).every(k=>['id','name','location','parent_id','child_ids','departments'].includes(k))&&Number.isSafeInteger(office.id)&&office.id>=0&&!master.has(office.id)&&typeof office.name==='string'&&Array.isArray(office.child_ids)&&Array.isArray(office.departments))
  master.set(office.id,office)
  for(const department of office.departments){requireOffice(plain(department)&&Array.isArray(department.jobs));for(const job of department.jobs)if(identity(job,job.id))advertised.set(String(job.id),{jobId:String(job.id),url:job.absolute_url,title:job.title})}
 }
 const projected=records.map(record=>{
  const original=clean(record.location?.name),parts=original.split(',').map(clean)
  if(!identity(record,record.id)||!original||parts.length>2||/\b(?:remote|hybrid|global|worldwide|anywhere|and|or)\b|[\/;|]/i.test(original)||!Array.isArray(record.offices))return record
  try{if(!validatePublicPostingScope([record],'greenhouse',provider).length)return record}catch{return record}
  const candidates=[]
  for(const office of record.offices){
   const current=master.get(office?.id),address=clean(office?.location),elements=address.split(',').map(clean)
   if(!current||!office.id||elements.length<3||elements[0].toLowerCase()!==parts[0].toLowerCase()||current.name!==office.name||current.location!==office.location||signature(current.child_ids)!==signature(office.child_ids)||(current.parent_id??null)!==(office.parent_id??null))continue
   const country=nativeCountryName(elements.at(-1));if(!country)continue
   const explicit=parts[1]?.length>3?nativeCountryName(parts[1]):null;if(explicit&&explicit!==country)continue
   const members=current.departments.flatMap(d=>d.jobs).filter(j=>identity(j,record.id)&&j.title===record.title&&clean(j.location?.name)===original)
   if(!members.length)continue
   candidates.push({office,current,country,members})
  }
  if(candidates.length!==1)return record
  const {office,current,country,members}=candidates[0],result={...record,location:{...record.location,name:office.location}}
  try{validatePublicPostingScope([result],'greenhouse',provider)}catch{return record}
  const proof={jobId:String(record.id),officeId:office.id,officeName:office.name,country,originalPrimaryLocation:record.location.name,nativeWorksiteLocation:office.location,sourceURL:SIGMA_OFFICES_URL,method:'same-role-native-office-id-address-city-and-directory-membership',primaryWorksiteOnly:true,originalRecordSHA256:signature(record),officeDefinitionSHA256:signature({id:current.id,name:current.name,location:current.location,parent_id:current.parent_id,child_ids:current.child_ids}),roleMembershipSHA256:signature(members.map(j=>({id:j.id,title:j.title,url:j.absolute_url,location:j.location})))}
  proof.bindingSHA256=signature({jobId:proof.jobId,officeId:proof.officeId,country,originalPrimaryLocation:proof.originalPrimaryLocation,nativeWorksiteLocation:proof.nativeWorksiteLocation,officeDefinitionSHA256:proof.officeDefinitionSHA256,roleMembershipSHA256:proof.roleMembershipSHA256})
  proofs.push(proof);return result
 })
 const ids=new Set(records.map(r=>String(r.id)))
 return{records:projected,proofs,directoryAdvertisedRoles:[...advertised.values()],unreconciledDirectoryRoleIds:[...advertised.keys()].filter(id=>!ids.has(id)),directoryCanonicalSHA256:signature(directory)}
}
