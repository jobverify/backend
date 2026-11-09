import {createHash} from 'node:crypto'
import {validatePublicPostingScope} from '../../scraper-support/utils/publishingGapAts.js'
import {reconcileGreenhouseOfficeCountries} from '../../scraper-support/utils/greenhouseOfficeCountry.js'
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):value
const same=(a,b)=>JSON.stringify(stable(a))===JSON.stringify(stable(b))
const signature=value=>createHash('sha256').update(JSON.stringify(stable(value))).digest('hex')
const fail=message=>{throw Object.assign(Error('Sigma native detail '+message),{failureKind:'parser_or_contract_error',abortRetries:true})}
const plain=value=>value&&typeof value==='object'&&!Array.isArray(value)
const personalFields=new Set(['first_name','last_name','preferred_name','email','phone','resume','resume_text','cover_letter','cover_letter_text','location','longitude','latitude'])
const personalLabels=new Set(['LinkedIn Profile','Website','Point of Data Transfer'])
const extraFields=new Set(['compliance','demographic_questions','questions','location_questions'])
const abortable=async(operation,signal)=>{
 signal.throwIfAborted();let listener
 try{return await Promise.race([Promise.resolve().then(operation),new Promise((_,reject)=>{listener=()=>reject(signal.reason);signal.addEventListener('abort',listener,{once:true})})])}finally{signal.removeEventListener('abort',listener)}
}
export const sigmaNativeCountryIssues=records=>{
 const provider={source:'sigmacomputing',boardToken:'sigmacomputing',atsPlatform:'greenhouse'},officeCountryScope=reconcileGreenhouseOfficeCountries(records,provider)
 return records.flatMap(record=>{const reasons=validatePublicPostingScope([record],'greenhouse',provider,{officeCountryScope});return reasons.length?[{id:record.id,location:record.location,reasons}]:[]})
}
export const reviewSigmaNativeDetail=(originalBoardRecord,record)=>{
 const board=originalBoardRecord
 if(!plain(record)||record.id!==board.id||record.company_name!=='Sigma Computing'||record.title!==board.title||record.internal_job_id!==board.internal_job_id||record.absolute_url!==board.absolute_url)fail('employer or own role identity changed')
 const issues=[]
 for(const key of Object.keys(record))if(!Object.hasOwn(board,key)&&!extraFields.has(key))issues.push('unreviewed-native-detail-field:'+key)
 for(const key of ['content','first_published','requisition_id'])if(!same(board[key],record[key]))issues.push('board-detail-criteria-disagreement:'+key)
 if(record.location?.name!==board.location?.name)issues.push('board-detail-location-disagreement')
 if(!Array.isArray(record.offices)||!Array.isArray(board.offices)||!same(record.offices.map(o=>o.id).sort(),board.offices.map(o=>o.id).sort()))issues.push('board-detail-office-identity-disagreement')
 if(!Array.isArray(record.questions))issues.push('native-application-questions-unavailable')
 const jobOwnedQuestions=[]
 for(const question of Array.isArray(record.questions)?record.questions:[]){
  if(!plain(question)||typeof question.label!=='string'||typeof question.required!=='boolean'||!Array.isArray(question.fields)||!question.fields.length||question.fields.some(f=>!plain(f)||typeof f.name!=='string'||typeof f.type!=='string')){issues.push('unreviewed-native-question-shape');continue}
  if(personalLabels.has(question.label)||question.fields.every(f=>personalFields.has(f.name)))continue
  if(question.fields.some(f=>!/^question_\d+$/.test(f.name)&&!personalFields.has(f.name)))issues.push('unreviewed-native-question-field')
  jobOwnedQuestions.push(structuredClone(question))
 }
 const applicantLocationQuestionsReviewed=record.location_questions==null||Array.isArray(record.location_questions)&&record.location_questions.every(q=>plain(q)&&typeof q.required==='boolean'&&Array.isArray(q.fields)&&q.fields.length>0&&q.fields.every(f=>plain(f)&&['longitude','latitude','location'].includes(f.name)))
 if(!applicantLocationQuestionsReviewed)issues.push('unreviewed-native-applicant-location-question')
 const countryRecord=structuredClone(record)
 // These reviewed blank applicant form inputs are not worksite fields. The
 // complete original form stays in record; unknown location fields stay in
 // this projection and remain unresolved by the unchanged shared resolver.
 if(applicantLocationQuestionsReviewed)delete countryRecord.location_questions
 // Keep the original answer options and required-response flags. A question
 // never establishes the required answer, the work country or a qualification.
 const criteria=Object.fromEntries(Object.entries(record).filter(([key])=>key!=='updated_at'))
 return {originalBoardRecord:structuredClone(board),record:structuredClone(record),countryRecord,jobOwnedQuestions,issues,snapshot:signature(criteria)}
}
export const hydrateSigmaNativeDetails=async(records,{fetchJson,signal,requestTimeoutMs=15000}={})=>{
 if(records.length>120)fail('120-role detail cohort budget exceeded')
 const reviewed=new Map(),failures=[];let cursor=0,stopped=false,bytes=0
 const settled=await Promise.allSettled(Array.from({length:Math.min(4,records.length)},async()=>{
  try{while(!stopped&&cursor<records.length){
   signal.throwIfAborted();const row=records[cursor++],url=`https://boards-api.greenhouse.io/v1/boards/sigmacomputing/jobs/${row.id}?questions=true`
   let value
   try{const bounded=AbortSignal.any([signal,AbortSignal.timeout(requestTimeoutMs)]);value=await abortable(()=>fetchJson(url,{signal:bounded}),bounded);signal.throwIfAborted()}
   catch(error){signal.throwIfAborted();failures.push({id:row.id,url,reason:error.message});continue}
   const size=Buffer.byteLength(JSON.stringify(value));bytes+=size
   if(size>2*1024*1024||bytes>16*1024*1024)fail('public criteria response byte budget exceeded')
   reviewed.set(String(row.id),reviewSigmaNativeDetail(row,value))
  }}catch(error){stopped=true;throw error}
 }))
 signal.throwIfAborted();const rejected=settled.find(r=>r.status==='rejected');if(rejected)throw rejected.reason
 return {records:records.flatMap(row=>reviewed.has(String(row.id))?[reviewed.get(String(row.id))]:[]),byId:reviewed,failures}
}
