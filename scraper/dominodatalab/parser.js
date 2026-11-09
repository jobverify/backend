import crypto from 'node:crypto'
import {decode,document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {requireNative} from '../../scraper-support/shared/nativeJobPosting.js'
export const SOURCE='dominodatalab',COMPANY='Domino Data Lab',HOME='https://domino.ai/careers',PORTAL='https://api.careerpuck.com/v1/public/job-boards/domino-data-lab',LIST='https://boards-api.greenhouse.io/v1/boards/dominodatalab/jobs?content=true',DETAIL='https://boards-api.greenhouse.io/v1/boards/dominodatalab/jobs/'
export const ensure=(ok,message)=>requireNative(ok,'Domino: '+message)
export const india=label=>typeof label==='string'&&(/^(?:Remote\s+)?India$/i.test(label.trim())||/,\s*India$/i.test(label.trim()))
export function readOfficialHome(html){ensure(typeof html==='string'&&html.includes('https://app.careerpuck.com/job-board/domino-data-lab/job/')&&/Domino/.test(html),'Official careers no longer binds the exact public CareerPuck board')}
export function readPortal(data){
 ensure(data?.permalink==='domino-data-lab'&&data.atsSourcePlatform==='greenhouse'&&data.isSandbox!==true,'Native portal/ATS configuration changed')
 ensure(data.employerProfile?.name==='Domino Data Lab'&&['dominodatalab.com','domino.ai'].includes(data.employerProfile.website)&&data.employerProfile.emailDomain==='dominodatalab.com','Native employer identity changed')
 ensure(Array.isArray(data.jobs)&&data.jobs.length>0&&data.jobs.length<=2000&&data.jobs.every(j=>j.status==='public'&&j.jobBoard?.permalink==='domino-data-lab'&&j.jobBoard.atsSourceId==='dominodatalab'&&j.jobBoard.atsSourcePlatform==='greenhouse'),'Native board configuration/visibility missing or changed')
 return{officialCareersURL:HOME,publicPortalURL:PORTAL,nativePortalBoard:'domino-data-lab',nativeATSPlatform:'greenhouse',nativeATSBoard:'dominodatalab',nativeEmployerProfile:{name:data.employerProfile.name,website:data.employerProfile.website,emailDomain:data.employerProfile.emailDomain,careerPageUrl:data.employerProfile.careerPageUrl},nativePublicRoleIDs:data.jobs.map(j=>String(j.atsSourceId))}
}
function publicURL(value,id){
 const u=new URL(value)
 ensure(u.origin==='https://app.careerpuck.com'&&!u.username&&!u.password&&!u.hash&&u.pathname==='/job-board/domino-data-lab/job/'+id
  &&(!u.search||u.search==='?gh_jid='+id),'Public role URL changes board or role identity')
}
export function readListing(data){
 ensure(data&&typeof data==='object'&&!data.error&&data.success!==false&&Array.isArray(data.jobs)&&Number.isSafeInteger(data.meta?.total)&&data.meta.total===data.jobs.length&&data.jobs.length<=2000,'Malformed/truncated native inventory')
 ensure(data.hasMore!==true&&data.has_more!==true&&!data.next&&!data.next_page&&!data.links?.next,'New native pagination is unqualified')
 const ids=new Set()
 for(const j of data.jobs){
  ensure(Number.isSafeInteger(j.id)&&j.id>0&&!ids.has(j.id)&&typeof j.title==='string'&&j.title.trim()&&typeof j.location?.name==='string'&&j.location.name.trim()&&j.company_name==='Domino','Missing/duplicate native role identity,location or company')
  publicURL(j.absolute_url,j.id);ids.add(j.id)
 }
 const selected=data.jobs.filter(j=>india(j.location.name));ensure(selected.length<=60,'Selected detail scope exceeds bounded request budget')
 const fingerprint=JSON.stringify(data.jobs.map(j=>[j.id,j.title,j.location,j.company_name,j.absolute_url,j.first_published,j.application_deadline,typeof j.content==='string'?crypto.createHash('sha256').update(j.content).digest('hex'):null]))
 return{data,records:data.jobs,selected,fingerprint}
}
export function readDetail(detail,row){
 ensure(detail&&detail.id===row.id&&detail.title===row.title&&detail.company_name===row.company_name&&detail.internal_job_id===row.internal_job_id,'Native listing/detail identity conflict')
 ensure(detail.location?.name===row.location.name&&india(detail.location.name),'Native listing/detail India workplace conflict')
 publicURL(detail.absolute_url,row.id);ensure(detail.absolute_url===row.absolute_url,'Native public role URL conflict')
 ensure(typeof detail.content==='string'&&detail.content.trim(),'Missing full native detail description')
 const encoded=/^\s*&lt;[a-z!/]/i.test(detail.content),html=encoded?decode(detail.content):detail.content,d=document(html)
 ensure(d.text(d.root).trim(),'Missing authored native role content')
 return{raw:detail,html,encoding:encoded?'single HTML entity decode of native Greenhouse.content;original retained':'original native HTML'}
}
