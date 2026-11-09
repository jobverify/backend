import assert from 'node:assert/strict'
import test from 'node:test'
import * as nisum from '../../scraper/nisum/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

test('Nisum builds public listing URLs only from the current provided widget config', () => {
  const config={apiKey:'public-widget-example',careerPortalId:'public-portal-example'}
  assert.equal(new URL(nisum.buildWidgetUrl(config)).pathname,'/APISource/v3/index.html')
  assert.equal(new URL(nisum.buildJobPostingsApiUrl({...config,page:2})).searchParams.get('page'),'2')
  assert.deepEqual(nisum.buildJobPostingsPayload({...config,page:2}),{
    page:'2',api_key:config.apiKey,method:'CareerPortalJobPostings',cp_id:config.careerPortalId,from_career_portal:'1',
  })
  assert.equal(nisum.CEIPAL_API_KEY,null)
  assert.equal(nisum.CEIPAL_CAREER_PORTAL_ID,null)
})

test('Nisum rejects malformed legacy listings and keeps country ownership explicit', () => {
  assert.throws(()=>nisum.extractIndiaJobsFromJobPostingsPayload({results:'unexpected'}),/results array/)
  assert.deepEqual(nisum.extractIndiaJobsFromJobPostingsPayload({results:[{job_id:1,public_job_title:'Engineer',city:'Hyderabad',country:''}]}),[])
})

test('Nisum changed first-party content becomes a coverage gap without reading native endpoints', async () => {
  const calls=[]
  const jobs=await nisum.run({fetchPage:async url=>{calls.push(url);return {url,status:200,text:'<title>Different employer</title>'}}})
  assert.deepEqual(calls,[nisum.HOMEPAGE_URL])
  assert.equal(jobs.length,0)
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
  assert.match(readInventoryEvidence(jobs).reason,/first-party-careers-binding-unverified/)
})

test('Nisum propagates cancellation without swallowing it as zero jobs', async () => {
  const signal=AbortSignal.abort(new Error('cancelled fixture'))
  await assert.rejects(nisum.run({signal,fetchPage:async()=>assert.fail('No request after abort')}),/cancelled fixture/)
})
