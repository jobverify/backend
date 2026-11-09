import reviewed from './reviewedSurfaces.json' with {type:'json'}
import {publicRead,requireNative,sha,structure,error} from './publicRead.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {inspectPublicMain,inspectPublicRuntime,inspectPublicInventory,unreviewedInlineRecruiting,inspectCorporateHandoff} from './publicClientContract.js'
import {cssContext,handoffStyleModel} from './handoffStyles.js'
const COMPANY='Alkem Laboratories',SOURCE='alkemlaboratories',corporate='https://www.alkemlabs.com/career',origin='https://alkem.turbohire.co',api='https://thapi-stage2.azurewebsites.net',orgId='be8cbaf5-58c9-4a69-8b97-b4e95133771f'
const check=(ok,message)=>requireNative(ok,COMPANY,message)
export const publicFilter=()=>({SortByV2:{Key:'PostedDate',Order:2},...Object.fromEntries(['BunitIds','Experience','JobTypes','JobTypeV2','Locations','CreatedDate','Compensation','Skills','ClientIds'].map(key=>[key,{Value:null,FilterType:0}])),Keyword:'',Department:'',CustomFields:{}})
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
function organization(value){
 check(value?.OrgID===orgId&&value.OrgName==='Alkem Laboratories Limited'&&value.OrgURL==='https://www.alkemlabs.com/'&&value.CareerPageSubdomain==='alkem'&&value.IsCareerPagePublished===true,'public organization employer or publication changed')
 const pages=value.CareerPages?.filter(p=>p.Type==='CAREER_PAGE');check(pages?.length===1&&pages[0].BannerText==='Alkem Careers','public career page employer binding changed')
 return{OrgID:value.OrgID,OrgName:value.OrgName,OrgURL:value.OrgURL,CareerPageSubdomain:value.CareerPageSubdomain,IsCareerPagePublished:value.IsCareerPagePublished,CareerPage:pages[0]}
}
function listing(value){
 check(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===2&&Object.hasOwn(value,'Total')&&Object.hasOwn(value,'Result'),'public listing envelope or continuation changed')
 check(Number.isSafeInteger(value.Total)&&value.Total>=0&&Array.isArray(value.Result)&&value.Total===value.Result.length,'native total and complete public array disagree')
 return value
}
export async function runCurrentAlkem(options={}){
 return publicRead({source:SOURCE,company:COMPANY},options,async scope=>{
  let token
  const nativeHeaders=()=>({Origin:origin,Referer:origin+'/',...(token?{Authorization:'Bearer '+token}:{})})
  const context=async phase=>{
   const html=await scope.read(corporate,{phase}),tree=structure(html)
   check(tree.doc.nodes(n=>n.tag==='title'&&/Alkem/i.test(tree.text(n))).length===1,'corporate employer title changed')
   const controls=tree.doc.nodes(n=>n.tag==='button'&&tree.text(n)==='SEARCH JOBS')
   check(controls.length===1,'active SearchJobs handoff control changed')
   check(!Object.hasOwn(controls[0].attrs,'disabled')&&controls[0].attrs['aria-disabled']!=='true','public SearchJobs control is disabled')
   const published=tree.scripts.filter(s=>s.executable&&s.attrs.src).map(s=>new URL(s.attrs.src,corporate)).filter(url=>url.origin==='https://www.alkemlabs.com'&&/^\/_next\/static\/chunks\/[^/]+\.js$/.test(url.pathname)),known=published.find(url=>url.href===reviewed.corporateClient.url)
   const candidates=[]
   for(const asset of known?[known]:published){const body=await scope.read(asset.href,{phase,kind:'javascript',retainBody:false});let candidate;try{candidate=inspectCorporateHandoff(body)}catch(cause){if(known||cause.code!=='PUBLIC_NATIVE_CONTRACT')throw cause;continue}candidates.push(candidate)}
   check(candidates.length===1,'current corporate SearchJobs executable handoff changed')
   const handoff=candidates[0];check(handoff.publicHandoffSHA256===reviewed.corporatePublicContract.publicHandoffSHA256,'public SearchJobs click target or interaction contract changed')
   const cssBodies=[],seenCSS=new Set(),readCSS=async(url,depth=0)=>{if(seenCSS.has(url))return;check(depth<=10&&seenCSS.size<50,'public handoff CSS dependency budget exceeded');check(/^https?:$/.test(new URL(url).protocol),'non-public handoff CSS URL');seenCSS.add(url);const body=await scope.read(url,{phase,kind:'css',retainBody:false});for(const target of cssContext(body).imports)await readCSS(new URL(target,url).href,depth+1);cssBodies.push(body)}
   for(const node of tree.nodes.filter(n=>n.tag==='link'&&n.attrs.rel==='stylesheet'&&n.attrs.media!=='print'))await readCSS(new URL(node.attrs.href,corporate).href)
   const styles={ssrStyles:handoffStyleModel(html,cssBodies),clientStyles:handoffStyleModel(html,cssBodies,{clientClassName:handoff.clientClassName})}
   check(styles.ssrStyles.active&&styles.clientStyles.active,'public SearchJobs effective CSS visibility context changed')
   const board=await scope.read(origin+'/',{phase}),native=structure(board)
   check(native.doc.nodes(n=>n.tag==='title'&&tree.text(n)==='Alkem Laboratories Limited').length===1&&native.doc.nodes(n=>n.tag==='div'&&n.attrs.id==='root').length===1,'public board employer identity or application root changed')
   const scripts=native.scripts.filter(s=>s.attrs.src).map(s=>({...s,url:new URL(s.attrs.src,origin)})),core=scripts.filter(s=>s.url.origin===origin)
   const shape=s=>/^(?:\/(runtime-main)\.[a-f0-9]{20}\.js|\/(18|30|main)\.[a-f0-9]{20}\.chunk\.js)$/.exec(s.url.pathname)?.slice(1).find(Boolean)
   check(core.length===reviewed.nativeCoreShapes.length&&core.every(s=>s.executable&&!s.url.search&&!s.url.hash)&&same(core.map(shape),reviewed.nativeCoreShapes),'public native executable application binding changed')
   check(!unreviewedInlineRecruiting(native.scripts).length,'unreviewed public native inline recruiting client')
   check(!native.scripts.some(s=>s.attrs.type==='application/ld+json'&&/JobPosting/.test(s.body)),'native structured public roles contradict an unreviewed empty shell')
   const main=core.find(s=>shape(s)==='main'),runtime=core.find(s=>shape(s)==='runtime-main')
   const publicMain=inspectPublicMain(await scope.read(main.url.href,{phase,kind:'javascript',retainBody:false}))
   check(same(publicMain,reviewed.publicClientContract.main),'public native API or employer router contract changed')
   const graph=inspectPublicRuntime(await scope.read(runtime.url.href,{phase,kind:'javascript',retainBody:false}),publicMain.publicChunkIds),inventory=[]
   for(const path of graph.urls)inventory.push(inspectPublicInventory(await scope.read(origin+path,{phase,kind:'javascript',retainBody:false})))
   const publicInventory={stores:inventory.flatMap(row=>row.stores).sort((a,b)=>a.moduleId.localeCompare(b.moduleId)),defaults:inventory.flatMap(row=>row.defaults).sort((a,b)=>a.fingerprint.localeCompare(b.fingerprint))}
   check(same(publicInventory,reviewed.publicClientContract.inventory),'public complete-array inventory controller or default filters changed')
   return{corporatePublicHandoff:handoff.publicHandoffSHA256,corporateHandoffActive:styles.ssrStyles.active&&styles.clientStyles.active,nativePublicContract:{main:publicMain,inventory:publicInventory},publicChunkIds:graph.publicChunkIds}
  }
  const openingContext=await context('initial')
  const anonymous=JSON.parse(await scope.read(api+'/api/token/noauth',{kind:'json',phase:'anonymous-public-reader',retainBody:false,headers:nativeHeaders()}))
  check(typeof anonymous.access_token==='string'&&anonymous.access_token.length>0&&anonymous.token_type?.toLowerCase()==='bearer'&&anonymous.expires_in>0&&anonymous.ShouldRedirect===false,'anonymous public visitor contract changed');token=anonymous.access_token
  const readPhase=async phase=>{
   const org=organization(JSON.parse(await scope.read(api+'/api/publicorganizations?accountName=alkem',{phase,kind:'json',headers:nativeHeaders()})))
   const jobs=listing(JSON.parse(await scope.read(api+'/api/careerpagev2/filteredjobs?orgId='+orgId+'&pageType=0',{phase,kind:'json',method:'POST',body:JSON.stringify(publicFilter()),headers:{...nativeHeaders(),'Content-Type':'application/json;charset=UTF-8'}})))
   return{org,jobs}
  }
  const initial=await readPhase('initial'),closingContext=await context('closing'),closing=await readPhase('closing')
  const closingReconciled=same(initial,closing)&&same(openingContext,closingContext),complete=closingReconciled&&initial.jobs.Total===0,stamp=scope.stamp()
  const observations=initial.jobs.Result.map(record=>({kind:'public-native-role-unreviewed',nativeRecord:record,sourceDetailComplete:false,country:null,postingDate:null}))
  const reason=!closingReconciled?'closing-native-employer-or-inventory-changed':complete?'current-corporate-SearchJobs-native-full-array-Total0-and-closing-reconciliation':'positive-public-native-records-require-full-criteria-country-identity-collector'
  const evidence={status:complete?'verified-empty':'coverage-gap',surface:corporate,firstParty:true,listingComplete:complete,pagesFetched:scope.publicPages.length,reportedTotal:complete?0:null,indiaFacetCount:complete?0:null,verifiedAt:stamp,reason}
  const jobs=attachInventoryEvidence([],evidence)
  if(!complete)attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:observations.length,observedVacancyCount:observations.length,sourceScopeComplete:false})
  await scope.audit({observations,observedGlobalCount:observations.length,nativeGlobalReportedTotal:initial.jobs.Total,closingReconciled,scopeComplete:complete,
   sourceInventoryScope:'current declared first-party Alkem TurboHire public CareerPage',openingOrganization:initial.org,closingOrganization:closing.org,
   openingListing:initial.jobs,closingListing:closing.jobs,anonymousSessionCredentialsRetained:false,applicationSubmitted:false,candidateActionsTaken:false,inventoryEvidence:evidence})
  if(!closingReconciled)throw error(COMPANY,reason)
  if(observations.length)throw error(COMPANY,reason,'PUBLIC_NATIVE_ROLE_COLLECTOR_REQUIRED')
  return jobs
 })
}
