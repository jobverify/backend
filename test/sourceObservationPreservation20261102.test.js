import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run as runMyClassboard} from '../scraper/myclassboard/script.js'
import {run as runInCred} from '../scraper/incred/script.js'
import {run as runSuperGaming} from '../scraper/supergaming/script.js'
import {buildScrapers} from '../scraper-support/providers/index.js'
import {buildScraperAttemptDiagnostics} from '../scraper-support/runner.js'
import {readSourceObservationEvidence} from '../scraper-support/utils/sourceObservationEvidence.js'
import {readInventoryEvidence,isVerifiedEmptyEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {extractionRawJobMetrics} from '../scraper-support/utils/extractionRawJobMetrics.js'
import {analyzePublishableJobs} from '../scraper-support/utils/publishableJobMetrics.js'

const packets = (source,names) => names.flatMap(name => JSON.parse(gunzipSync(
  readFileSync(new URL('../scraper/'+source+'/fixtures/'+name+'.json.gz',import.meta.url)),
)))
const scenarios = [
  {source:'myclassboard',run:runMyClassboard,count:21,returned:18,field:'nativeRecordCount',
    clock:'2026-10-23T18:00:00Z',status:'discovery-only',errorCode:'MYCLASSBOARD_COVERAGE_GAP',
    packets:packets('myclassboard',['fresh-native-comparison','current-corporate-pages','keka-shell','keka-native-board','native-job-details','native-applications-and-client']),
    invalid(packet) {
      if (!packet.url.includes('/api/embedjobs/default/active/')) return packet.body
      const rows=JSON.parse(packet.body)
      rows[1].id=rows[0].id
      return JSON.stringify(rows)
    },
    verify(jobs,rich) {
      assert.equal(rich.exclusions.length,3)
      const row=jobs.find(job=>job.jobId==='59073')
      assert.ok(row)
      assert.equal(row.postingDate,'2025-03-11T11:14:37.63Z')
      assert.equal(row.location,'Hyderabad, India')
      assert.equal(row.country,'India')
      assert.equal(row.nativeLocationCountryEvidence[0].locationId,1744)
    }},
  {source:'incred',run:runInCred,count:7,returned:6,field:'nativeRecordCount',
    clock:'2026-10-23T13:00:00Z',status:'coverage-gap',errorCode:'INCRED_COVERAGE_GAP',
    packets:packets('incred',['fresh-official-pages','native-employer','native-jobs']),
    invalid(packet) {
      return packet.url.includes('/company/')
        ? packet.body.replaceAll('urn:li:organization:13183871','urn:li:organization:7')
        : packet.body
    },
    verify(jobs) {
      assert.deepEqual(jobs.map(job=>[job.jobId,job.postingDate]),[
        ['4466103462','2026-10-14'],['4478423718','2026-10-14'],
        ['4481660379','2026-10-23'],['4475785487','2026-10-08'],
        ['4477511585','2026-10-12'],['4477990899','2026-10-13'],
      ])
      assert.ok(jobs.every(job=>job.country==='India'&&job.activeApplyVerified&&job.sourceDetailComplete))
    }},
  {source:'supergaming',run:runSuperGaming,count:1,returned:0,field:'nativeObservedRecordCount',
    clock:'2026-10-23T10:00:00Z',status:'discovery-only',errorCode:'SUPERGAMING_COVERAGE_GAP',
    packets:packets('supergaming',['official-employer-pages','native-employer-pages','gohire-board-pages','gohire-detail-pages','native-job-api-pages']),
    invalid(packet) {
      if (!packet.url.includes('widget-job?')) return packet.body
      const row=JSON.parse(packet.body)
      row.isGeneralPool=1
      return JSON.stringify(row)
    },
    verify(jobs,rich) {
      assert.equal(jobs.length,0)
      assert.equal(rich.nativeCandidates.length,1)
      assert.equal(rich.nativeCandidates[0].id,'291433')
      assert.equal(rich.nativeCandidates[0].postingDate,'2026-06-13')
      assert.equal(rich.nativeCandidates[0].closingDate,'2026-09-13')
      assert.equal(rich.nativeCandidates[0].exclusionReason,'native-expired')
    }},
]
const expected = scenario => ({
  source:scenario.source,recordKind:'vacancy-rows',
  observedRecordCount:scenario.count,observedVacancyCount:scenario.count,
  sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,
})
const replay = (scenario,calls,{invalid=false}={}) => async url => {
  calls.push(url)
  const packet=scenario.packets.find(packet=>packet.url===url)
  assert.ok(packet,'Uncaptured native request: '+url)
  const response=new Response(invalid?scenario.invalid(packet):packet.body,{status:packet.status})
  Object.defineProperty(response,'url',{value:packet.finalUrl})
  return response
}
const forbidNativeHTTP = t => t.mock.method(globalThis,'fetch',async()=>assert.fail('Native HTTP is forbidden'))
const options = (scenario,calls,extra) => ({
  fetchImpl:replay(scenario,calls,extra),now:()=>scenario.clock,
})
const assertUnqualifiedInventory = (scenario,jobs) => {
  const evidence=readInventoryEvidence(jobs)
  assert.equal(evidence.status,scenario.status)
  assert.equal(evidence.listingComplete,false)
  assert.equal(evidence.reportedTotal,null)
  assert.equal(evidence.indiaFacetCount,null)
  assert.equal(isVerifiedEmptyEvidence(evidence),false)
  const observation=readSourceObservationEvidence(jobs,scenario.source)
  assert.deepEqual(observation,expected(scenario))
  assert.equal(Object.hasOwn(observation,'verifiedAt'),false)
  assert.equal(readSourceObservationEvidence(jobs,'unrelated-source'),null)
  return evidence
}

for (const scenario of scenarios) {
  test(scenario.source+' retains observed native vacancy rows before unchanged detail/country/expiry selection',async t=>{
    forbidNativeHTTP(t)
    const calls=[],jobs=await scenario.run(options(scenario,calls))
    assert.equal(jobs.length,scenario.returned)
    const rich=jobs.nativeCollectionEvidence
    assert.equal(rich[scenario.field],scenario.count)
    assert.ok(rich.retainedResponses.length>0)
    assert.equal(Object.getOwnPropertyDescriptor(jobs,'nativeCollectionEvidence').configurable,false)
    scenario.verify(jobs,rich)
    const inventory=assertUnqualifiedInventory(scenario,jobs)
    assert.equal(jobs.nativeCollectionEvidence,rich)
    assert.equal(rich.lifecycleCleanupAllowed,false)
    assert.deepEqual(extractionRawJobMetrics({source:scenario.source},jobs,inventory),{
      rawJobs:scenario.count,rawJobsBasis:'observed-native-vacancy-rows',
    })
    assert.ok(calls.length>0)
  })

  test(scenario.source+' actual registration and diagnostics preserve observations without company or empty authority',async t=>{
    forbidNativeHTTP(t)
    const scraper=buildScrapers().find(item=>item.name===scenario.source)
    assert.ok(scraper)
    assert.equal(scraper.provider.adapter,'script')
    assert.ok(scraper.provider.modulePath.replaceAll('\\','/').endsWith('/scraper/'+scenario.source+'/script.js'))
    const calls=[],jobs=await scraper.run(options(scenario,calls))
    assert.equal(jobs.length,scenario.returned)
    const inventory=assertUnqualifiedInventory(scenario,jobs)
    const rich=jobs.nativeCollectionEvidence
    assert.equal(rich[scenario.field],scenario.count)
    assert.ok(rich.retainedResponses.length>0)
    assert.equal(rich.lifecycleCleanupAllowed,false)
    scenario.verify(jobs,rich)
    assert.deepEqual(extractionRawJobMetrics(scraper.provider,jobs,inventory),{
      rawJobs:scenario.count,rawJobsBasis:'observed-native-vacancy-rows',
    })
    const analysis=analyzePublishableJobs(jobs,{now:new Date(scenario.clock)})
    const diagnostics=buildScraperAttemptDiagnostics(jobs,analysis,scraper.provider)
    assert.deepEqual(diagnostics.sourceObservations,expected(scenario))
    assert.equal(diagnostics.rawRecords,scenario.count)
    if(scenario.source==='supergaming') {
      assert.equal(diagnostics.jobs,0)
      assert.equal(diagnostics.eligibleJobs,0)
      assert.equal(diagnostics.inventoryEvidence.status,'discovery-only')
    }
    assert.ok(calls.length>0)
  })

  test(scenario.source+' controlled invalid native identity or general-pool response cannot mint observations',async t=>{
    forbidNativeHTTP(t)
    const scraper=buildScrapers().find(item=>item.name===scenario.source)
    for(const run of [scenario.run,options=>scraper.run(options)]) {
      const calls=[]
      await assert.rejects(run(options(scenario,calls,{invalid:true})),{code:scenario.errorCode})
      assert.ok(calls.length>0)
    }
  })
}

