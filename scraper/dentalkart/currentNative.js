import {createHash} from 'node:crypto'
import {parse} from 'acorn'
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
const need=(ok,message)=>{if(!ok)throw failure(message)},sha=value=>createHash('sha256').update(value).digest('hex')
const astText=value=>JSON.stringify(value,(key,part)=>['start','end','raw'].includes(key)?undefined:part)
export function readCurrentCorporate(html){
 const owned=readOwnedCurrentDocument(html,{failure,title:'Careers | Dentalkart',canonical:CAREERS_URL})
 const visible=readVisibleNativeDocument(html,{strict:true}),links=visible.nodes(node=>node.tag==='a'&&node.attrs.href===BOARD_URL)
 need(links.length===1&&owned.nodes.filter(node=>node.tag==='a'&&node.attrs.href===BOARD_URL).length===1,'Corporate hiring handoff changed or is hidden')
 need(nativeText(visible.nodes(node=>node.tag==='body')[0]).includes('VASA DENTICITY LIMITED'),'Corporate legal-employer declaration changed')
 return {careersURL:CAREERS_URL,boardURL:BOARD_URL,legalEmployer:legal}
}
function programProfile(owned){
 const scripts=owned.nodes.filter(node=>node.tag==='script')
 const declarationSHA=sha(JSON.stringify(scripts.map(node=>({attrs:Object.fromEntries(Object.entries(node.attrs).sort(([a],[b])=>a.localeCompare(b))),inert:Boolean(node.inert)}))))
 // Keep each reviewed deployment's declarations and literal CDN map paired.
 // Nov10's opening/closing responses preserve the bootstrap AST, hidden
 // schema, employer and original records; unseen program changes stay closed.
 const mapSHA={
  '56dc36b1071183af6a602e7354f6e6e716595c79d01ca208bb7f7257dc94f951':'02957f4fcc7279f1a2f33af35900e44362a6c5ec28b88231ca4688fadd411684',
  'e4448574867b39a0adbed0763f3598ccf2d61953f311b65ecf99cbcc12f41494':'d56eac1c1377cfcf3edd65fa1fcaf674914aea20ab8533fb5e1971c4c3517166',
 }[declarationSHA]
 need(mapSHA,'Native program declarations require review')
 const inline=scripts.filter(node=>!node.attrs.src),hashes=['9ca9fd935c85d2a1e5fd42d6bf83f0be088278a232d6d5d77c458ba096c1cecc','21d75b390eafe069af969e64b88bb7625e3cf8edc1981b08434bc90dca5b05f7',mapSHA,'3d432e36401cc9bde326d9d3db94aa66fb5d67f6879885bf9a43a7ba844874e5','f4d0d7cebb48af8a675430918947ce5e300262a9f8ba4035d0ae1d8c5834ff6b']
 need(inline.length===6&&hashes.every((hash,index)=>sha(inline[index].raw)===hash),'Native inline program requires review')
 need(owned.head.children.includes(inline[5]),'Native bootstrap owner changed')
 const ast=parse(inline[5].raw,{ecmaVersion:'latest'}),binding=ast.body[0]?.declarations?.[1]
 need(binding?.id?.name==='csrfToken'&&binding.init?.type==='Literal'&&typeof binding.init.value==='string','Native bootstrap token binding changed')
 binding.init={type:'ReviewedLiteralData',binding:'csrfToken'}
 need(sha(astText(ast))==='49f13e4d8eb9ddd80b63fe4126e5baf01a210d34088c08eb337cd13f84922e0f','Native bootstrap structure requires review')
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
 need(sha(result.pageJson)==='30cc758dfa3242402141fe79a1864eb83e746c88a4a2a6c8ecfa850c99e9e8bb'&&sha(result.moduleMeta)==='f565854c41b2dab30c13e2ecd9a300d0b0553f980b7e09f2795fb92f764f09fe','Native hidden schema/template requires review')
 return result
}
export function readCurrentBoard(html){
 const owned=readOwnedCurrentDocument(html,{failure,title:'Jobs at VASA Denticity Limited',canonical:BOARD_URL,stylesheetFragment:true,eventPrograms:[]})
 programProfile(owned)
 const mounts=owned.nodes.filter(node=>node.attrs.id==='career-website-main')
 need(mounts.length===1&&owned.body.children.includes(mounts[0])&&!mounts[0].inert,'Native career mount owner changed')
 const hidden=readOriginalHiddenInputs(html,owned),records=JSON.parse(hidden.jobs),meta=JSON.parse(hidden.meta)
 need(meta.list_url===BOARD_URL&&meta.page_name==='Careers'&&meta.source==='CareerSite'&&meta.employee_portal===false&&meta.portal_user?.is_loggedin===false,'Native portal authority changed')
 need(meta.org_info?.company_name===legal&&meta.org_info.website==='www.dentalkart.com'&&meta.org_info.id==='178824000000335830'&&meta.page_id==='178824000000433935','Native employer/page identity changed')
 need(Array.isArray(records)&&records.length<=1000,'Native record array changed')
 const ids=new Set()
 for(const row of records){
  need(row&&typeof row.id==='string'&&/^\d{12,24}$/.test(row.id)&&!ids.has(row.id)&&typeof row.Posting_Title==='string'&&clean(row.Posting_Title)&&typeof row.Publish==='boolean'&&typeof row.Is_Locked==='boolean'&&typeof row.Country==='string'&&typeof row.Job_Description==='string','Invalid or duplicate original native record')
  ids.add(row.id)
 }
 return {records,meta,context:{nativeEmployerDisplayName:legal,nativeWebsite:meta.org_info.website,boardURL:BOARD_URL,companyScopeQualified:false}}
}
export function normalizeCurrentDentalkartRecord(record){
 const country=countryName(record.Country),city=clean(record.City)||null,state=clean(record.State)||null
 return {title:clean(record.Posting_Title),company:'Dentalkart',legalEmployer:legal,jobId:record.id,requisitionId:null,sourceNativeJobId:record.id,
  location:[city,state,country].filter(Boolean).join(', ')||null,city,state,country,sourceCountryScopeUnresolved:!country,
  sourceNativeJobRecord:structuredClone(record),sourceExactBrandRoleScopeVerified:false,sourceEmployerScope:'corporate-declared-native-board',
  sourceUrl:BOARD_URL,applyUrl:BOARD_URL,applicationUrlIsGeneric:true,applicationVisited:false,
  employmentType:clean(record.Job_Type)||null,workplaceType:record.Remote_Job===true?'Remote':null,experienceRequired:clean(record.Work_Experience)||null,
  department:null,minimumQualification:null,preferredQualification:null,requiredSkills:[],postingDate:null,closingDate:null,firstPublishedAt:null,
  nativeDateOpened:typeof record.Date_Opened==='string'?record.Date_Opened:null,nativeDateOpenedProvenance:'native Date_Opened;publication semantics unverified',
  companyDomain:'dentalkart.com',sourceEmployerEvidence:{nativeEmployerDisplayName:legal,nativeWebsite:'www.dentalkart.com'},
  ...readOriginalNativeCriteria(record.Job_Description,failure),lifecycleCleanupAllowed:false}
}
export const runCurrentDentalkart=options=>collectCurrentOriginalRecords(options,{source:'dentalkart',company:'Dentalkart',atsPlatform:'zoho',corporateURL:CAREERS_URL,recordKind:'mixed',
 admitted:[[CAREERS_URL,'html'],[BOARD_URL,'html']],id:row=>row.id,active:row=>row.Publish===true&&row.Is_Locked===false,normalize:normalizeCurrentDentalkartRecord,
 async open(reader){const corporate=readCurrentCorporate((await reader.read(CAREERS_URL)).body);return {...readCurrentBoard((await reader.read(BOARD_URL)).body),corporate}},
 async close(reader,opening,observe){const latest=readCurrentBoard((await reader.read(BOARD_URL)).body);observe(latest)
  const corporate=readCurrentCorporate((await reader.read(CAREERS_URL)).body)
  need(canonicalNativeRecord(corporate)===canonicalNativeRecord(opening.corporate)&&canonicalNativeRecord(latest.meta)===canonicalNativeRecord(opening.meta),'Corporate/native employer metadata changed at closing');return latest},
})
