import crypto from 'node:crypto'
import {extractOfficialRecruitmentLinks} from '../../scripts/officialRecruitmentLinks.js'
import {readNativeDocument,extractActiveDescription} from './nativeHtml.js'
export const CORPORATE='https://aeriestechnology.com/careers/',BOARD='https://aeriestechnology.talentrecruit.com/Search/',ORIGIN='https://aeriestechnology.talentrecruit.com'
export const API=ORIGIN+'/Services/SearchJobsService.asmx/GetHotLinksAndJobs',CONTROLLER=ORIGIN+'/AngularJS/app.controller-search-job.js?version=20201208',MAIN=ORIGIN+'/AngularJS/main.js?version=20220125',TEMPLATE=ORIGIN+'/TR_Temp/Search_Default.html'
const hashes=['b27c2c849418b4c814841bfd47652f5102ef594f6bf7a341fa6dcb2327fba003','31ddacb29521e01d97b66d836c698ef8745a494153c770c154cdeb91894c7084','268269eab4fdcbadddbb227c8f953f8216c5cdc0defd585e6236ef99002ea478']
const check=(ok,message)=>{if(!ok)throw new Error('Aeries native contract: '+message)}
const norm=x=>typeof x==='string'?x.replace(/\s+/g,' ').trim():''
const only=(rows,label)=>{check(rows.length===1,'Expected one '+label);return rows[0]}
const safeID=x=>typeof x==='number'&&Number.isSafeInteger(x)&&x>0
function verifyPageTitle(doc){const head=only(doc.nodes(n=>n.tag==='head'),'native document head'),titles=head.children.filter(n=>typeof n!=='string'&&!n.inert&&n.tag==='title').map(n=>norm(n.raw));check(titles.length>=1&&titles.length<=2&&titles[0]==='Aeries Technology'&&titles.slice(1).every(t=>t==='Job Portal'),'Native board company title mismatch')}
function responseEnvelope(p){check(p&&typeof p==='object'&&!Array.isArray(p),'Malformed native envelope');for(const key of ['error','Error','errors','Errors','message','Message'])if(p[key]!=null)check(p[key]===''||(Array.isArray(p[key])&&p[key].length===0),'Native error envelope');for(const key of ['success','Success'])if(p[key]!=null)check(p[key]===true,'Native failure envelope');for(const key of ['status','Status','statusCode','StatusCode'])if(p[key]!=null)check(p[key]===200,'Native failure status')}
export function verifyAeriesBinding(corporate,board,controller,main,template){
 check(extractOfficialRecruitmentLinks(corporate,CORPORATE).some(l=>l.href===BOARD),'Current corporate native board handoff unavailable')
 const doc=readNativeDocument(board);verifyPageTitle(doc)
 const base=only(doc.nodes(n=>n.tag==='base'),'native board base');check(base.attrs.href==='','Native role URL base changed')
 for(const url of [CONTROLLER,MAIN])check(doc.nodes(n=>n.tag==='script'&&!Object.hasOwn(n.attrs,'nomodule')&&n.attrs.src&&[undefined,'','text/javascript','application/javascript'].includes(n.attrs.type)&&new URL(n.attrs.src,BOARD).href===url).length===1,'Current advertised native client missing')
 for(const [i,body]of [controller,main,template].entries())check(typeof body==='string'&&crypto.createHash('sha256').update(body).digest('hex')===hashes[i],'Native client pagination/role URL contract changed')
 return{board:BOARD,enumeration:'current-public-client-loads-all-Jobs-once-and-paginates-local-array',roleURLProof:'exact-current-native-template-first-space-replacement'}
}
function date(value,now,isPublication=false){
 check(typeof value==='string'&&/^\d{2}\/[A-Z][a-z]{2}\/\d{4}$/.test(value),'Native date unavailable')
 const [day,mon,year]=value.split('/'),month=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(mon);check(month>=0,'Native month invalid')
 const iso=year+'-'+String(month+1).padStart(2,'0')+'-'+day+'T00:00:00.000Z',d=new Date(iso);check(Number.isFinite(d.getTime())&&d.toISOString()===iso,'Invalid native calendar');check(!isPublication||d.getTime()<=Date.parse(now),'Future native publication');return iso
}
function geo(row){
 check(typeof row.FULL_JOB_LOCATION==='string'&&(row.JOB_LOCATION==null||typeof row.JOB_LOCATION==='string'),'Native country/office types invalid')
 const full=norm(row.FULL_JOB_LOCATION),city=norm(row.JOB_LOCATION)||null,states={Karnataka:['Bangalore'],Maharashtra:['Mumbai','Pune',null],Telangana:['Hyderabad',null]},state=Object.keys(states).find(s=>full===(city?s+' '+city:s))
 check(state&&states[state].includes(city),'Unknown or contradictory native India office')
 check(row.IS_REMOTE===false,'Native unbounded or malformed remote scope')
 for(const key of ['country','Country','COUNTRY','countryCode'])if(row[key]!=null)check(typeof row[key]==='string'&&['India','IN'].includes(row[key]),'Conflicting native country')
 return{country:'India',city,state,location:(city?city+', '+state:state)+', India',nativeLocation:row.FULL_JOB_LOCATION}
}
export function readAeriesRows(payload,{now=new Date().toISOString()}={}){
 responseEnvelope(payload);check(typeof payload.d==='string'&&payload.d.trim(),'Native wrapped inventory missing')
 let body;try{body=JSON.parse(payload.d)}catch{throw new Error('Aeries native contract: Invalid native JSON')};responseEnvelope(body)
 check(Array.isArray(body.Jobs)&&Array.isArray(body.JobSuggestion)&&body.Jobs.length<=100,'Native bounded inventory unavailable')
 for(const suggestion of body.JobSuggestion)check(suggestion&&typeof suggestion.JobTitle==='string'&&suggestion.JobTitle.trim()&&typeof suggestion.JobDisplay==='string'&&suggestion.JobDisplay.trim()&&typeof suggestion.NoOfJobs==='number'&&Number.isSafeInteger(suggestion.NoOfJobs)&&suggestion.NoOfJobs>=0&&suggestion.NoOfJobs<=body.Jobs.length,'Native hot-link count contradicts all-Jobs inventory')
 const rows=body.Jobs.map(j=>{check(j&&typeof j==='object'&&safeID(j.REF_REQ_ID)&&safeID(j.ClientId)&&typeof j.Client==='string'&&j.Client.trim(),'Native job/client identity malformed');check(typeof j.JOB_TITLE==='string'&&norm(j.JOB_TITLE).length>2&&j.JOBOPENTYPE===3,'Native public role status invalid');geo(j);check(j.POSTED_DATE===j.PostedDateTime&&j.CandidateJobOpenTillDate===j.CandidateJobOpenTillDateInTick,'Native date aliases disagree');date(j.POSTED_DATE,now,true);date(j.CandidateJobOpenTillDate,now);return j})
 check(new Set(rows.map(j=>j.REF_REQ_ID)).size===rows.length,'Duplicate native ID');return rows
}
export function nativeRoleUrl(row){check(safeID(row.REF_REQ_ID)&&typeof row.JOB_TITLE==='string','Native URL identity invalid');return new URL('Jobs/?'+row.REF_REQ_ID+'-'+row.JOB_TITLE.replace(' ','-'),BOARD).href}
export function validateAeriesDetail(html,row,{now=new Date().toISOString()}={}){
 // Revalidate the individual listing contract before consuming its detail.
 readAeriesRows({d:JSON.stringify({Jobs:[row],JobSuggestion:[]})},{now})
 const doc=readNativeDocument(html),node=id=>only(doc.nodes(n=>n.attrs.id===id),id),text=id=>doc.text(node(id)),url=nativeRoleUrl(row)
 verifyPageTitle(doc)
 check(/^Aeries Technology\b/.test(text('MainContent_lblAboutUs')),'Native Aeries identity mismatch')
 check(text('MainContent_lblJobTitle')===norm(row.JOB_TITLE),'Native title mismatch')
 const locations=doc.nodes(n=>n.attrs.id==='MainContent_lblLocation');check(locations.length<=1&&(norm(row.JOB_LOCATION)?locations.length===1:true),'Native location field unavailable')
 check((locations.length?doc.text(locations[0]):'')===norm(row.JOB_LOCATION),'Native city/location mismatch')
 check(text('MainContent_lblJobStatus')==='Open','Native role is not currently open')
 const nativeDisplayId=text('MainContent_lblJobId');check(/^Aeries\/\d+\/\d{2}-\d{2}$/.test(nativeDisplayId),'Native display role ID unavailable')
 check(node('MainContent_hdnClientId').attrs.value===String(row.ClientId),'Native client identity mismatch')
 const requirement=only(doc.nodes(n=>n.attrs.id==='MainContent_hdnRequirement'||n.attrs.name==='ctl00$MainContent$hdnRequirement'),'native application requirement')
 check(requirement.tag==='input'&&requirement.attrs.type==='hidden'&&requirement.attrs.id==='MainContent_hdnRequirement'&&requirement.attrs.name==='ctl00$MainContent$hdnRequirement'&&requirement.attrs.value===String(row.REF_REQ_ID),'Native application requirement identity mismatch')
 const form=node('form1');check(form.tag==='form'&&form.attrs.method?.toLowerCase()==='post'&&typeof form.attrs.action==='string','Native apply form unavailable')
 const action=new URL(form.attrs.action,url);check(action.origin===ORIGIN&&action.pathname===new URL(url).pathname&&!action.hash&&/^\?(\d+)-/.exec(action.search)?.[1]===String(row.REF_REQ_ID),'Native application role ID mismatch')
 const apply=node('MainContent_btnApplyWithoutLogin');check(apply.tag==='input'&&apply.attrs.type==='submit'&&!Object.hasOwn(apply.attrs,'disabled'),'Native public application unavailable')
 const fields=doc.nodes(n=>n.attrs.id==='MainContent_divRolesAndResponsibility');check(fields.length<=1,'Duplicate native full description')
 let description=fields.length?extractActiveDescription(doc.text(fields[0])):null
 if(description&&/^(?:test(?:\s+(?:job|desc(?:r)?iption))?|tbd|n\/a)[.!]?$/i.test(description))description=null
 return{source:'aeriestechnology',company:'Aeries Technology',jobId:String(row.REF_REQ_ID),requisitionId:String(row.REF_REQ_ID),title:norm(row.JOB_TITLE),sourceUrl:url,applyUrl:url,link:url,...geo(row),nativeClient:row.Client,nativeClientId:row.ClientId,nativeDisplayJobId:nativeDisplayId,postedAt:date(row.POSTED_DATE,now,true),postingDate:date(row.POSTED_DATE,now,true),closingDate:date(row.CandidateJobOpenTillDate,now),sourceClosingDateIsExact:false,jobDescription:description,sourceDescription:description,sourceDetailComplete:Boolean(description),sourceDetailStatus:description?'complete':'native-full-description-missing-or-placeholder',sourceListingComplete:false,scrapedAt:now}
}
