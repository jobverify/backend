import {createHash} from 'node:crypto'
import {createRuntimeVerifiedPublicAtsScraper} from '../../scraper-support/utils/publicAtsRuntimeInventory.js'
import {captureActiveHiringScope} from '../../scraper-support/shared/kekaCurrentSourceScope.js'
import {attachInventoryEvidence,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {toPlainText} from '../../scraper-support/detailExtractors/shared.js'
import {hasSourceDescription} from '../../src/utils/jobSourceContent.js'
import {decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import config from './currentConfig.json' with {type:'json'}

const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'
 ?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value
const signature=value=>createHash('sha256').update(JSON.stringify(stable(value))).digest('hex')
const styleSignature=html=>signature([...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)].map(match=>match[1]))
const visibleEmployerDelegation=(html,config)=>{
 const doc=readVisibleNativeDocument(html,{strict:true}),boardLinks=[],roleIds=new Set()
 for(const anchor of doc.nodes(node=>node.tag==='a'&&node.attrs.href)){
  if(!doc.text(anchor).trim()||Object.hasOwn(anchor.attrs,'disabled')||anchor.attrs['aria-disabled']==='true')continue
  let url;try{url=new URL(anchor.attrs.href,config.officialUrl)}catch{continue}
  if(url.protocol!=='https:'||url.username||url.password||url.port||url.search||url.hash
   ||!['job-boards.greenhouse.io','boards.greenhouse.io'].includes(url.hostname))continue
  const pathname=url.pathname.replace(/\/+$/,'')
  if(pathname===`/${config.source}`)boardLinks.push(url.href)
  const match=pathname.match(new RegExp(`^/${config.source}/jobs/([1-9]\\d*)$`))
  if(match)roleIds.add(match[1])
 }
 return{boardLinks:[...new Set(boardLinks)].sort(),roleIds:[...roleIds].sort(),styleContentSha256:styleSignature(html)}
}
const space=value=>String(value||'').replace(/\s+/g,' ').trim()
const nativeDescription=raw=>{
 const html=decodeNativeEntities(raw),reasons=[];let visible=''
 try{const doc=readVisibleNativeDocument(html,{strict:true});visible=doc.text(doc.nodes(node=>node.tag==='root')[0])}
 catch{reasons.push('native-description-visibility-unreviewed')}
 if(space(visible)!==space(decodeNativeEntities(toPlainText(html))))reasons.push('native-description-visibility-unreviewed')
 if(!hasSourceDescription({sourceDescription:visible}))reasons.push('native-description-incomplete')
 return{visible,reasons:[...new Set(reasons)]}
}
const valueType=value=>value===null?'null':Array.isArray(value)?'array':typeof value
const unknownNativeShape=(row,config)=>{
 const reasons=[]
 const visit=(value,path)=>{
  const rule=config.reviewedRecordSchema[path],type=valueType(value)
  if(!rule||!rule.types.includes(type)){reasons.push(`unreviewed-type:${path}`);return}
  if(type==='array'){value.forEach(item=>visit(item,path+'[]'));return}
  if(type!=='object')return
  for(const key of Object.keys(value)){
   if(!rule.keys.includes(key))reasons.push(`unreviewed-field:${path}.${key}`)
   else visit(value[key],path+'.'+key)
  }
  if(rule.requiredKeys.some(key=>!Object.hasOwn(value,key)))reasons.push(`missing-reviewed-field:${path}`)
 }
 visit(row,'$')
 for(const entry of Array.isArray(row.metadata)?row.metadata:[]){
  const identity=JSON.stringify([entry?.id,entry?.name,entry?.value_type])
  if(!config.reviewedMetadataIdentities.includes(identity))reasons.push('unreviewed-metadata-identity')
 }
 return [...new Set(reasons)]
}

// Keep the shared native binding, posting identity, country, prospect and office
// guards. This source-local layer adds observed HTTP metadata, all-role details,
// complete raw archives and closing reconciliation; it never supplies geography.
export async function runCurrentGreenhouseSource(config,options={}){
 const {fetchImpl=fetch,signal,onAudit}=options
 const fail=message=>{throw new Error(`[${config.source}] Current native inventory: ${message}`)}
 signal?.throwIfAborted()
 if(options.fetchJson||options.fetchText||options.fetchPage)fail('body-only or legacy transport unsupported; observed HTTP fetchImpl required')
 if(options.maxJobs!=null||options.maxPages!=null)fail('inventory caps unsupported')
 const api=`https://boards-api.greenhouse.io/v1/boards/${config.source}/jobs?content=true`
 const receipts=[]
 const request=async(url,kind)=>{
  signal?.throwIfAborted()
  const deadline=AbortSignal.timeout(20000),r=await fetchImpl(url,{method:'GET',redirect:'error',
   signal:signal?AbortSignal.any([signal,deadline]):deadline,
   headers:{Accept:kind==='html'?'text/html':'application/json','User-Agent':'Mozilla/5.0 (compatible; Jobverify native inventory)'}})
  if(r.status!==200||r.url!==url)fail(`HTTP status or final URL mismatch: ${url}`)
  const body=await r.text();signal?.throwIfAborted();deadline.throwIfAborted()
  if(Buffer.byteLength(body)>3000000)fail('response exceeds native inventory budget')
  receipts.push({url,status:r.status,observedAt:new Date().toISOString(),sha256:createHash('sha256').update(body).digest('hex')})
  if(kind==='html')return body
  try{return JSON.parse(body)}catch{fail(`malformed native JSON: ${url}`)}
 }
 const provider={source:config.source,companyName:config.companyName,companyCareerPage:config.officialUrl,
  atsPlatform:'greenhouse',boardToken:config.source,sourceScopeComplete:false,
  runtimeInventoryVerification:{mode:config.mode,boardUrl:`https://job-boards.greenhouse.io/${config.source}`}}
 const native=createRuntimeVerifiedPublicAtsScraper(provider)
 const visibleProof=html=>{
  let proof;try{proof=visibleEmployerDelegation(html,config)}catch(error){fail('visible employer handoff not established: '+error.message)}
  if(config.mode==='board-handoff'?!proof.boardLinks.length:!proof.roleIds.length)fail('visible employer handoff not established')
  return proof
 }
 const verifyVisibleRoleCohort=(proof,payload)=>{
  if(config.mode!=='role-links-exact')return
  const nativeIds=[...new Set(payload.jobs.filter(row=>row.isListed!==false).map(row=>String(row.id)))].sort()
  if(signature(proof.roleIds)!==signature(nativeIds))fail('visible employer handoff not established: advertised role identities disagree')
 }
 let openingHtml,openingPayload,openingVisibleProof
 let jobs=await native.run({signal,
  fetchPage:async url=>{if(url!==config.officialUrl)fail('unreviewed employer page');openingHtml=await request(url,'html');openingVisibleProof=visibleProof(openingHtml);return{status:200,url,html:openingHtml}},
  fetchJson:async url=>{if(url!==api||openingPayload)fail('unreviewed or repeated native API');openingPayload=await request(url,'json');return openingPayload},
 })
 const openingRecords=openingPayload.jobs
 if(!Array.isArray(openingRecords)||openingRecords.length>2000)fail('native full inventory unavailable or safety bound exceeded')
 verifyVisibleRoleCohort(openingVisibleProof,openingPayload)
 const details=new Array(openingRecords.length);let at=0
 await Promise.all(Array.from({length:Math.min(4,openingRecords.length)},async()=>{
  while(at<openingRecords.length){
   const index=at++,row=openingRecords[index]
   if(row.company_name!==config.companyName)fail('native listing employer mismatch')
   const detail=await request(`https://boards-api.greenhouse.io/v1/boards/${config.source}/jobs/${row.id}?content=true`,'json')
   if(detail.company_name!==config.companyName||signature(detail)!==signature(row))fail(`native full role identity, criteria or metadata disagree: ${row.id}`)
   details[index]=detail
  }
 }))
 const closingPayload=await request(api,'json'),closingHtml=await request(config.officialUrl,'html')
 if(signature(openingPayload)!==signature(closingPayload))fail('native opening/closing inventory, criteria or metadata changed')
 const closingVisibleProof=visibleProof(closingHtml)
 verifyVisibleRoleCohort(closingVisibleProof,closingPayload)
 // Recheck actual closing employer binding and advertised identities using the
 // same strong runtime. Reusing the already observed data causes no extra HTTP.
 await native.run({signal,fetchPage:async url=>({status:200,url,html:closingHtml}),fetchJson:async()=>closingPayload})
 const evidence=readInventoryEvidence(jobs),scopeReasons=[]
 const openingScope=signature(captureActiveHiringScope(openingHtml,config.officialUrl))
 const closingScope=signature(captureActiveHiringScope(closingHtml,config.officialUrl))
 if(openingScope!==config.reviewedCorporateScopeSha256||closingScope!==config.reviewedCorporateScopeSha256)scopeReasons.push('unreviewed-active-corporate-hiring-scope')
 if(openingScope!==closingScope)scopeReasons.push('corporate-hiring-scope-changed')
 if(openingVisibleProof.styleContentSha256!==config.reviewedCorporateStyleSha256
  ||closingVisibleProof.styleContentSha256!==config.reviewedCorporateStyleSha256)scopeReasons.push('unreviewed-corporate-style-content')
 if(evidence?.listingComplete!==true)scopeReasons.push(evidence?.reason||'native-geography-or-inventory-unresolved')
 const envelopeReasons=[...Object.keys(openingPayload).filter(key=>!['jobs','meta'].includes(key)).map(key=>'unreviewed-native-envelope-field:'+key),
  ...Object.keys(openingPayload.meta||{}).filter(key=>key!=='total').map(key=>'unreviewed-native-meta-field:'+key)]
 scopeReasons.push(...envelopeReasons)
 const nativeSchemaReasons=openingRecords.map(row=>({jobId:String(row.id),reasons:unknownNativeShape(row,config)})).filter(row=>row.reasons.length)
 const unknownSchemaIds=nativeSchemaReasons.map(row=>row.jobId)
 if(unknownSchemaIds.length)scopeReasons.push('unknown-native-role-schema:'+unknownSchemaIds.join(','))
 const nativeCriteria=openingRecords.map(row=>({jobId:String(row.id),...nativeDescription(row.content)}))
 const incompleteCriteria=nativeCriteria.filter(row=>row.reasons.length)
 if(incompleteCriteria.length)scopeReasons.push('native-full-criteria-unresolved:'+incompleteCriteria.map(row=>row.jobId).join(','))
 const criteriaById=new Map(nativeCriteria.map(row=>[row.jobId,row]))
 const byId=new Map(openingRecords.map(row=>[String(row.id),row]))
 const complete=scopeReasons.length===0
 jobs=jobs.map(job=>{
  const row=byId.get(String(job.jobId))
  if(!row)fail('mapped role missing from native full inventory')
  const criteria=criteriaById.get(String(row.id))
  const detailComplete=envelopeReasons.length===0&&!unknownSchemaIds.includes(String(row.id))&&criteria.reasons.length===0
  return{...job,company:row.company_name,sourceDescription:row.content,jobDescription:criteria.visible,
   sourceNativePayload:row,sourceNativeDetailPayload:details.find(detail=>detail.id===row.id),
   sourceDetailComplete:detailComplete,...(!detailComplete?{sourceDetailFailureKind:'native-role-schema-or-criteria-unresolved',
    sourceDetailFailureReasons:[...envelopeReasons,...(nativeSchemaReasons.find(reason=>reason.jobId===String(row.id))?.reasons||[]),...criteria.reasons]}:{}),
   sourceListingComplete:complete,sourceScopeComplete:complete,lifecycleCleanupAllowed:complete}
 })
 const audit={source:config.source,productionWrites:false,openingPayload,closingPayload,openingRecords,closingRecords:closingPayload.jobs,details,
  nativeRecordCount:openingRecords.length,returnedIndiaJobs:jobs.length,unknownSchemaIds,nativeSchemaReasons,
  nativeCriteriaReasons:incompleteCriteria.map(({jobId,reasons})=>({jobId,reasons})),scopeReasons,openingScope,closingScope,
  openingEmployerHtml:openingHtml,closingEmployerHtml:closingHtml,openingVisibleProof,closingVisibleProof,receipts}
 if(jobs.length)jobs[0].nativeCurrentInventoryAudit=audit
 onAudit?.(structuredClone(audit));signal?.throwIfAborted()
 return attachInventoryEvidence(jobs,{...evidence,listingComplete:complete,status:complete?evidence.status:'coverage-gap',
  reportedTotal:complete?openingRecords.length:null,indiaFacetCount:complete?jobs.length:null,
  pagesFetched:receipts.length,reason:complete?'current-employer-native-full-details-and-closing-inventory-reconciled'
   :'current-native-inventory-incomplete:'+scopeReasons.join(';')})
}
export const run=options=>runCurrentGreenhouseSource(config,options)
// Source wrappers reuse the existing strict native validators without changing
// the shared Dataiku/AssemblyAI collection or mapping behavior.
export { unknownNativeShape as inspectNativeRecordShape, nativeDescription as readNativeCriteria }
