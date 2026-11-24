import {readDentalkartProgramme,readDentalkartBootstrap,dentalkartRoleURL} from './currentProgramme.js'
import {decodeHTML} from 'entities'
import {readNativeAttributeTokens} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {nativeText,clean} from '../../scraper-support/native-sources/firstPartyNativeHtml.js'
import {countryName} from '../../scraper-support/native-sources/jobPostingData.js'
import {readOwnedCurrentDocument,readOriginalNativeCriteria} from '../../scraper-support/native-sources/currentNativeCriteria20261106.js'
import {collectCurrentOriginalRecords,canonicalNativeRecord} from '../../scraper-support/native-sources/collectCurrentOriginalRecords20261106.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'

export const CAREERS_URL='https://www.dentalkart.com/careers',BOARD_URL='https://dentalkart.zohorecruit.in/jobs/Careers'
const legal='VASA Denticity Limited',failure=message=>firstPartyFailure('dentalkart',message,{nativeAuthorityFailure:true})
const need=(ok,message)=>{if(!ok)throw failure(message)}
export function readCurrentCorporate(html){
 const owned=readOwnedCurrentDocument(html,{failure,title:'Careers | Dentalkart',canonical:CAREERS_URL})
 const visible=readVisibleNativeDocument(html,{strict:true}),links=visible.nodes(node=>node.tag==='a'&&node.attrs.href===BOARD_URL)
 need(links.length===1&&owned.nodes.filter(node=>node.tag==='a'&&node.attrs.href===BOARD_URL).length===1,'Corporate hiring handoff changed or is hidden')
 need(nativeText(visible.nodes(node=>node.tag==='body')[0]).includes('VASA DENTICITY LIMITED'),'Corporate legal-employer declaration changed')
 return {careersURL:CAREERS_URL,boardURL:BOARD_URL,legalEmployer:legal}
}
function readOriginalHiddenInputs(html,owned){
 const tags=[...html.matchAll(/<input(?=[\t\n\f\r />])(?:[^>"']|"[^"]*"|'[^']*')*>/gi)],nodes=owned.nodes.filter(node=>node.tag==='input'),result={}
 need(tags.length===4&&nodes.length===4,'Additional or missing native hidden input')
 for(let index=0;index<tags.length;index++){
  const tokens=readNativeAttributeTokens(tags[index][0].slice(6,-1)),attrs=Object.fromEntries(tokens),node=nodes[index]
  need(tokens.length===3&&new Set(tokens.map(([name])=>name)).size===3&&['id','type','value'].every(key=>Object.hasOwn(attrs,key)),'Native hidden attributes are ambiguous')
  need(['pageJson','moduleMeta','jobs','meta'].includes(attrs.id)&&attrs.type==='hidden'&&!Object.hasOwn(result,attrs.id),'Native hidden input identity changed')
  need(owned.body.children.includes(node)&&node.attrs.id===attrs.id&&node.attrs.type==='hidden','Native hidden record owner changed')
  result[attrs.id]=decodeHTML(attrs.value)
 }
 return result
}
export function readCurrentBoard(html){
 const owned=readOwnedCurrentDocument(html,{failure,title:'Jobs at VASA Denticity Limited',canonical:BOARD_URL,stylesheetFragment:true,eventPrograms:[]})
 const clientURL=readDentalkartBootstrap(owned,need)
 const mounts=owned.nodes.filter(node=>node.attrs.id==='career-website-main')
 need(mounts.length===1&&owned.body.children.includes(mounts[0])&&!mounts[0].inert,'Native career mount owner changed')
 const hidden=readOriginalHiddenInputs(html,owned),records=JSON.parse(hidden.jobs),meta=JSON.parse(hidden.meta)
 need(!meta.external_url&&!meta.internal_list_url&&meta.list_url===BOARD_URL&&meta.page_name==='Careers'&&meta.source==='CareerSite'&&meta.employee_portal===false&&meta.portal_user?.is_loggedin===false,'Native portal authority changed')
 need(meta.org_info?.company_name===legal&&meta.org_info.website==='www.dentalkart.com'&&meta.org_info.id==='178824000000335830'&&meta.page_id==='178824000000433935','Native employer/page identity changed')
 need(Array.isArray(records)&&records.length<=1000,'Native record array changed')
 const ids=new Set()
 for(const row of records){
  need(row&&typeof row.id==='string'&&/^\d{12,24}$/.test(row.id)&&!ids.has(row.id)&&typeof row.Posting_Title==='string'&&clean(row.Posting_Title)&&typeof row.Publish==='boolean'&&typeof row.Is_Locked==='boolean'&&typeof row.Country==='string'&&typeof row.Job_Description==='string','Invalid or duplicate original native record')
  ids.add(row.id)
 }
 const page=JSON.parse(hidden.pageJson),modules=JSON.parse(hidden.moduleMeta)
 need(page&&typeof page==='object'&&Array.isArray(modules)&&modules.length>0&&modules.length<=100&&modules.filter(row=>row.api_name==='Job_Openings'&&row.module_name==='Potentials'&&row.id==='178824000000387630'&&Array.isArray(row.fields)&&Array.isArray(row.layouts)).length===1,'Native page/module schema changed')
 return {records,meta,clientURL,hiddenModels:{page,moduleMeta:modules},context:{nativeEmployerDisplayName:legal,nativeWebsite:meta.org_info.website,boardURL:BOARD_URL,companyScopeQualified:false}}
}
export function normalizeCurrentDentalkartRecord(record,opening){
 const country=countryName(record.Country),city=/^(?:NA|N\/A)$/i.test(clean(record.City))?null:clean(record.City)||null,state=/^(?:NA|N\/A)$/i.test(clean(record.State))?null:clean(record.State)||null,roleURL=opening?.programme?dentalkartRoleURL(record,opening.meta):null
 return {title:clean(record.Posting_Title),company:'Dentalkart',legalEmployer:legal,jobId:record.id,requisitionId:null,sourceNativeJobId:record.id,
  location:[city,state,country].filter(Boolean).join(', ')||null,city,state,country,sourceCountryScopeUnresolved:!country,
  sourceNativeJobRecord:structuredClone(record),sourceExactBrandRoleScopeVerified:false,sourceEmployerScope:'corporate-declared-native-board',
  sourceUrl:roleURL??BOARD_URL,applyUrl:roleURL??BOARD_URL,applicationUrlIsGeneric:!roleURL,applicationVisited:false,activeApplyVerified:false,sourceApplicationDeclaration:roleURL?{publicRoleURL:roleURL,nativeId:record.id,recordBoundApplyAction:true,webformJobIdBinding:true,formId:null,formNotRequested:true}:null,
  employmentType:clean(record.Job_Type)||null,workplaceType:record.Remote_Job===true?'Remote':null,experienceRequired:clean(record.Work_Experience)||null,
  department:null,minimumQualification:null,preferredQualification:null,requiredSkills:[],postingDate:null,closingDate:null,firstPublishedAt:null,
  nativeDateOpened:typeof record.Date_Opened==='string'?record.Date_Opened:null,nativeDateOpenedProvenance:'native Date_Opened;publication semantics unverified',
  companyDomain:'dentalkart.com',sourceEmployerEvidence:{nativeEmployerDisplayName:legal,nativeWebsite:'www.dentalkart.com'},
  ...readOriginalNativeCriteria(record.Job_Description,failure),lifecycleCleanupAllowed:false}
}
export async function runCurrentDentalkart(options={}){
 try{return await collectCurrentOriginalRecords(options,{source:'dentalkart',company:'Dentalkart',atsPlatform:'zoho',corporateURL:CAREERS_URL,recordKind:'mixed',
 admitted:[[CAREERS_URL,'html'],[BOARD_URL,'html']],learnedURL:(url,kind)=>kind==='javascript'&&/^https:\/\/static\.zohocdn\.com\/recruit\/javascript\/career-website-common\.[a-f\d]{32}\.js$/.test(url),id:row=>row.id,active:row=>row.Publish===true&&row.Is_Locked===false,normalize:normalizeCurrentDentalkartRecord,
 async open(reader){const corporate=readCurrentCorporate((await reader.read(CAREERS_URL)).body),board=readCurrentBoard((await reader.read(BOARD_URL)).body);reader.allow(board.clientURL,'javascript');const programme=readDentalkartProgramme((await reader.read(board.clientURL)).body,need);return {...board,corporate,programme,context:{...board.context,programme,applicationVisited:false,activeApplyVerified:false}}},
 async close(reader,opening,observe){const latest=readCurrentBoard((await reader.read(BOARD_URL)).body);observe(latest);reader.allow(latest.clientURL,'javascript');const programme=readDentalkartProgramme((await reader.read(latest.clientURL)).body,need)
 const corporate=readCurrentCorporate((await reader.read(CAREERS_URL)).body)
 need(canonicalNativeRecord(corporate)===canonicalNativeRecord(opening.corporate)&&canonicalNativeRecord(latest.meta)===canonicalNativeRecord(opening.meta)&&canonicalNativeRecord(latest.hiddenModels)===canonicalNativeRecord(opening.hiddenModels)&&canonicalNativeRecord(programme)===canonicalNativeRecord(opening.programme),'Corporate/native employer/schema or recruitment semantics changed at closing');return latest},
 })}finally{options.signal?.throwIfAborted()}
}
