import {createHash} from 'node:crypto'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {nativeText,clean} from '../../scraper-support/native-sources/firstPartyNativeHtml.js'
import {readOwnedCurrentDocument,readOriginalNativeCriteria} from '../../scraper-support/native-sources/currentNativeCriteria20261106.js'
import {collectCurrentOriginalRecords,canonicalNativeRecord} from '../../scraper-support/native-sources/collectCurrentOriginalRecords20261106.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'

export const CAREERS_URL='https://www.finolexpipes.com/career/'
export const CLIENT_URL='https://www.finolexpipes.com/site/templates/assets/js/career-new.js'
export const LISTING_URL='https://www.finolexpipes.com/apis/joblist/'
const failure=message=>firstPartyFailure('finolexindustrieslimited',message,{nativeAuthorityFailure:true})
const need=(value,message)=>{if(!value)throw failure(message)},sha=value=>createHash('sha256').update(value).digest('hex')
const clientHash='ddfe91383900854f5fa237eb3979378914c91f8dabd1f8a5bfafdccd4cab14c5'

export function readCurrentFinolexCorporate(html){
 const owned=readOwnedCurrentDocument(html,{failure,title:'Careers & Jobs Opportunities | Work with Finolex Pipes',canonical:CAREERS_URL})
 need(owned.nodes.filter(node=>node.tag==='link'&&node.attrs.rel==='canonical'&&node.attrs.href===CAREERS_URL).length===1,'Missing native corporate canonical')
 const scripts=owned.nodes.filter(node=>node.tag==='script'),declared=scripts.filter(node=>node.attrs.src==='/site/templates/assets/js/career-new.js')
 need(declared.length===1&&!declared[0].inert,'Missing or ambiguous owned vacancy client declaration')
 const roots=scripts.filter(node=>!node.attrs.src&&node.raw?.includes('var root'))
 need(roots.length===1&&owned.head.children.includes(roots[0])&&sha(roots[0].raw)==='360b7eb24ed115b7b9844c7f12dfaa8a1050b68ced19eb0ce31f589abc6499a2','Native vacancy root declaration changed')
 const visible=readVisibleNativeDocument(html,{strict:true}),body=visible.nodes(node=>node.tag==='body')[0]
 need(body&&nativeText(body).includes('Managing Director, Finolex Industries Ltd.')&&nativeText(body).includes('Job Openings'),'Native corporate recruiting identity changed')
 need(owned.nodes.filter(node=>node.attrs.id==='jobListData').length===1,'Native listing mount changed')
 return {corporateURL:CAREERS_URL,clientURL:CLIENT_URL,listingURL:LISTING_URL,nativeEmployerDisplayName:'Finolex Industries Ltd.',listingMethod:'POST',listingBody:'Activity=joblist'}
}
export function readCurrentFinolexClient(body){
 // The reviewed original program is data only. Its onLoad call reads joblist;
 // sendmail and form_api are distinct mutations and are never invoked here.
 need(sha(body)===clientHash,'Native vacancy listing client requires review')
 return {clientSHA256:clientHash,method:'POST',url:LISTING_URL,body:'Activity=joblist',remoteProgramsExecuted:false}
}
export function readCurrentFinolexListing(body){
 let records;try{records=JSON.parse(body)}catch{throw failure('Invalid original native listing JSON')}
 need(Array.isArray(records)&&records.length<=1000,'Original native listing must be a bounded record array')
 const ids=new Set(),keys=['id','title','date','city','state','department','experience','summary']
 for(const row of records){
  need(row&&typeof row==='object'&&!Array.isArray(row)&&Object.keys(row).length===keys.length&&keys.every(key=>Object.hasOwn(row,key)),'Native vacancy record schema changed')
  need(Number.isSafeInteger(row.id)&&row.id>0&&!ids.has(row.id)&&keys.slice(1).every(key=>typeof row[key]==='string')&&clean(row.title),'Invalid or duplicate native vacancy record')
  ids.add(row.id)
 }
 return {records,context:{nativeEmployerDisplayName:'Finolex Industries Ltd.',corporateURL:CAREERS_URL,listingURL:LISTING_URL,method:'POST',body:'Activity=joblist',paginationProtocolDeclared:false,companyScopeQualified:false}}
}
export function normalizeCurrentFinolexRecord(record){
 return {title:clean(record.title),company:'Finolex Industries Limited',legalEmployer:null,jobId:String(record.id),sourceNativeJobId:String(record.id),requisitionId:null,
  location:clean(record.city)||clean(record.state)||null,city:clean(record.city)||null,state:clean(record.state)||null,country:null,sourceCountryScopeUnresolved:true,
  sourceNativeJobRecord:structuredClone(record),sourceExactBrandRoleScopeVerified:false,sourceEmployerScope:'first-party-corporate-vacancy-list',
  sourceUrl:CAREERS_URL,applyUrl:CAREERS_URL,applicationUrlIsGeneric:true,applicationVisited:false,
  department:clean(record.department)||null,experienceRequired:clean(record.experience)||null,employmentType:null,workplaceType:null,
  minimumQualification:null,preferredQualification:null,requiredSkills:[],postingDate:null,closingDate:null,firstPublishedAt:null,
  nativeDisplayDate:record.date,nativeDisplayDateProvenance:'Native listing date displayed by the employer client; first-publication semantics unverified',
  companyDomain:'finolexpipes.com',sourceEmployerEvidence:{nativeEmployerDisplayName:'Finolex Industries Ltd.',corporateURL:CAREERS_URL},
  ...readOriginalNativeCriteria(record.summary,failure,{minimumChars:1}),lifecycleCleanupAllowed:false}
}
export const runCurrentFinolex=options=>collectCurrentOriginalRecords(options,{source:'finolexindustrieslimited',company:'Finolex Industries Limited',atsPlatform:'first-party-declared-vacancy-query',corporateURL:CAREERS_URL,recordKind:'vacancy-rows',
 admitted:[[CAREERS_URL,'html'],[CLIENT_URL,'javascript'],[LISTING_URL,'json']],requests:[[LISTING_URL,{method:'POST',body:'Activity=joblist'}]],
 id:row=>String(row.id),active:()=>true,normalize:normalizeCurrentFinolexRecord,
 async open(reader){const corporate=readCurrentFinolexCorporate((await reader.read(CAREERS_URL)).body),client=readCurrentFinolexClient((await reader.read(CLIENT_URL)).body)
  return {...readCurrentFinolexListing((await reader.read(LISTING_URL)).body),corporate,client}},
 async close(reader,opening,observe){const closing=readCurrentFinolexListing((await reader.read(LISTING_URL)).body);observe(closing)
  const client=readCurrentFinolexClient((await reader.read(CLIENT_URL)).body),corporate=readCurrentFinolexCorporate((await reader.read(CAREERS_URL)).body)
  need(canonicalNativeRecord(client)===canonicalNativeRecord(opening.client)&&canonicalNativeRecord(corporate)===canonicalNativeRecord(opening.corporate),'Native corporate/query binding changed at closing');return closing},
})
