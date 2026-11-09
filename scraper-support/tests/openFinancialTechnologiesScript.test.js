import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {extractCareerDocumentUrl,extractCareerConfig,buildActiveJobsUrl,CAREER_PAGE_URL,run} from '../../scraper/openfinancialtechnologies/script.js'
const identifier='161570d3-d2be-4e8c-b233-d006f70cd371'
test('Open Financial accepts only its employer-bound portal and current native configuration',async()=>{
  const portal=await readFile(new URL('../../scraper/openfinancialtechnologies/test-fixtures/reviewed-portal.html',import.meta.url),'utf8')
  assert.equal(extractCareerDocumentUrl('<script>fetch("/ats/documents/'+identifier+'/careerportal/ad813284387e414ba9c8c20b9615b368.html")</script>'),'https://openfinancial.keka.com/ats/documents/'+identifier+'/careerportal/ad813284387e414ba9c8c20b9615b368.html')
  assert.deepEqual(extractCareerConfig(portal),{identifier,domain:CAREER_PAGE_URL,portalName:'default'})
  assert.equal(buildActiveJobsUrl(extractCareerConfig(portal)),CAREER_PAGE_URL+'api/embedjobs/default/active/'+identifier)
  assert.equal(extractCareerConfig(portal.replace(identifier,'00000000-0000-4000-8000-000000000000')),null)
  assert.equal(buildActiveJobsUrl({identifier,domain:'https://unrelated.keka.com/careers/',portalName:'default'}),null)
})
test('Open Financial registered run forwards bounded read-only transport options',async()=>{
  const calls=[]
  await assert.rejects(run({requestIntervalMs:0,fetchImpl:async(url,options)=>{calls.push(url);assert.equal(options.method,'GET');return new Response('',{status:401})}}),error=>error.status===401&&error.abortRetries===true)
  assert.deepEqual(calls,['https://open.money/company/careers'])
})
