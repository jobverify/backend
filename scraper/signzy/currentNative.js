import {createHash} from 'node:crypto'
import {createVerifiedFirstPartyKekaScraper} from '../../scraper-support/shared/verifiedFirstPartyKeka.js'
import {createCurrentSourceScope,hasLiteralActiveKekaConfiguration,unhandledKekaGeography,finishCurrentKekaInventory} from '../../scraper-support/shared/kekaCurrentSourceScope.js'
import {readNativeDocument,extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {validateClientBinding} from './clientBinding.js'
import config from './currentConfig.json' with {type:'json'}

const hash=value=>createHash('sha256').update(value).digest('hex')
const clean=value=>typeof value==='string'?value.replace(/\s+/g,' ').trim():''
const fail=message=>{throw new Error(`Signzy native inventory: ${message}`)}
const root=config.kekaRootUrl
const board=root+'api/jobs/default/active'
const embed=root+'api/embedjobs/default/active/'+config.identifier
const knownFields=new Set(['id','title','description','departmentIdentifier','departmentName','excerpt','jobLocations','jobType','experience','jobNumber','salaryRange','salaryRangeFormat','publishedOn','publishedSinceDays','skillNames'])
const salaryFields=new Set(['currency','salaryPeriod','cultureInfo','minimum','maximum'])
const locationFields=new Set(['id','name','city','state','countryCode','countryName'])
const regions=new Intl.DisplayNames(['en'],{type:'region',fallback:'none'})
const descriptionProof=role=>config.descriptionLocationRules.find(rule=>rule.id===String(role.id)&&rule.title===role.title
  &&hash(role.description)===rule.descriptionSha256&&extractActiveDescription(role.description)?.includes('Location: Bangalore, India'))

function roleLocations(role) {
  const seen=new Set()
  return role.jobLocations.map(location=>{
    const id=String(location?.id??''),name=clean(location?.name),city=clean(location?.city)
    const code=clean(location?.countryCode),country=clean(location?.countryName)
    if(!/^[1-9]\d*$/.test(id)||!Number.isSafeInteger(Number(id))||seen.has(id)||(!name&&!city)
        ||!/^[A-Z]{2}$/.test(code)
        ||['ZZ','XA','XB','UN','EU','EZ','QO'].includes(code)||!country)fail(`invalid typed country or location identity for ${role.id}`)
    seen.add(id)
    const canonical=regions.of(code),aliases=code==='US'?['usa','united states of america']:code==='GB'?['uk']:[]
    if(!canonical||canonical===code||(canonical.toLowerCase()!==country.toLowerCase()&&!aliases.includes(country.toLowerCase())))fail(`conflicting native country for ${role.id}`)
    return {...location,name:name||city,city:city||null,state:typeof location.state==='string'?location.state:null}
  })
}

function inspectRole(role) {
  if(!role||typeof role!=='object'||Array.isArray(role)||!Number.isSafeInteger(role.id)||role.id<=0||!clean(role.title))fail('invalid role identity')
  if(typeof role.description!=='string'||!extractActiveDescription(role.description))fail(`missing actual full criteria for ${role.id}`)
  const doc=readVisibleNativeDocument(role.description,{strict:true}),visible=doc.text(doc.nodes(n=>n.tag==='root')[0])
  if(clean(visible)!==clean(extractActiveDescription(role.description)))fail(`hidden native criteria for ${role.id}`)
  if(!Array.isArray(role.jobLocations))fail(`invalid native country array for ${role.id}`)
  if(typeof role.publishedOn!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{1,3}Z$/.test(role.publishedOn)
      ||!Number.isFinite(Date.parse(role.publishedOn))||new Date(role.publishedOn).toISOString()!==role.publishedOn.replace(/\.(\d{1,3})Z$/,(_,digits)=>'.'+digits.padEnd(3,'0')+'Z'))fail(`invalid native date for ${role.id}`)
  if(!Number.isInteger(role.jobType)||![0,1,2,3,4,5,6].includes(role.jobType)||(role.experience!=null&&typeof role.experience!=='string')
      ||typeof role.departmentName!=='string'||typeof role.departmentIdentifier!=='string'||typeof role.jobNumber!=='string'
      ||typeof role.excerpt!=='string'||typeof role.salaryRangeFormat!=='string'||!Number.isInteger(role.publishedSinceDays)
      ||role.publishedSinceDays<0||!Array.isArray(role.skillNames)||role.skillNames.some(s=>!clean(s)))fail(`invalid native criteria metadata for ${role.id}`)
  if(!role.salaryRange||typeof role.salaryRange!=='object'||Array.isArray(role.salaryRange))fail(`invalid salary metadata for ${role.id}`)
  if(typeof role.salaryRange.currency!=='string'||typeof role.salaryRange.cultureInfo!=='string'
      ||!Number.isInteger(role.salaryRange.salaryPeriod)||role.salaryRange.salaryPeriod<0)fail(`invalid salary criteria metadata for ${role.id}`)
  for(const key of ['minimum','maximum'])if(role.salaryRange[key]!=null&&(!Number.isFinite(role.salaryRange[key])||role.salaryRange[key]<0))fail(`invalid salary ${key} for ${role.id}`)
  const schemaUnknown=Object.keys(role).filter(key=>!knownFields.has(key))
  schemaUnknown.push(...Object.keys(role.salaryRange).filter(key=>!salaryFields.has(key)).map(key=>'salaryRange.'+key))
  for(const[at,location]of role.jobLocations.entries()){
    const prefix=`jobLocations[${at}]`
    schemaUnknown.push(...Object.keys(location||{}).filter(key=>!locationFields.has(key)).map(key=>`${prefix}.${key}`))
    // A known scalar field can conceal an unreviewed schema just as readily as
    // an added key. Preserve its original value; never coerce an object into a
    // missing city and then manufacture a city from the location label.
    for(const field of ['name','city','state','countryCode','countryName']){
      const value=location?.[field]
      const valid=Object.hasOwn(location||{},field)&&(typeof value==='string'||field==='state'&&value===null)
      if(!valid){
        schemaUnknown.push(`${prefix}.${field}:expected-${field==='state'?'nullable-':''}string`)
        const retainPaths=(child,base)=>{if(!child||typeof child!=='object')return;for(const[key,nested]of Object.entries(child)){schemaUnknown.push(base+'.'+key);retainPaths(nested,base+'.'+key)}}
        retainPaths(value,`${prefix}.${field}`)
      }
    }
  }
  const proof=!role.jobLocations.length?descriptionProof(role):null
  const unresolved=[...new Set([...schemaUnknown,...unhandledKekaGeography(role)])].filter(path=>!(proof&&path==='jobLocations'))
  if(hash(role.description)!==config.reviewedRoleDescriptionSha256[String(role.id)])unresolved.push('description.unreviewed-geography-and-criteria')
  const descriptionGeography=config.descriptionCountryAlternatives.filter(rule=>rule.id===String(role.id)
    &&rule.title===role.title&&rule.descriptionSha256===hash(role.description)&&visible.includes(rule.raw))
  if(descriptionGeography.length)unresolved.push('description.unrepresented-country-alternative')
  return {visible,unresolved,locations:roleLocations(role),descriptionCountryProof:proof,descriptionGeography}
}

function mapPartialRole(native) {
  const {role,visible,locations,descriptionCountryProof:proof}=native
  const india=locations.filter(location=>location.countryCode==='IN')
  if(!india.length&&!proof)return null
  const selected=india.length?india:[proof.location],primary=selected[0]
  const render=location=>[location.name,clean(location.state),'India'].filter(Boolean).join(', ')
  const url=root+'jobdetails/'+role.id
  return {source:'signzy',company:'Signzy',companyCareerPage:config.officialUrl,companyDomain:'signzy.com',atsPlatform:'keka',
    jobId:String(role.id),requisitionId:clean(role.jobNumber)||String(role.id),title:clean(role.title),
    location:render(primary),locations:selected.map(render),city:primary.city,state:clean(primary.state)||null,country:'India',
    sourceUrl:url,applyUrl:url,link:url,jobDescription:visible,experienceRequired:clean(role.experience)||null,
    department:clean(role.departmentName)||null,employmentType:role.jobType===2?'Full Time':null,requiredSkills:role.skillNames,
    postingDate:new Date(role.publishedOn).toISOString(),closingDate:null,publicExperienceChecked:true,
    sourceListingComplete:false,scrapedAt:new Date().toISOString()}
}

function validateDetail(html,role) {
  const raw=readNativeDocument(html),doc=readVisibleNativeDocument(html,{strict:true})
  const identities=raw.nodes(n=>Object.hasOwn(n.attrs,'selectedjobid')).map(n=>n.attrs.selectedjobid)
  const titles=doc.nodes(n=>n.tag==='h1'&&Object.hasOwn(n.attrs,'title'))
  const descriptions=doc.nodes(n=>doc.hasClass(n,'job-description-container'))
  if(!identities.length||identities.some(id=>id!==String(role.id))||titles.length!==1||descriptions.length!==1
      ||clean(doc.text(titles[0]))!==clean(role.title)||clean(titles[0].attrs.title)!==clean(role.title)
      ||clean(doc.text(descriptions[0]))!==clean(extractActiveDescription(role.description)))fail(`visible detail identity or full criteria disagreement for ${role.id}`)
  return doc.text(descriptions[0])
}

export async function run({fetchImpl=fetch,signal,onAudit,fetchText,fetchPage,fetchJson,maxPages,maxJobs}={}) {
  if(fetchText!==undefined||fetchPage!==undefined||fetchJson!==undefined)fail('legacy body-only transport is unsupported')
  if(maxPages!==undefined||maxJobs!==undefined)fail('inventory caps are unsupported')
  const scope=createCurrentSourceScope({baselines:config.baselines,kekaRootUrl:root})
  const unreviewedStyles=new Set()
  let engineExpectedRaw=null
  const audit={source:'signzy',productionWrites:false,openingRecords:null,closingRecords:null,details:[],closingDetails:[],unresolvedNativeRoles:[],requests:[],clientBindings:[]}
  const request=async url=>{
    signal?.throwIfAborted()
    const timeout=AbortSignal.timeout(20000)
    const response=await fetchImpl(url,{signal:signal?AbortSignal.any([signal,timeout]):timeout,headers:{Accept:'application/json,text/html,application/javascript,text/css','User-Agent':'JobverifyScraper/1.0'}})
    if(response.status!==200||response.url!==url)fail(`HTTP or redirect identity for ${url}`)
    const body=await response.text();signal?.throwIfAborted();timeout.throwIfAborted()
    audit.requests.push({url,status:response.status,responseUrl:response.url,sha256:hash(body)})
    if(config.baselines[url])scope.observe(url,body)
    if(config.baselines.$renderers[url]){
      scope.observeRenderer(url,body)
      if(/\.css(?:\?|$)|fonts.googleapis.com\/css/.test(url)&&hash(body)!==config.baselines.$renderers[url])unreviewedStyles.add(url)
    }
    return body
  }
  const assets=async()=>{
    const bodies=new Map()
    for(const url of config.assets)bodies.set(url,await request(url))
    return bodies
  }
  const corporate=await request(config.officialUrl),openingAssets=await assets()
  audit.clientBindings.push(validateClientBinding({corporateHtml:corporate,routeBody:openingAssets.get(config.routeUrl),bridgeBody:openingAssets.get(config.bridgeUrl)}))
  const shellUrl=root.slice(0,-1),shell=await request(shellUrl)
  const shellDoc=readNativeDocument(shell)
  const declarations=shellDoc.nodes(n=>n.tag==='script'&&!n.attrs.src).flatMap(n=>[...(n.raw||'').matchAll(/fetch\(\s*['"]([^'"]+careerportal\/[^'"]+\.html)['"]/g)].map(m=>new URL(m[1],shellUrl).href))
  if(declarations.length!==1||declarations[0]!==config.portalDocumentUrl)fail('actual portal document identity changed')
  const portal=await request(config.portalDocumentUrl)
  if(!hasLiteralActiveKekaConfiguration(portal,config))fail('inactive actual native portal configuration')
  // The strongest existing mapper receives only real, fetched portal bytes.
  // Publisher ownership was established above through the corporate client page.
  const engine=createVerifiedFirstPartyKekaScraper({...config,officialUrl:config.portalDocumentUrl})
  const engineFetch=async(url,options)=>{
    const body=await request(String(url))
    if(String(url)===embed&&JSON.stringify(JSON.parse(body))!==JSON.stringify(engineExpectedRaw))fail('strong engine native criteria cohort changed from the original full array')
    return {status:200,ok:true,url:String(url),text:async()=>body,json:async()=>JSON.parse(body)}
  }
  const portalInfo=JSON.parse(await request(root+'api/organization/default/careerportalinfo'))
  if(portalInfo.name!==config.portalIdentity.name||portalInfo.shortName!==config.portalIdentity.shortName
      ||portalInfo.careersPortalDomain!==config.portalIdentity.domain)fail('native employer identity changed')
  audit.portalIdentity=portalInfo
  for(const url of [root+'api/organization/grouplinkstatus',root+'api/embedjobs/grouplinkstatus/'+config.identifier]){
    const body=JSON.parse(await request(url))
    if(!body||Array.isArray(body)||Object.keys(body).length!==1||body.isGroupLinked!==false)fail('unresolved grouped employer scope')
  }
  const rawBody=await request(board),raw=JSON.parse(rawBody)
  if(!Array.isArray(raw)||JSON.stringify(JSON.parse(await request(embed)))!==JSON.stringify(raw))fail('unfiltered board and embedded inventories disagree')
  audit.openingRecords=raw
  engineExpectedRaw=raw
  const seen=new Set(),byId=new Map(),unknown=[]
  for(const role of raw){if(seen.has(role.id))fail('duplicate raw role identity');seen.add(role.id);const result=inspectRole(role);byId.set(String(role.id),{role,...result});if(result.unresolved.length)unknown.push({id:role.id,paths:result.unresolved,payload:role});const url=root+'jobdetails/'+role.id;const html=await request(url);const description=validateDetail(html,role);audit.details.push({id:role.id,url,sha256:hash(html),html,description})}
  // Unknown roles never receive fabricated geography and the full native feed
  // is never rewritten for the shared engine. Its current full-array contract
  // rejects missing locations; retain that contract and name the bounded path.
  const partial=unknown.length>0
  const jobs=partial?[...byId.values()].map(mapPartialRole).filter(Boolean):await engine.run({fetchImpl:engineFetch,signal})
  audit.validationMode=partial?'source-local-strict-partial':'unchanged-verified-first-party-keka-full-array'
  const expectedIndia=[...byId.values()].filter(native=>native.locations.some(loc=>loc.countryCode==='IN')||native.descriptionCountryProof).map(native=>String(native.role.id)).sort()
  if(JSON.stringify(jobs.map(job=>job.jobId).sort())!==JSON.stringify(expectedIndia))fail('strong engine and complete raw India identity cohorts disagree')
  for(const job of jobs){
    const native=byId.get(job.jobId)
    if(job.title!==clean(native.role.title)||job.country!=='India')fail('mapped native identity mismatch')
    Object.assign(job,{companyCareerPage:config.officialUrl,companyDomain:'signzy.com',jobDescription:native.visible,
      sourceScopeComplete:true,sourceDetailComplete:native.visible.length>=80&&!native.unresolved.length,
      sourceNativePayload:native.role,sourceNativeInventorySha256:hash(rawBody),sourceNativePortalDocumentUrl:config.portalDocumentUrl,
      sourceNativeDescriptionSha256:hash(native.role.description),sourceNativeAllLocations:native.role.jobLocations,
      sourceNativeDescriptionGeography:native.descriptionGeography,
      sourceNativeUnknownSchemaPaths:native.unresolved,sourceCountryEvidence:native.descriptionCountryProof?{
        kind:'exact-role-visible-description-country-location-header',roleId:String(native.role.id),
        roleLocationHeader:'Location: Bangalore, India',originalNativeLocations:native.role.jobLocations,
        nativeDescriptionSha256:hash(native.role.description),location:native.descriptionCountryProof.location
      }:{kind:'native-country-code-and-name',locations:native.role.jobLocations}})
    if(!job.sourceDetailComplete)job.sourceDetailFailureKind=native.unresolved.length?'unreviewed-native-schema':'limited-source-content'
  }
  const closingCorporate=await request(config.officialUrl),closingAssets=await assets()
  audit.clientBindings.push(validateClientBinding({corporateHtml:closingCorporate,routeBody:closingAssets.get(config.routeUrl),bridgeBody:closingAssets.get(config.bridgeUrl)}))
  const closingPortal=await request(config.portalDocumentUrl)
  if(!hasLiteralActiveKekaConfiguration(closingPortal,config))fail('closing native configuration is inactive')
  const closingShell=await request(shellUrl)
  if(hash(closingShell)!==hash(shell))fail('closing actual native shell or portal document handoff changed')
  for(const url of [root+'api/organization/grouplinkstatus',root+'api/embedjobs/grouplinkstatus/'+config.identifier]){
    const current=JSON.parse(await request(url));if(JSON.stringify(current)!=='{"isGroupLinked":false}')fail('closing grouped employer scope changed')
  }
  const closing=JSON.parse(await request(board)),closingEmbed=JSON.parse(await request(embed))
  audit.closingRecords=closing
  if(JSON.stringify(closing)!==JSON.stringify(raw)||JSON.stringify(closingEmbed)!==JSON.stringify(raw))fail('full native criteria or identity inventory changed during closing reconciliation')
  if(JSON.stringify(JSON.parse(await request(root+'api/organization/default/careerportalinfo')))!==JSON.stringify(portalInfo))fail('closing native employer metadata changed')
  for(const role of closing){const url=root+'jobdetails/'+role.id,html=await request(url);const description=validateDetail(html,role);audit.closingDetails.push({id:role.id,url,sha256:hash(html),html,description})}
  audit.unresolvedNativeRoles=unknown
  audit.unresolvedCountryRoleIds=raw.filter(role=>!role.jobLocations.length&&!descriptionProof(role)).map(role=>String(role.id))
  audit.alternativeCountryScopeRoleIds=[...byId.values()].filter(native=>native.descriptionGeography.length).map(native=>String(native.role.id))
  if(unreviewedStyles.size||[...scope.gaps].some(reason=>reason.startsWith('changed-active-styles:'))){
    for(const job of jobs){job.sourceDetailComplete=false;job.sourceDetailFailureKind='unreviewed-source-styles';job.sourceUnreviewedStyles=[...unreviewedStyles]}
  }
  if(scope.gaps.size||unknown.length)for(const job of jobs)job.sourceScopeComplete=false
  audit.scopeReasons=[...scope.gaps];audit.nativeTotal=raw.length;audit.complete=!scope.gaps.size&&!unknown.length
  audit.sourceScopeComplete=audit.complete;audit.lifecycleCleanupAllowed=audit.complete
  audit.finishedAt=new Date().toISOString()
  onAudit?.(audit)
  return finishCurrentKekaInventory(jobs,{raw,unknown,scope,evidence:{surface:board,firstParty:true,pagesFetched:audit.requests.length,
    verifiedAt:audit.finishedAt,reason:'current-corporate-Flight-default-page-NextScript-native-document-strong-engine-typed-countries-full-visible-detail-and-global-closing-reconciled'}})
}
