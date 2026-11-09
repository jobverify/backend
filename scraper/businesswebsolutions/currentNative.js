import {structure,hasClass,within,inner,need,publicRead,stable} from '../alohatechnology/publicRead.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
const SOURCE='businesswebsolutions',COMPANY='Business Web Solutions'
export const CURRENT_CAREERS='https://businesswebsolutions.in/careers/'
const one=(nodes,label)=>{need(nodes.length===1,COMPANY,'missing or ambiguous '+label);return nodes[0]}
export function inspectCurrentTable(html){
 const s=structure(html)
 need(s.visible(n=>n.tag==='link'&&n.attrs.rel==='canonical'&&n.attrs.href===CURRENT_CAREERS).length===1&&s.visible(n=>n.tag==='title').some(n=>/Careers/i.test(s.text(n)))&&s.text(s.root).includes(COMPANY),COMPANY,'current corporate careers identity changed')
 const table=one(s.visible(n=>n.tag==='table'&&/Opportunity Title.*Experience.*Deadline.*Apply Link/.test(s.text(n))),'native careers opportunity table')
 const remote=/All opportunities listed above are online\/remote\./i.test(s.text(s.root))
 const rows=within(table,n=>n.tag==='tr'&&s.active(n)).flatMap(row=>{
  const cells=row.children.filter(n=>typeof n!=='string'&&['td','th'].includes(n.tag));if(!cells.length||cells[0].tag==='th')return[]
  need(cells.length===4,COMPANY,'native opportunity column count changed')
  const title=s.text(cells[0]),experience=s.text(cells[1]),status=s.text(cells[2]),links=within(cells[3],n=>n.tag==='a'&&s.active(n)&&n.attrs.href)
  need(title&&experience&&['Open','Upcoming','Closed'].includes(status)&&links.length<=1,COMPANY,'native row state or identity is ambiguous')
  let detailUrl=null;if(links.length&&links[0].attrs.href!=='undefined'){const u=new URL(links[0].attrs.href,CURRENT_CAREERS);need(u.origin==='https://businesswebsolutions.in'&&!u.search&&!u.hash,COMPANY,'unreviewed external native role handoff');detailUrl=u.href}
  return[{title,experienceRequired:experience,status,detailUrl,location:remote?'Remote':null,country:null,jobId:null,requisitionId:null,remoteStatus:remote?'Remote':null,originalRowHtml:inner(row)}]
 })
 need(rows.length>0&&new Set(rows.map(r=>r.title)).size===rows.length,COMPANY,'native opportunity table missing or duplicate identity')
 return{rows,remoteExplicit:remote}
}
export const extractCurrentOpenJobs=html=>inspectCurrentTable(html).rows.filter(r=>r.status==='Open').map(r=>({...r,company:COMPANY,city:null,sourceUrl:CURRENT_CAREERS,applyUrl:r.detailUrl,employmentType:null,minimumQualification:null,preferredQualification:null,requiredSkills:[],postingDate:null,closingDate:null,jobDescription:null,compensation:null}))
function publicMain(html){const s=structure(html),main=one(s.visible(n=>n.tag==='main'),'native public detail content');return{s,main}}
function vacancyDetail(html,url){
 const {s,main}=publicMain(html),heading=one(within(main,n=>n.tag==='h1'),'native detail title'),title=s.text(heading)
 let ended=false
 const prune=n=>{if(typeof n==='string')return ended?'':n;if(ended||n.inert||['script','style','form','iframe'].includes(n.tag))return null;if(/^h[1-6]$/.test(n.tag)&&/^Apply NOW$/i.test(s.text(n))){ended=true;return null}return{...n,children:n.children.map(prune).filter(n=>n!==null)}}
 const content=prune(main),text=structure('<main>'+inner(content)+'</main>').text(structure('<main>'+inner(content)+'</main>').root),ids=[...text.matchAll(/\bJob ID:\s*([A-Za-z0-9_-]+)/g)]
 need(ids.length===1&&/About this Job/i.test(text)&&/Role and Responsibilities/i.test(text)&&/Qualifications and Skills/i.test(text)&&text.includes(COMPANY),COMPANY,'native full vacancy criteria or published posting identity missing')
 return{nativeJobId:ids[0][1],nativeTitle:title,sourceUrl:url,nativeEmployer:COMPANY,originalCriteriaText:text,originalCriteriaHtml:inner(content),country:null,location:/Remote\s*\(WFH\)/i.test(text)?'Remote (WFH)':null,jobPostingDate:null,formalRequisitionId:null}
}
export const runCurrentBusinessWeb=options=>publicRead({source:SOURCE,company:COMPANY},options,async({read,stamp,audit,publicPages})=>{
 const verifiedAt=stamp(),snapshot=async phase=>{
  const table=inspectCurrentTable(await read(CURRENT_CAREERS,{phase})),programHandoffs=[],details=[]
  for(const row of table.rows.filter(r=>r.status==='Open'&&r.detailUrl)){
   const expectedMentorship='https://businesswebsolutions.in/full-stack-development-mentorship/',html=await read(row.detailUrl,{phase,allowedFinalUrls:[row.detailUrl,...(/\/full-stack-(?:web-)?development-internship\/$/.test(row.detailUrl)?[expectedMentorship]:[])]}),{s,main}=publicMain(html),h1=s.text(one(within(main,n=>n.tag==='h1'),'native public handoff heading'))
   if(/Mentorship/i.test(h1)&&/Live Mentorship Track/i.test(s.text(main))){programHandoffs.push({listingTitle:row.title,sourceUrl:row.detailUrl,finalUrl:publicPages.at(-1).finalUrl,nativeTitle:h1,kind:'public-mentorship-program',vacancyQualified:false,classificationSignals:['Live Mentorship Track','Mentorship'],originalPublicText:s.text(main)});continue}
   const d=vacancyDetail(html,row.detailUrl);details.push({...d,listingTitle:row.title,identityConflict:d.nativeTitle!==row.title})
  }
  return{...table,programHandoffs,details}
 },first=await snapshot('initial'),last=await snapshot('closing')
 const model=value=>({rows:value.rows,remoteExplicit:value.remoteExplicit,details:value.details,programHandoffs:value.programHandoffs.map(({originalPublicText,...r})=>r)})
 need(stable(model(first))===stable(model(last)),COMPANY,'closing public opportunity states, criteria, identities or handoffs changed')
 const observations=first.rows.map(row=>({...row,kind:row.status==='Closed'?'closed-native-opportunity':row.status==='Upcoming'?'upcoming-native-opportunity':first.programHandoffs.some(p=>p.sourceUrl===row.detailUrl)?'native-program-handoff':'open-native-vacancy-observation',fullCriteriaAvailable:first.details.some(d=>d.sourceUrl===row.detailUrl),detailGap:row.status==='Open'&&!row.detailUrl?'unusable-published-detail-link':null}))
 const vacancies=observations.filter(r=>r.kind==='open-native-vacancy-observation'),evidence={status:'coverage-gap',surface:CURRENT_CAREERS,firstParty:publicPages.every(p=>p.status===200||[301,302,303,307,308].includes(p.status)),listingComplete:false,pagesFetched:publicPages.length,reportedTotal:null,indiaFacetCount:null,verifiedAt,reason:'native-open-opportunities-have-work-country-and-title-binding-gaps;mentorship-is-not-a-vacancy;no-company-country-inference'}
 await audit({verifiedAt,observations,programHandoffs:first.programHandoffs,fullNativeRoleDetails:first.details,identityConflictCount:first.details.filter(d=>d.identityConflict).length,closingReconciled:true,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyGlobalTotal:null,companyIndiaTotal:null,inventoryEvidence:evidence})
 const jobs=attachInventoryEvidence([],evidence)
 return attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'mixed',observedRecordCount:observations.length,observedVacancyCount:vacancies.length,sourceScopeComplete:false})
})
