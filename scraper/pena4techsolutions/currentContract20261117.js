import {createHash} from 'node:crypto'
import {readNativeDocument,activeHead,activeIframeDeclarations} from '../../scraper-support/utils/activeNativeHtml.js'
export const SOURCE='pena4techsolutions',JOBS='https://www.pena4.com/jobs.php',SHORT='https://hr-1.in/f3dff0'
export const PORTAL='https://career.hrone.cloud',GATEWAY='https://gateway.app.hrone.cloud'
export const LIST=GATEWAY+'/api/external/public/referral/CareerPosition/Details',LABELS=GATEWAY+'/api/external/public/referral/LabelSetting'
export const sha=body=>createHash('sha256').update(body).digest('hex')
export const fail=message=>Object.assign(Error('Pena4 current native '+message),{source:SOURCE,code:'PENA4_CURRENT_NATIVE_CONTRACT',failureKind:'parser_or_contract_error',lifecycleCleanupAllowed:false,sourceScopeComplete:false})
export const need=(ok,message)=>{if(!ok)throw fail(message)}
const norm=v=>typeof v==='string'?v.replace(/\s+/g,' ').trim():'',object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)
// Whole original public programs establish the read-only query, headers,
// pagination, and own-role API. Native rows remain dynamic within this contract.
export const PROGRAM=[
 {label:'main',path:'/main.e3fa9a0389ba5822.js',sha256:'4aebf4ef03b5bac04fc771cec5c053f472bafa371861f04607821da3923d9ada'},
 {label:'runtime',path:'/runtime.e1dcfa1dbf970e90.js',sha256:'ddc1d3667d9ad72ab38134d73379d0359259b2aa803ba081188e2c2dbbf9b091'},
 {label:'careers-client',path:'/1020.5da02bbdf228dacf.js',sha256:'153f719692b0bd3a3d65b804d4c9eca6950e0d20f12af7bfe7b26f0241091336'},
 {label:'detail-client',path:'/6460.1a1993033241bd99.js',sha256:'836863acc642f711dcb1b28be2daa4c2dca11d260cdd5e49c7cf846f751d48ec'},
]
export function corporateHandoff(html){
 const doc=readNativeDocument(html),tabs=doc.nodes(n=>n.attrs.id==='tab-3'),head=activeHead(html)
 need(head.titles.length===1&&head.titles[0]==='Jobs at Pena4 | Join Our Team','official jobs publisher identity changed')
 need(tabs.length===1&&doc.nodes(n=>n.tag==='a'&&n.attrs['data-bs-target']==='#tab-3'&&n.attrs['data-bs-toggle']==='tab'&&doc.text(n)==='India').length===1,'India-tab identity changed')
 need(activeIframeDeclarations(html).filter(f=>f.href===SHORT).length===1&&tabs[0].children.filter(n=>typeof n!=='string'&&n.activeFrame&&n.attrs.src===SHORT).length===1,'India-tab native frame declaration changed')
}
export function portalConfiguration(value){
 let u;try{u=new URL(value)}catch{need(false,'published tenant URL unavailable')}
 const keys=['appId','dc','rqt','cc']
 need(u.href===value&&u.origin===PORTAL&&u.pathname==='/career-portal'&&!u.username&&!u.password&&!u.hash&&u.searchParams.size===4&&keys.every(k=>u.searchParams.getAll(k).length===1&&norm(u.searchParams.get(k))&&u.searchParams.get(k).length<=4096)&&u.searchParams.get('dc')==='pena4tech','published portal tenant identity changed')
 return Object.fromEntries(keys.map(k=>[k,u.searchParams.get(k)]))
}
export function verifyPortal(html){
 const scripts=readNativeDocument(html).nodes(n=>n.tag==='script'&&!n.inert&&typeof n.attrs.src==='string').map(n=>new URL(n.attrs.src,PORTAL).href)
 need(PROGRAM.slice(0,2).every(p=>scripts.includes(PORTAL+p.path)),'declared public portal program changed')
}
export const headersFor=c=>({apiKey:c.appId,domainCode:c.dc,AccessMode:'W','skip-withcredentials':'false',Origin:PORTAL,Referer:PORTAL+'/'})
export const queryFor=(c,page)=>({departmentCode:'',companyCode:c.cc,careerPortalType:c.rqt,jobTitle:'',employmentType:'',seniorityName:'',jobFunction:'',company:'',businessUnitCode:'',department:'',subDepartment:'',gradeCode:'',designationCode:'',levelCode:'',branchCode:'',subBranchCode:'',regionCode:'',locationId:'',experience:'',qualification:'',skillsName:'',urgentOpening:'',jobPosted:'0',isShortUrl:false,pagination:{pageNumber:page,pageSize:15},nationality:'',preferredLocationId:''})
export const ownDetailURL=(r,c)=>GATEWAY+'/api/external/public/referral/JobOpening/Request/Details/'+[r.encryptedPositionId,c.cc,r.sourceType].map(encodeURIComponent).join('/')
export function parsePage(rows){
 need(Array.isArray(rows)&&rows.length<=15,'native pagination array unavailable')
 for(const r of rows){
  need(object(r)&&Number.isSafeInteger(r.positionId)&&r.positionId>0&&['jobCode','jobTitle','encryptedPositionId','sourceType'].every(k=>norm(r[k])&&r[k].length<=4096),'native position identity unavailable')
  need(!['error','errors','err'].some(k=>Object.hasOwn(r,k)),'native position failure envelope')
  need(r.noOfOpening==null||Number.isFinite(r.noOfOpening)&&r.noOfOpening>=0,'native position headcount invalid')
  need(r.preferredLocation==null||typeof r.preferredLocation==='string','native workplace label shape changed')
  need(r.preferredLocationOptionId==null||Number.isSafeInteger(r.preferredLocationOptionId),'native workplace option shape changed')
 }
 return {rows,terminal:rows.length<15}
}
export function verifyLabels(rows){
 need(Array.isArray(rows)&&rows.length>0&&rows.length<=150,'native public labels unavailable')
 const seen=new Set()
 for(const r of rows){need(object(r)&&norm(r.fieldName)&&norm(r.displayName)&&typeof r.isCarrierPortal==='boolean'&&!seen.has(r.fieldName),'native public label identity changed');seen.add(r.fieldName)}
}
export function verifyOwnRole(row,data){
 need(object(data)&&data.requestId===row.positionId&&data.jobCode===row.jobCode&&norm(data.jobTitle)===norm(row.jobTitle)&&!['error','errors','err'].some(k=>Object.hasOwn(data,k)),'native own-role identity changed')
 need(data.company==='Pena4 Tech Solutions India Private Ltd','native own-role employer binding changed')
}
