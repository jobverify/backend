import assert from 'node:assert/strict'
import test from 'node:test'
import {createVerifiedRecruitmentScraper, RECRUITMENT_OBSERVATIONS} from '../scraper-support/utils/verifiedRecruitment.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'

const provider={source:'native-timeout',companyName:'Example Corporation',companyDomain:'employer.invalid',
  companyCareerPage:'https://employer.invalid/careers?token=not-a-real-secret'}
const run=options=>createVerifiedRecruitmentScraper(provider).run({now:()=> '2026-11-08T00:00:00Z',...options})

for(const format of ['fetchImpl','fetchPage'])test(`${format}: a native DOMException deadline stays a network failure with request context`,async()=>{
  await assert.rejects(run({[format]:async()=>{throw new DOMException('The operation was aborted due to timeout','TimeoutError')}}),error=>{
    assert.equal(error.failureKind,'network_or_timeout')
    assert.equal(error.cause.name,'TimeoutError')
    assert.match(error.message,/operation was aborted due to timeout/)
    const observed=error.recruitmentObservations
    assert.equal(observed.failures[0].name,'TimeoutError')
    assert.equal(observed.failures[0].requestUrl,'https://employer.invalid/careers')
    assert.ok(!JSON.stringify(observed.failures).includes('not-a-real-secret'))
    assert.equal(observed.sourceScopeComplete,false)
    assert.equal(observed.lifecycleCleanupAllowed,false)
    assert.equal(readInventoryEvidence(error),null)
    return true
  })
})

test('a DOMException cause retains its timeout details through a native fetch wrapper',async()=>{
  await assert.rejects(run({fetchImpl:async()=>{throw new Error('fetch failed',{
    cause:new DOMException('The operation was aborted due to timeout','TimeoutError')})}}),error=>{
    assert.equal(error.failureKind,'network_or_timeout')
    assert.equal(error.cause.cause.name,'TimeoutError')
    assert.equal(error.recruitmentObservations.failures[0].causes[0].name,'TimeoutError')
    assert.match(error.message,/operation was aborted due to timeout/)
    return true
  })
})

test('successful publisher reads keep a later detail timeout as a partial coverage gap',async()=>{
  await assert.rejects(run({fetchPage:async url=>{
    if(url===provider.companyCareerPage)return {status:200,url,html:'<h1>Careers</h1><a href="/careers/role">Software Engineer</a>'}
    if(url==='https://employer.invalid/')return {status:200,url,html:'<h1>Example Corporation</h1>'}
    throw new DOMException('The operation was aborted due to timeout','TimeoutError')
  }}),error=>{
    assert.equal(error.failureKind,'coverage_gap')
    assert.equal(error.cause.name,'TimeoutError')
    assert.equal(error.recruitmentObservations.failures[0].name,'TimeoutError')
    assert.ok(error.recruitmentObservations.receipts.some(receipt=>receipt.status===200))
    assert.equal(error.recruitmentObservations.sourceScopeComplete,false)
    return true
  })
})

test('DOMException diagnostic fields still redact credentials and payloads',async()=>{
  await assert.rejects(run({fetchImpl:async()=>{throw new DOMException(
    'Timeout https://employer.invalid/job?token=unit-secret authorization=Bearer-unit-secret','TimeoutError')}}),error=>{
    const details=JSON.stringify(error.recruitmentObservations.failures)
    assert.equal(error.failureKind,'network_or_timeout')
    assert.ok(!details.includes('unit-secret'))
    assert.ok(!details.includes('not-a-real-secret'))
    assert.ok(!error.message.includes('unit-secret'))
    return true
  })
})

test('accessor-shaped plain errors cannot execute getters through the DOMException fallback',async()=>{
  let getterReads=0
  const reason={get name(){getterReads++;throw Error('Do not invoke')},
    get message(){getterReads++;throw Error('Do not invoke')}}
  await assert.rejects(run({fetchPage:async()=>{throw reason}}),error=>{
    assert.equal(getterReads,0)
    assert.equal(error.failureKind,'coverage_gap')
    assert.equal(error.recruitmentObservations.failures[0].name,'Error')
    return true
  })
})

test('an object inheriting DOMException.prototype cannot impersonate a native timeout',async()=>{
  const reason=Object.create(DOMException.prototype)
  await assert.rejects(run({fetchImpl:async()=>{throw reason}}),error=>{
    assert.equal(error.failureKind,'coverage_gap')
    assert.equal(error.recruitmentObservations.failures[0].name,'Error')
    return true
  })
})

test('caller cancellation reasons keep exact identity before and during a request',async()=>{
  for(const when of ['before','during'])for(const reason of [Object.freeze(new Error('Cancelled')),Symbol('cancelled'),'cancelled']){
    const controller=new AbortController()
    if(when==='before')controller.abort(reason)
    await assert.rejects(run({signal:controller.signal,fetchPage:async()=>{controller.abort(reason);throw reason}}),error=>error===reason)
  }
})

test('a post-import prototype replacement cannot execute a caller message getter',async()=>{
  const NativeException=DOMException,prototype=NativeException.prototype
  const original=Object.getOwnPropertyDescriptor(prototype,'message')
  let getterReads=0
  try{
    await assert.rejects(run({fetchPage:async()=>{
      Object.defineProperty(prototype,'message',{...original,get(){getterReads++;return 'caller-supplied timeout'}})
      throw new NativeException('The operation was aborted due to timeout','TimeoutError')
    }}),error=>{
      assert.equal(getterReads,0)
      assert.equal(error.failureKind,'network_or_timeout')
      assert.equal(error.cause.message,'The operation was aborted due to timeout')
      return true
    })
  }finally{Object.defineProperty(prototype,'message',original)}
})

test('a post-import constructor replacement cannot authorize a fake error getter',async()=>{
  const original=Object.getOwnPropertyDescriptor(globalThis,'DOMException')
  let getterReads=0
  function FakeException(){}
  FakeException.prototype={get name(){getterReads++;return 'TimeoutError'},
    get message(){getterReads++;return 'caller-supplied timeout'}}
  try{
    await assert.rejects(run({fetchPage:async()=>{
      Object.defineProperty(globalThis,'DOMException',{value:FakeException,configurable:true,writable:true})
      throw Object.create(FakeException.prototype)
    }}),error=>{
      assert.equal(getterReads,0)
      assert.equal(error.failureKind,'coverage_gap')
      assert.equal(error.cause.name,'Error')
      return true
    })
  }finally{Object.defineProperty(globalThis,'DOMException',original)}
})

test('real native deadlines still qualify after the global constructor is replaced',async()=>{
  const NativeException=DOMException,original=Object.getOwnPropertyDescriptor(globalThis,'DOMException')
  try{
    await assert.rejects(run({fetchImpl:async()=>{
      Object.defineProperty(globalThis,'DOMException',{value:function ReplacementException(){},configurable:true,writable:true})
      throw new NativeException('The operation was aborted due to timeout','TimeoutError')
    }}),error=>{
      assert.equal(error.failureKind,'network_or_timeout')
      assert.equal(error.cause.name,'TimeoutError')
      assert.equal(error.cause.message,'The operation was aborted due to timeout')
      return true
    })
  }finally{Object.defineProperty(globalThis,'DOMException',original)}
})
