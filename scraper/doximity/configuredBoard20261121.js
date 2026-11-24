import {isDeepStrictEqual} from 'node:util'
import {PRIMARY,EMBED,BOARD} from './data20261108.js'

const PUBLIC='https://job-boards.greenhouse.io/doximity'
const ids=(values,key)=>{
 if(!Array.isArray(values))return null
 const result=values.map(value=>String(value?.[key]??''))
 return result.every(value=>/^[1-9]\d*$/.test(value)&&Number.isSafeInteger(Number(value)))&&new Set(result).size===result.length?result.sort():null
}
const equalIds=(values,key,expected)=>{
 const actual=ids(values,key)
 return Boolean(actual&&expected&&isDeepStrictEqual(actual,expected))
}

// This is the boundary of one declared public account. The existing readers
// have already parsed the original authority, API and hosted carriers. Their
// paired facts must all survive final admission; no output flag supplies proof.
export function qualifyDoximityConfiguredBoard({opening,closing,apiAudit,apiListingHistory,rows,jobs,maxJobs,pagesFetched,responses,pendingReads,stopped,observedAt,admissionAt}){
 const reasons=[],reject=reason=>reasons.push(reason),total=opening?.nativeBoardTotal
 const memberIds=ids(opening?.records,'id')
 if(!Number.isSafeInteger(total)||total<1||!memberIds||memberIds.length!==total)reject('unqualified-positive-configured-total')
 for(const [name,part]of [['opening',opening],['closing',closing]]){
  const declaration=part?.declaration,handoff=part?.handoff,route=part?.route,root=part?.context?.state?.loaderData?.root,posts=route?.jobPosts
  if(part?.phase!==name||declaration?.primaryURL!==PRIMARY||declaration.embedURL!==EMBED||declaration.publisher!=='Doximity'||declaration.publisherProgramsExecuted!==false
   ||handoff?.boardURL!==BOARD||handoff.publisherProgramsExecuted!==false||handoff.applicationActions!==0
   ||handoff.originalSettings?.boardURI!==BOARD||handoff.originalSettings.targetDomain!=='https://job-boards.greenhouse.io'||handoff.originalSettings.autoLoad!==true||handoff.originalSettings.useEmbeddedInternalBoard!==false)reject(name+'-authority-or-public-handoff')
  if(!root||root.internal!==false||root.preview!==false||root.embedded!==true||root.isJobPost!==false||root.boardConfiguration?.job_board_public_url!==PUBLIC
   ||route?.internal!==false||route.urlToken!=='doximity'||route.board?.name!=='Doximity'||route.board.public_url!==PUBLIC||route.board.redirect_to!==null
   ||!isDeepStrictEqual(part?.context?.state?.loaderData?.['routes/embed.job_board'],route))reject(name+'-public-account-context')
  if(!Array.isArray(route?.departmentIds)||route.departmentIds.length||!Array.isArray(route?.officeIds)||route.officeIds.length
   ||!route?.customFieldFilters||Array.isArray(route.customFieldFilters)||Object.keys(route.customFieldFilters).length)reject(name+'-filtered-or-unknown-listing')
  if(part?.nativeBoardTotal!==total||!equalIds(part?.records,'id',memberIds)||!equalIds(posts?.data,'id',memberIds)
   ||posts?.count!==total||posts.total!==total||posts.page!==1||posts.total_pages!==1)reject(name+'-incomplete-membership-or-pages')
 }
 if(!isDeepStrictEqual(opening?.records,closing?.records))reject('opening-closing-record-drift')
 if(apiAudit?.opening?.qualified!==true||apiAudit?.closing?.qualified!==true||!equalIds(apiAudit?.observations,'jobId',memberIds)
  ||!equalIds(apiAudit?.observationHistory,'postId',memberIds)||!Array.isArray(apiListingHistory)||apiListingHistory.length!==2
  ||apiListingHistory.some(values=>!equalIds(values,'id',memberIds)))reject('unqualified-or-incomplete-paired-api-cohort')
 if(!equalIds(rows,'jobId',memberIds))reject('incomplete-final-observation-cohort')
 for(const row of Array.isArray(rows)?rows:[]){
  const history=apiAudit?.observationHistory?.find(value=>String(value.postId)===row.jobId)
  if(row.sourceNativePostKind!=='job'||row.sourceNativePublishedContractQualified!==true||row.sourceNativeRoleEvidencePairQualified!==true||row.sourceNativeTemporalQualified!==true
   ||row.sourceCurrentNativePostingIdentityQualified!==true||row.sourceCurrentNativeRoleQualified!==true||row.sourceDetailComplete!==true||row.nativeDescriptionVisibilityQualified!==true
   ||row.sourceNativeOwnHostedPageReadThisRun!==true||!row.sourceNativeOwnDescriptionHTML||!row.sourceNativeClosingOwnDescriptionHTML
   ||!Array.isArray(row.sourceNativeAPIModelHistory)||row.sourceNativeAPIModelHistory.length!==2
   ||!history?.earlier?.sourceNativeRecord||!history.current?.sourceNativeRecord
   ||!isDeepStrictEqual(history.earlier.sourceNativeRecord,history.current.sourceNativeRecord)
   ||!isDeepStrictEqual(row.sourceNativeAPIModelHistory[0],row.sourceNativeAPIModelHistory[1])
   ||!isDeepStrictEqual(row.sourceNativeRecord,history.current.sourceNativeRecord))reject('unqualified-paired-role-'+row.jobId)
  if(typeof row.country!=='string'||!row.country.trim()||row.sourceCountryScopeUnresolved!==false||row.sourceNativeCountryConflict!==false
   ||row.sourceNativeRoleLocationCriteriaEvidence?.conflict!==false||row.sourceNativeRoleLocationCriteriaEvidence.criteriaUsedToSupplyCountry!==false)reject('unknown-or-conflicting-country-'+row.jobId)
 }
 const expectedProjection=(Array.isArray(rows)?rows:[]).filter(row=>row.country==='India')
 if(maxJobs!==null||!equalIds(jobs,'jobId',ids(expectedProjection,'jobId')))reject('limited-or-unreconciled-configured-projection')
 if(!Number.isSafeInteger(pagesFetched)||pagesFetched<1||!Array.isArray(responses)||responses.length!==pagesFetched||pendingReads!==0||stopped!==null
  ||responses.some(receipt=>receipt?.response?.status!==200||receipt.requestedURL!==receipt.response.url||receipt.response.bodyComplete!==true
   ||receipt.response.bodyTruncated===true||receipt.response.acquisitionFailure||receipt.response.bodyUnavailableReason||typeof receipt.response.rawBodyBase64!=='string'))reject('incomplete-original-response-acquisition')
 const first=Date.parse(observedAt),last=Date.parse(admissionAt)
 if(!Number.isFinite(first)||!Number.isFinite(last)||first>last)reject('invalid-original-observation-clock')
 return {qualified:reasons.length===0,scope:'declared-unfiltered-public-account',account:'doximity',publisher:'Doximity',surface:BOARD,
  reportedTotal:reasons.length?null:total,observedConfiguredTotal:Number.isSafeInteger(total)&&total>0?total:null,indiaFacetCount:null,
  observedAt,admissionAt,reasons:[...new Set(reasons)],sourceScopeComplete:false,lifecycleCleanupAllowed:false,
  wholeCompanyQualified:false,indiaFacetQualified:false,activeHiringVerified:false,applicationActivationVerified:false}
}
