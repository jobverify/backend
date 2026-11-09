import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {extractPortalDocumentUrl,extractCareerConfig,buildActiveJobsUrl,CAREER_PAGE_URL,run} from '../../scraper/acciojob/script.js'
const identifier='7d86eeef-8f44-46cd-bc3a-2155e3ff042c'
test('AccioJob accepts only its employer-bound portal document and anonymous native configuration',async()=>{
  const portal=await readFile(new URL('../../scraper/acciojob/test-fixtures/reviewed-portal.html',import.meta.url),'utf8')
  assert.equal(extractPortalDocumentUrl('<script>fetch("/ats/documents/'+identifier+'/careerportal/6aa32e2eecac4c51b41b0792c4cc1039.html")</script>'),'https://acciojob.keka.com/ats/documents/'+identifier+'/careerportal/6aa32e2eecac4c51b41b0792c4cc1039.html')
  assert.deepEqual(extractCareerConfig(portal),{identifier,domain:CAREER_PAGE_URL+'/',portalName:'default'})
  assert.equal(buildActiveJobsUrl(extractCareerConfig(portal)),CAREER_PAGE_URL+'/api/embedjobs/default/active/'+identifier)
  assert.equal(extractCareerConfig(portal.replace(identifier,'00000000-0000-4000-8000-000000000000')),null)
  assert.equal(extractPortalDocumentUrl('<script>fetch("https://other.example/ats/documents/'+identifier+'/careerportal/6aa32e2eecac4c51b41b0792c4cc1039.html")</script>'),null)
})
test('AccioJob registered run forwards bounded read-only transport options',async()=>{
  const calls=[]
  await assert.rejects(run({requestIntervalMs:0,fetchImpl:async(url,options)=>{calls.push(url);assert.equal(options.method,'GET');return new Response('',{status:429})}}),error=>error.status===429&&error.abortRetries===true)
  assert.deepEqual(calls,['https://acciojob.com/'])
})
