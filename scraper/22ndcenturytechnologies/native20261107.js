import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {failure} from './runtime20261107.js'
export const SOURCE='22ndcenturytechnologies'
export const CAREERS_URL='https://www.tscti.com/career/state_il'
const proof=(ok,message)=>{if(!ok)throw failure('22nd Century native '+message,'TSCTI_NATIVE_PROOF')}
const children=node=>(node.children??[]).filter(c=>typeof c!=='string')
const descend=(node,predicate)=>!node||node.inert?[]:[...(predicate(node)?[node]:[]),...children(node).flatMap(c=>descend(c,predicate))]
const norm=s=>s.replace(/\s+/g,' ').trim()
function intakeChannel(href,region,title){
 if(typeof href!=='string'||!href||href.length>4096||/[\u0000-\u001f\u007f]/.test(href))return null
 let u;try{u=new URL(href)}catch{return null}
 if(u.protocol!=='mailto:'||u.pathname.toLowerCase()!=='soil@tscti.com'||u.hash||[...u.searchParams.keys()].length!==1||!u.searchParams.has('subject'))return null
 const subject=u.searchParams.get('subject')
 if(/[\u0000-\u001f\u007f]/.test(subject)||norm(subject)!=='Region-'+region.match(/\d+/)[0]+' / '+title)return null
 return{mailbox:'soil@tscti.com',subject,url:u.href,submissionPerformed:false}
}
export function readContractIntake(html){
 proof(typeof html==='string'&&html.length>0,'HTML unavailable')
 const d=readVisibleNativeDocument(html,{strict:true}),canonical=d.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'),articles=d.nodes(n=>n.tag==='article'&&n.attrs.typeof==='schema:WebPage')
 proof(canonical.length===1&&canonical[0].attrs.href===CAREERS_URL&&articles.length===1,'contract canonical or document identity unavailable')
 const article=articles[0],text=d.text(article)
 proof(/State of Illinois/.test(text)&&/22nd Century Technologies(?:,?\s+Inc\.)?/i.test(text)&&/Temporary Staffing Needs/.test(text),'visible company or contract identity unavailable')
 const categories=[],unresolvedRows=[],duplicateRepresentations=[],seen=new Map(),regions=[]
 const fieldsets=descend(article,n=>n.tag==='fieldset')
 for(const fieldset of fieldsets){
  const legends=children(fieldset).filter(n=>n.tag==='legend'&&!n.inert),region=legends.length===1?d.text(legends[0]):null
  if(!region||!/^Region [1-9]\d*$/.test(region)){unresolvedRows.push({nativeRecordKind:'unclassified-contract-scope',nativeText:d.text(fieldset),reason:'ambiguous-native-region'});continue}
  const tables=descend(fieldset,n=>n.tag==='table'&&(n.attrs.class??'').split(/\s+/).includes('regionJobs'))
  if(tables.length!==1){unresolvedRows.push({region,nativeText:d.text(fieldset),reason:'ambiguous-native-category-table'});continue}
  regions.push(region)
  const rows=descend(tables[0],n=>n.tag==='tr'),header=rows.filter(r=>children(r).some(n=>n.tag==='th'))
  if(header.length!==1||children(header[0]).filter(n=>n.tag==='th').map(n=>d.text(n)).join('|')!=='Job Title|Link to Apply'){unresolvedRows.push({region,nativeText:d.text(tables[0]),reason:'native-category-table-headers-changed'});continue}
  for(const row of rows){
   if(row===header[0])continue
   const cells=children(row).filter(n=>n.tag==='td'&&!n.inert),title=cells[0]?d.text(cells[0]):null,links=cells[1]?descend(cells[1],n=>n.tag==='a'):[]
   if(cells.length!==2||!title){unresolvedRows.push({region,nativeText:d.text(row),reason:'unclassified-native-contract-row'});continue}
   const nativeHref=links.length===1?links[0].attrs.href??null:null,channel=links.length===1&&/^(?:Apply Now|Apply)$/i.test(d.text(links[0]))?intakeChannel(nativeHref,region,title):null
   const model={nativeRecordKind:'staffing-intake',region,title,nativeHref,nativeLinks:links.map(n=>({href:n.attrs.href??null,label:d.text(n)})),intakeChannelEvidence:channel,applicationURL:channel?.url??null,sourceUrl:CAREERS_URL,nativeRowText:d.text(row),nativeVacancyId:null,requisitionId:null,jobDescription:null,postingDate:null,country:null,city:null,nativeVacancyIdentityAvailable:false,sourceDetailComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false}
   const key=JSON.stringify([region,title,nativeHref])
   if(seen.has(key)){duplicateRepresentations.push(model);continue}
   seen.set(key,model);categories.push(model)
  }
 }
 proof(fieldsets.length>0,'native staffing category surface unavailable')
 return{nativeDocumentId:article.attrs['data-history-node-id']??null,nativeDocumentKind:'contract-staffing-intake',contractName:'State of Illinois',regions,observedStaffingCategories:categories,withheldNativeFacts:[...categories],unresolvedRows,duplicateRepresentations,hasUnqualifiedChannels:categories.some(r=>!r.intakeChannelEvidence)}
}
export const hasOfficialCareersSignal=html=>{try{readContractIntake(html);return true}catch{return false}}
export function attachIntakeEvidence(jobs,audit,inventory){
 attachSourceObservationEvidence(jobs,audit)
 Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
 return attachInventoryEvidence(jobs,inventory)
}
export const observation=analysis=>({source:SOURCE,recordKind:'hiring-signals',observedRecordCount:analysis.observedStaffingCategories.length,observedVacancyCount:0,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
export function extractJobCards(html){
 const analysis=readContractIntake(html),audit={...observation(analysis),...analysis,status:'partial',sourceScopeComplete:false,wholeCompanyScope:false,lifecycleCleanupAllowed:false,retainedNativeResponses:[],attempts:[],reason:'staffing-intake-without-native-vacancy-proof'}
 return attachIntakeEvidence([],audit,{status:'coverage-gap',surface:CAREERS_URL,firstParty:false,listingComplete:false,pagesFetched:0,reportedTotal:null,indiaFacetCount:null,verifiedAt:null,reason:audit.reason})
}
