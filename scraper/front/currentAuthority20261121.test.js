import test from 'node:test'
import assert from 'node:assert/strict'
import {getScraperCatalog} from '../../scraper-support/providers/index.js'
import {recoverSoftFailedRecruitment} from '../../scraper-support/utils/softFailureRecruitmentRecovery.js'
import {recoverEmptyOnlyRecruitment} from '../../scraper-support/utils/emptyOnlyRecruitmentRecovery.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
for(const source of ['front','jasper'])test(source+' keeps native errors and empty evidence without generic acquisition',async()=>{
 const provider=getScraperCatalog().find(p=>p.source===source);assert.equal(provider.authoritativeCurrentPublication,true)
 let reads=0;const blocked=()=>{reads++;assert.fail('Unexpected generic recovery read')}
 const error=Object.assign(Error('Exact current native qualification held'),{softFailure:true,failureKind:'coverage_gap',abortRetries:true})
 assert.equal(await recoverSoftFailedRecruitment(error,provider,{softFailureRecovery:{fetchPage:blocked}}),null)
 const jobs=attachInventoryEvidence([],{status:'coverage-gap',surface:provider.companyCareerPage,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:1,verifiedAt:new Date().toISOString(),reason:'qualified current native hold'})
 const audit={source,held:true};Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit})
 assert.equal(await recoverEmptyOnlyRecruitment(jobs,provider,{emptyOnlyRecovery:{fetchPage:blocked}}),jobs)
 assert.equal(jobs.nativeCollectionEvidence,audit);assert.equal(reads,0);assert.equal(error.softFailureRecruitmentRecovery,undefined)
})
