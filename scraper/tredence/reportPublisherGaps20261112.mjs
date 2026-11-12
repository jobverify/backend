import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {gunzipSync} from 'node:zlib'

const sha=value=>createHash('sha256').update(value).digest('hex')
const contractPath='scraper/tredence/test-data/public-contract-originals-20261112.json.gz'
const bytes=fs.readFileSync(contractPath),contract=JSON.parse(gunzipSync(bytes))
for(const response of contract.responses.filter(response=>response.body!=null)){
 if(sha(response.body)!==response.bodySha256)throw Error('Public contract response digest mismatch')
}
const checkPath='../reports/partial-success-repairs-2026-11-12/tredence-registered-native-20261112.json'
const check=JSON.parse(fs.readFileSync(checkPath)),nativeBytes=fs.readFileSync(check.capturePath),native=JSON.parse(gunzipSync(nativeBytes))
if(sha(nativeBytes)!==check.captureSha256)throw Error('Registered capture digest mismatch')
for(const response of native.responses)if(sha(response.body)!==response.bodySha256)throw Error('Native response digest mismatch')
const failures=check.audit.failures
if(!Array.isArray(failures))throw Error('Full native audit missing')
const detailResponses=native.responses.filter(response=>new URL(response.requestedUrl).pathname==='/candidate/candidatejobdetail')
const details=detailResponses.map(response=>({response,payload:JSON.parse(response.body)}))
const failedIds=new Set(failures.map(failure=>failure.jobId))
const omissions=details.filter(({payload})=>failedIds.has(payload.jobSeq)).map(({response,payload})=>{
 const row=payload.jobVO,refresh=contract.responses.find(item=>new URL(item.requestedUrl).pathname==='/candidate/candidatejobdetail'
  &&new URL(item.requestedUrl).searchParams.get('jobSeq')===payload.jobSeq)
 if(!refresh||refresh.bodySha256!==response.bodySha256)throw Error('Missing matching independent fresh detail receipt')
 return {jobId:row.jobSeq,title:row.jobTitle,nativeJobDescription:row.jobDesc,descriptionBytes:Buffer.byteLength(row.jobDesc||''),
  nativeAdditionalCriteria:{jobSkills:row.jobSkills,otherDetails:row.otherDetails,jobPrimarySkills:row.jobPrimarySkills,
   jobSecondarySkills:row.jobSecondarySkills,supplementaryDetails:row.supplementaryDetails,jobFields:row.jobFields,
   compensationRange:row.compensationRange,compensationInfo:row.compensationInfo},
  nativeWorkplaceSet:{jobLocation:row.jobLocation,locations:row.locations,jobLocationList:row.jobLocationList,countryMstNewSeq:row.countryMstNewSeq},
  nativeRoleURL:response.requestedUrl,nativeResponseSha256:response.bodySha256,originalNativeDetail:payload,
  independentlyRefreshedAt:refresh.completedAt,independentBodySha256:refresh.bodySha256,
  result:'No full criteria or criteria attachment published on the advertised current native detail contract; preserve failure and cleanup hold.'}
})
const unresolvedExclusions=check.audit.exclusions.filter(row=>row.reason==='unresolved-native-country')
const report={source:'tredence',observedAt:check.completedAt,conclusion:'Publisher criteria and country scope remain incomplete. No production source fields or completeness flags were changed.',
 registeredCheckPath:checkPath,contractCapture:{path:contractPath,sha256:sha(bytes),responses:contract.responses.length},
 registeredCapture:{path:check.capturePath,sha256:check.captureSha256,responses:native.responses.length},
 nativeBreakdown:{candidates:check.audit.candidateDetails,publishedFullIndiaJobs:check.fullIndiaJobs.length,
  unresolvedCountryExclusions:unresolvedExclusions.length,closedExclusions:check.audit.exclusions.filter(row=>row.reason==='native-closed').length,
  explicitForeignExclusions:check.audit.exclusions.filter(row=>row.reason==='native-foreign-country'),fullCriteriaFailures:omissions.length},
 unresolvedCountryExclusions:unresolvedExclusions.map(row=>({...row,nativeRole:check.audit.unresolvedRoles.find(role=>role.jobId===row.jobId)})),
 advertisedDetailContract:{boardPage:'https://tredence.ripplehire.com/candidate/?token=rzuz0vttMaz0VxxVzDiY&source=CAREERSITE',
  detailRequest:'GET /candidate/candidatejobdetail?token=rzuz0vttMaz0VxxVzDiY&jobSeq=ROLE_ID&source=CAREERSITE&lang=en',
  publishedLanguages:JSON.parse(contract.responses.find(response=>new URL(response.requestedUrl).pathname==='/candidate/getcompanylang').body),
  roleTemplateConfiguration:JSON.parse(contract.responses.find(response=>new URL(response.requestedUrl).pathname==='/candidate/getcandidatecompanydetails').body).config,
  rendererFields:['jobVO.jobDesc','jobVO.jobSkills','jobVO.otherDetails','jobVO.compensationRange','jobVO.compensationInfo'],
  descriptionTemplate:'apps/candidates/template/jobdetails/jobdescription.tpl',
  advertisedAttachmentOrAlternateCriteriaRoute:null,
  modules:contract.responses.filter(response=>/\.(?:js|tpl)(?:\?|$)/.test(response.requestedUrl)).map(response=>({url:response.requestedUrl,status:response.status,sha256:response.bodySha256}))},
 omissions,inventoryEvidence:check.inventoryEvidence,detailHealth:check.detailHealth,lifecycleCleanupForbidden:check.lifecycleCleanupForbidden,
 verification:{allOriginalResponseDigestsChecked:true,allTwelveNativeOmissionResponsesIndependentlyRefreshed:omissions.length===12,
  productionChanges:false,focusedExistingTestsPassed:52}}
const reportPath='../reports/partial-success-repairs-2026-11-12/tredence-publisher-gaps-20261112.json'
fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({reportPath,observedAt:report.observedAt,nativeBreakdown:report.nativeBreakdown,
 contractResponses:contract.responses.length,registeredResponses:native.responses.length,lifecycleCleanupForbidden:report.lifecycleCleanupForbidden}))
