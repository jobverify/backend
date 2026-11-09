import {createHash} from 'node:crypto'
import {createRuntimeVerifiedPublicAtsScraper} from '../../scraper-support/utils/publicAtsRuntimeInventory.js'
import {greenhouseProspectPostIds,isGreenhouseProspectPost} from '../../scraper-support/utils/greenhouseProspects.js'
import {greenhouseCountryLabels,greenhouseLocationLabels} from '../../scraper-support/utils/greenhouseLocations.js'
import {captureActiveHiringScope} from '../../scraper-support/shared/kekaCurrentSourceScope.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {toPlainText} from '../../scraper-support/detailExtractors/shared.js'
import {hasSourceDescription} from '../../src/utils/jobSourceContent.js'
import {attachInventoryEvidence,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {verifyTenableRenderer} from './rendererBinding.js'
import {auditTenableOfficeCountries} from './officeCountryProof.js'
import {captureTenableScriptSurface} from './publisherScriptSurface.js'
import {captureTenablePublisherDom} from './publisherDomSurface.js'
import {activePublisherAttributesHash,projectTenableSvgReferences} from './publisherSvgReferences.js'
import config from './currentConfig.json' with {type:'json'}

const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value
const hash=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(stable(value))).digest('hex')
const equal=(a,b)=>hash(a)===hash(b)
const fail=message=>{throw new Error('Tenable current native inventory: '+message)}
const type=value=>value===null?'null':Array.isArray(value)?'array':typeof value
const space=value=>String(value||'').replace(/\s+/g,' ').trim()
const nativeDate=value=>{
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value))return false
  const day=value.slice(0,10),date=new Date(day+'T00:00:00.000Z')
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===day&&Number.isFinite(Date.parse(value))
}
const provider={source:'tenable',companyName:'Tenable',companyCareerPage:config.officialUrl,atsPlatform:'greenhouse',boardToken:config.boardToken,
  sourceScopeComplete:false,runtimeInventoryVerification:{mode:'role-links-exact',boardUrl:'https://job-boards.greenhouse.io/'+config.boardToken,
    employerHandoffPages:[config.searchUrl]}}

function schemaReasons(value,schema,path='$',out=[]){
  const rule=schema[path],kind=type(value)
  if(!rule||!rule.types.includes(kind)){out.push('unreviewed-type:'+path);return out}
  if(kind==='array')value.forEach(row=>schemaReasons(row,schema,path+'[]',out))
  if(kind==='object'){
    for(const[key,child]of Object.entries(value)){if(!rule.keys.includes(key))out.push('unreviewed-field:'+path+'.'+key);else schemaReasons(child,schema,path+'.'+key,out)}
    if(rule.requiredKeys.some(key=>!Object.hasOwn(value,key)))out.push('missing-native-field:'+path)
  }
  return out
}
function criteria(row){
  const html=decodeNativeEntities(row.content),doc=readVisibleNativeDocument(html,{strict:true})
  const visible=doc.text(doc.nodes(n=>n.tag==='root')[0]),reasons=[]
  if(space(visible)!==space(decodeNativeEntities(toPlainText(html))))reasons.push('native-description-visibility-unreviewed')
  if(!hasSourceDescription({sourceDescription:visible}))reasons.push('native-full-criteria-unavailable')
  return {visible,reasons}
}
function metadataReasons(row){
  const reasons=[]
  if(!Array.isArray(row.metadata)||row.metadata.length!==config.metadataDefinitions.length)return ['unreviewed-native-metadata-identities']
  for(const expected of config.metadataDefinitions){
    const fields=row.metadata.filter(field=>field.id===expected.id&&field.name===expected.name&&field.value_type===expected.value_type)
    if(fields.length!==1){reasons.push('unreviewed-native-metadata-identities');continue}
    const value=fields[0].value
    if(value!==null&&(expected.value_type==='single_select'?typeof value!=='string':!Array.isArray(value)||value.some(item=>typeof item!=='string')))reasons.push('unreviewed-native-metadata-value:'+expected.name)
  }
  return reasons
}
function advertisedRoles(html){
  const doc=readVisibleNativeDocument(html,{strict:true}),roles=[]
  for(const node of doc.nodes(n=>n.tag==='a'&&n.attrs.href)){
    let url;try{url=new URL(node.attrs.href,config.officialUrl)}catch{continue}
    const match=url.pathname.match(/^\/tenableinc\/jobs\/([1-9]\d*)$/)
    if(['boards.greenhouse.io','job-boards.greenhouse.io'].includes(url.hostname)&&match&&url.protocol==='https:'&&!url.search&&!url.hash)roles.push({id:match[1],url:url.href})
  }
  return [...new Map(roles.map(role=>[role.id,role])).values()]
}

export async function run({fetchImpl=fetch,signal,onAudit,fetchText,fetchJson,fetchPage,maxJobs,maxPages}={}){
  if(fetchText!==undefined||fetchJson!==undefined||fetchPage!==undefined)fail('body-only transport is unsupported')
  if(maxJobs!=null||maxPages!=null)fail('inventory caps are unsupported')
  const audit={source:'tenable',productionWrites:false,receipts:[],details:[],closingDetails:[],unavailableAdvertisedRoles:[],closingUnavailableAdvertisedRoles:[]},reasons=[]
  const request=async(url,{allowed=[200],redirect='error',observeStatus=false}={})=>{
    signal?.throwIfAborted();const timeout=AbortSignal.timeout(20000)
    const response=await fetchImpl(url,{method:'GET',redirect,signal:signal?AbortSignal.any([signal,timeout]):timeout,
      headers:{Accept:'application/json,text/html,application/javascript','User-Agent':'Mozilla/5.0 (compatible; Jobverify native inventory)'}})
    const raw=Buffer.from(await response.clone().arrayBuffer()),body=await response.text()
    signal?.throwIfAborted();timeout.throwIfAborted()
    audit.receipts.push({url,method:'GET',status:response.status,responseUrl:response.url,observedAt:new Date().toISOString(),
      contentType:response.headers.get('content-type'),redirectLocation:response.headers.get('location'),sha256:createHash('sha256').update(raw).digest('hex'),
      rawSha256:createHash('sha256').update(raw).digest('hex'),nativeTextSha256:hash(body),bytes:raw.length})
    if(response.url!==url||!observeStatus&&!allowed.includes(response.status)||raw.length>3000000)fail('HTTP status, final URL or native response budget: '+url)
    const mime=(response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase()
    const nativeJson=url.startsWith('https://boards-api.greenhouse.io/')||url===config.firstPartyApiUrl
    const nativeHtml=url===config.officialUrl||url===config.searchUrl||url==='https://job-boards.greenhouse.io/tenableinc?error=true'
    if(nativeJson&&mime!=='application/json'||nativeHtml&&mime!=='text/html')fail('unreviewed native content type: '+url)
    return {body,response}
  }
  const json=async url=>{const {body}=await request(url);try{return JSON.parse(body)}catch{fail('malformed native JSON: '+url)}}
  const employer=async()=>{
    const official=(await request(config.officialUrl)).body,search=(await request(config.searchUrl)).body
    const doc=readVisibleNativeDocument(official,{strict:true})
    if(!doc.nodes(n=>n.tag==='a'&&new URL(n.attrs.href||'#',config.officialUrl).href===config.searchUrl&&/search jobs|view all jobs/i.test(doc.text(n))).length)fail('active official job-search handoff missing')
    const documents=[[config.officialUrl,official],[config.searchUrl,search]],programs=new Map(),declared=new Set(),wholeScriptSurfaces=[],verifiedPrograms=new Set(),stylesheetUrls=new Set(),consumerAssets=[]
    for(const[url,html]of documents){
      const scripts=captureTenableScriptSurface(html,url);wholeScriptSurfaces.push({url,scripts,sha256:hash(scripts)})
      if(hash(scripts)!==config.reviewedWholeScriptSurfaces[url])reasons.push('unreviewed-whole-publisher-script-or-data-surface:'+url)
      for(const script of scripts)if(script.sourceUrl)declared.add(script.sourceUrl)
      const root=readVisibleNativeDocument(html,{strict:true}).nodes(node=>node.tag==='root')[0]
      const collectStyles=node=>{if(node.tag==='link'&&/(?:^|\s)stylesheet(?:\s|$)/i.test(node.attrs.rel||''))stylesheetUrls.add(new URL(node.attrs.href,url).href);for(const child of node.children||[])if(typeof child!=='string')collectStyles(child)}
      collectStyles(root)
    }
    if(!equal([...declared].sort(),config.declaredPrograms.map(program=>program.url).sort()))reasons.push('unreviewed-declared-publisher-program-set')
    for(const program of config.declaredPrograms){
      if(!declared.has(program.url))continue
      const {body,response}=await request(program.url);programs.set(program.url,body)
      if(hash(body)!==program.programSha256||response.headers.get('content-type')!==program.contentType)reasons.push('unreviewed-declared-publisher-program:'+program.url)
      else verifiedPrograms.add(program.url)
      consumerAssets.push({url:program.url,body,sha256:hash(body),contentType:response.headers.get('content-type'),kind:'script',verified:verifiedPrograms.has(program.url)})
    }
    const stylesheetSetVerified=equal([...stylesheetUrls].sort(),config.declaredStylesheets.map(style=>style.url).sort())
    if(!stylesheetSetVerified)reasons.push('unreviewed-declared-publisher-stylesheet-set')
    for(const stylesheet of config.declaredStylesheets){
      if(!stylesheetUrls.has(stylesheet.url))continue
      const {body,response}=await request(stylesheet.url),verified=hash(body)===stylesheet.programSha256&&response.headers.get('content-type')===stylesheet.contentType
      if(!verified)reasons.push('unreviewed-declared-publisher-stylesheet:'+stylesheet.url)
      consumerAssets.push({url:stylesheet.url,body,sha256:hash(body),contentType:response.headers.get('content-type'),kind:'stylesheet',verified})
    }
    const consumersVerified=stylesheetSetVerified&&equal([...declared].sort(),config.declaredPrograms.map(program=>program.url).sort())
      &&consumerAssets.length===config.declaredPrograms.length+config.declaredStylesheets.length&&consumerAssets.every(asset=>asset.verified)
    const wholeDomSurfaces=[]
    for(const[url,html]of documents){
      const expected=config.emailProjectionPolicy.decoder,decoder={url:expected.url,programSha256:hash(programs.get(expected.url)||''),
        contentType:audit.receipts.filter(row=>row.url===expected.url).at(-1)?.contentType,
        verified:verifiedPrograms.has(expected.url),cohortVerified:wholeScriptSurfaces.find(row=>row.url===url).sha256===config.reviewedWholeScriptSurfaces[url]}
      const surface=captureTenablePublisherDom(html,url,config.emailProjectionPolicy,decoder)
      const consumers={assets:consumerAssets,verified:consumersVerified},preflight=projectTenableSvgReferences(surface,url,config.svgReferencePolicy,consumers)
      // A nonfragment graphic URL is not a local identifier reference. Observe
      // its actual status each phase; only the separate strict 404/HTML proof
      // may qualify it. Unknown statuses/errors never prove vacancy absence.
      const resourceResponses=[]
      for(const resolution of preflight.invalidGraphicRequests||[]){
        try{
          const {body,response}=await request(resolution.url,{redirect:'manual',observeStatus:true}),receipt=audit.receipts.at(-1)
          resourceResponses.push({url:resolution.url,finalUrl:response.url,status:response.status,contentType:response.headers.get('content-type'),
            cfMitigated:response.headers.get('cf-mitigated'),redirectLocation:response.headers.get('location'),
            body,sha256:receipt.sha256,observedAt:receipt.observedAt,bytes:receipt.bytes})
        }catch(error){signal?.throwIfAborted();resourceResponses.push({url:resolution.url,error:error.message,observedAt:new Date().toISOString()})}
      }
      const svg=projectTenableSvgReferences(surface,url,config.svgReferencePolicy,consumers,resourceResponses)
      const sha256=hash(svg.signatureTree)
      if(sha256!==config.reviewedWholeDomSurfaces[url]||surface.reasons.length||svg.svgReferenceReasons.length)reasons.push('unreviewed-entire-publisher-dom-surface:'+url)
      const rawHiringScope=captureActiveHiringScope(html,url)
      if(activePublisherAttributesHash(surface.rawTree)!==rawHiringScope.activeElementAttributesSha256)reasons.push('unreviewed-active-attribute-signature-algorithm:'+url)
      const hiringScope={...rawHiringScope,activeElementAttributesSha256:activePublisherAttributesHash(svg.signatureTree)}
      if(hash(hiringScope)!==config.reviewedScopes[url])reasons.push('unreviewed-corporate-hiring-style-or-executable-scope:'+url)
      wholeDomSurfaces.push({url,...surface,...svg,sha256,rawHiringScope,hiringScope})
    }
    const renderer=verifyTenableRenderer(search,programs.get(config.rendererUrl)||'')
    return {official,search,renderer,wholeScriptSurfaces,wholeDomSurfaces,
      scopeSignatures:wholeDomSurfaces.map(({url,hiringScope})=>({url,sha256:hash(hiringScope)})),
      rawScopeSignatures:wholeDomSurfaces.map(({url,rawHiringScope})=>({url,sha256:hash(rawHiringScope)}))}
  }
  const openingEmployer=await employer(),openingPayload=await json(config.apiUrl),firstParty=await json(config.firstPartyApiUrl),offices=await json(config.officeUrl)
  if(!openingPayload||!Array.isArray(openingPayload.jobs)||Object.keys(openingPayload).sort().join(',')!=='jobs,meta'
      ||!openingPayload.meta||Object.keys(openingPayload.meta).join(',')!=='total'
      ||openingPayload.meta.total!==openingPayload.jobs.length)fail('incomplete unfiltered native board envelope')
  const records=openingPayload.jobs,prospectIds=greenhouseProspectPostIds(records,provider)
  if(new Set(records.map(row=>row.id)).size!==records.length||records.some(row=>!Number.isSafeInteger(row.id)||row.id<=0||row.company_name!==config.companyName))fail('native identity or employer mismatch')
  if(!firstParty||Object.keys(firstParty).sort().join(',')!=='filterFields,jobs'||!Array.isArray(firstParty.jobs)
      ||!equal(firstParty.jobs.map(row=>row.id).sort(),records.map(row=>row.id).sort()))fail('first-party and complete native identities disagree')
  const criteriaById=new Map(),roleReasons=new Map()
  if(!equal(firstParty.filterFields,config.reviewedFirstPartyFilterFields))reasons.push('unreviewed-first-party-filter-field-contract')
  for(const row of records){
    if(!isGreenhouseProspectPost(row)&&(!Number.isSafeInteger(row.internal_job_id)||row.internal_job_id<=0))fail('invalid native employment identity: '+row.id)
    if(!nativeDate(row.first_published)||!nativeDate(row.updated_at))fail('invalid native date: '+row.id)
    let roleUrl;try{roleUrl=new URL(row.absolute_url)}catch{fail('invalid native role URL: '+row.id)}
    if(roleUrl.protocol!=='https:'||roleUrl.username||roleUrl.password||roleUrl.port||roleUrl.search||roleUrl.hash
      ||!['boards.greenhouse.io','job-boards.greenhouse.io'].includes(roleUrl.hostname)||roleUrl.pathname!==`/tenableinc/jobs/${row.id}`
      ||typeof row.title!=='string'||!row.title.trim())fail('invalid native role identity: '+row.id)
    const fp=firstParty.jobs.find(fp=>fp.id===row.id)
    if(!equal(fp._raw,row)||fp.title!==row.title||fp.url!==row.absolute_url||fp.content!==row.content)fail('first-party original raw identity, criteria or metadata disagree: '+row.id)
    const full=criteria(row),unknown=[...schemaReasons(row,config.recordSchema),...schemaReasons(fp,config.firstPartySchema),...metadataReasons(row),...full.reasons]
    const {_raw,...projection}=fp
    if(hash(projection)!==config.reviewedFirstPartyProjection[String(row.id)])unknown.push('unreviewed-first-party-visible-projection')
    const geography={nativeLocationLabels:greenhouseLocationLabels(row),nativeCountryLabels:greenhouseCountryLabels(row),
      officeIds:row.offices.map(office=>office.id),criteriaSha256:hash(row.content)}
    const reviewedGeography=config.reviewedRoleGeography[String(row.id)]
    if(!reviewedGeography||!equal(geography,reviewedGeography))unknown.push('unreviewed-native-role-geography-or-criteria-contract')
    criteriaById.set(String(row.id),full);roleReasons.set(String(row.id),unknown)
    if(unknown.length)reasons.push('unreviewed-native-role-schema-or-criteria:'+row.id)
  }
  const officeShape=schemaReasons(offices,config.officeSchema)
  if(officeShape.length)reasons.push('unreviewed-current-office-payload-schema')
  const countryAudit=auditTenableOfficeCountries(offices,records,provider,config,openingEmployer.renderer)
  reasons.push(...countryAudit.reasons)
  const native=createRuntimeVerifiedPublicAtsScraper(provider)
  const nativeJobs=await native.run({signal,fetchPage:async url=>({status:200,url,html:url===config.officialUrl?openingEmployer.official:openingEmployer.search}),fetchJson:async()=>openingPayload})
  const strongRuntimeEvidence=readInventoryEvidence(nativeJobs)
  const provenIndiaIds=countryAudit.proofs.filter(proof=>proof.countries.includes('IN')&&!proof.reasons.length).map(proof=>proof.jobId).sort()
  if(!equal(provenIndiaIds,nativeJobs.map(job=>String(job.jobId)).sort()))reasons.push('strong-engine-and-proven-native-india-cohorts-disagree')
  const details=async target=>{for(const row of records){const url=`https://boards-api.greenhouse.io/v1/boards/tenableinc/jobs/${row.id}?content=true`,detail=await json(url);if(!equal(detail,row))fail('complete native role detail identity, criteria or metadata drift: '+row.id);target.push({id:String(row.id),url,payload:detail})}}
  await details(audit.details)
  const advertised=advertisedRoles(openingEmployer.official),currentIds=new Set(records.map(row=>String(row.id)))
  const reconcileAdvertised=async(advertised,target)=>{for(const role of advertised.filter(role=>!currentIds.has(role.id))){
    if(!config.closedAdvertisedIds.includes(role.id)){reasons.push('unreconciled-advertised-native-role:'+role.id);continue}
    const apiUrl=`https://boards-api.greenhouse.io/v1/boards/tenableinc/jobs/${role.id}?content=true`
    const result=await request(apiUrl,{allowed:[200,404]});let payload;try{payload=JSON.parse(result.body)}catch{fail('invalid unavailable native role envelope')}
    const nativeUnavailable=result.response.status===404&&payload.status===404&&payload.error==='Job not found'&&Object.keys(payload).sort().join(',')==='error,status'
    const original=await request(role.url,{allowed:[301],redirect:'manual'}),canonical=`https://job-boards.greenhouse.io/tenableinc/jobs/${role.id}`
    if(original.response.headers.get('location')!==canonical)fail('advertised role redirect authority changed')
    const terminal=await request(canonical,{allowed:[302],redirect:'manual'})
    if(terminal.response.headers.get('location')!=='/tenableinc?error=true')fail('advertised role terminal state changed')
    const errorUrl='https://job-boards.greenhouse.io/tenableinc?error=true',boardError=await request(errorUrl)
    if(!/Tenable/.test(boardError.body))fail('terminal board employer identity unavailable')
    const proof={...role,nativeApiUrl:apiUrl,nativeStatus:result.response.status,nativeErrorPayload:payload,canonicalUrl:canonical,errorUrl,nativeUnavailable}
    target.push(proof)
    if(!nativeUnavailable)reasons.push('advertised-native-role-unavailable-state-unproven:'+role.id)
  }
  if(advertised.filter(role=>!currentIds.has(role.id)).some(role=>!target.some(proof=>proof.id===role.id&&proof.nativeUnavailable)))reasons.push('advertised-native-identities-unreconciled')
  }
  await reconcileAdvertised(advertised,audit.unavailableAdvertisedRoles)
  const closingPayload=await json(config.apiUrl),closingFirstParty=await json(config.firstPartyApiUrl),closingOffices=await json(config.officeUrl),closingEmployer=await employer()
  if(!equal(openingPayload,closingPayload)||!equal(firstParty,closingFirstParty)||!equal(offices,closingOffices))fail('whole unfiltered native/first-party/office inventory or criteria changed during closing')
  if(!equal(openingEmployer.scopeSignatures,closingEmployer.scopeSignatures))reasons.push('corporate-publisher-scope-changed')
  if(!equal(advertisedRoles(openingEmployer.official),advertisedRoles(closingEmployer.official)))reasons.push('advertised-native-role-identities-changed')
  await reconcileAdvertised(advertisedRoles(closingEmployer.official),audit.closingUnavailableAdvertisedRoles)
  if(!equal(audit.unavailableAdvertisedRoles,audit.closingUnavailableAdvertisedRoles))reasons.push('advertised-native-terminal-state-changed')
  await details(audit.closingDetails)
  const closingNative=await native.run({signal,fetchPage:async url=>({status:200,url,html:url===config.officialUrl?closingEmployer.official:closingEmployer.search}),fetchJson:async()=>closingPayload})
  if(!equal(nativeJobs.map(row=>row.jobId).sort(),closingNative.map(row=>row.jobId).sort()))fail('strong native selected role cohort changed')
  // The strong runtime's intact raw-feed validation is retained. Its older
  // exact-link/office-country coverage is supplemented only by the actual
  // first-party renderer, native terminal states, and current reciprocal IDs.
  const complete=reasons.length===0
  const jobs=nativeJobs.map(job=>{const row=records.find(row=>String(row.id)===String(job.jobId)),country=countryAudit.proofs.find(proof=>proof.jobId===String(job.jobId));const failures=[...(roleReasons.get(String(job.jobId))||[]),...(country?.reasons||[])];return {...job,source:'tenable',company:row.company_name,companyCareerPage:config.officialUrl,
    sourceNativePayload:row,sourceNativeDetailPayload:audit.details.find(detail=>detail.id===String(job.jobId))?.payload,jobDescription:criteriaById.get(String(job.jobId)).visible,
    sourceDetailComplete:failures.length===0,sourceDetailFailureReasons:failures,sourceListingComplete:complete,sourceScopeComplete:complete,lifecycleCleanupAllowed:complete}})
  Object.assign(audit,{openingPayload,closingPayload,firstPartyPayload:firstParty,closingFirstPartyPayload:closingFirstParty,openingOffices:offices,closingOffices,
    openingEmployer,closingEmployer,rendererProof:openingEmployer.renderer,strongRuntimeEvidence,closingStrongRuntimeEvidence:readInventoryEvidence(closingNative),
    nativeRecordCount:records.length,vacancyCount:records.filter(row=>!isGreenhouseProspectPost(row)&&row.isListed!==false).length,prospectIds,
    prospectRecords:records.filter(isGreenhouseProspectPost),officeCountryProofs:countryAudit.proofs,officeCountryAudit:countryAudit,
    rawCountryValuesPreserved:true,complete,sourceScopeComplete:complete,lifecycleCleanupAllowed:complete,reasons:[...new Set(reasons)]})
  onAudit?.(structuredClone(audit));signal?.throwIfAborted()
  return attachInventoryEvidence(jobs,{status:complete?'complete-inventory':'coverage-gap',surface:config.apiUrl,firstParty:true,listingComplete:complete,
    pagesFetched:audit.receipts.length,reportedTotal:complete?audit.vacancyCount:null,indiaFacetCount:complete?jobs.length:null,verifiedAt:new Date().toISOString(),
    reason:complete?'current-first-party-renderer-and-global-GH-office-country-prospect-detail-terminal-and-closing-reconciled':'tenable-source-incomplete:'+audit.reasons.join(';')})
}
