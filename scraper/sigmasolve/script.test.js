import assert from 'node:assert/strict'
import test from 'node:test'
import {createSigmaSolveScraper,CAREERS_PAGE_URL} from './script.js'
import {fixture,replay,mutateBody} from '../../test/test-data/sigmasolvePublication20261108.js'
const DETAIL_URL='https://www.sigmasolve.com/who-we-are/open-position/content-growth-strategist'
const APPLY_URL='https://www.sigmasolve.com/who-we-are/apply-for-job?job=content-growth-strategist'

test('Sigma Solve matches the current opening to its own application link without opening the form',async()=>{
 const r=replay(),jobs=await createSigmaSolveScraper().run(r.options)
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].title,'Content & Growth Strategist')
 assert.equal(jobs[0].country,'United States')
 assert.equal(jobs[0].sourceUrl,DETAIL_URL)
 assert.equal(jobs[0].applyUrl,APPLY_URL)
 assert.deepEqual(r.requests,[CAREERS_PAGE_URL,DETAIL_URL,CAREERS_PAGE_URL,DETAIL_URL]);assert.deepEqual(r.uncaptured,[])
 assert.equal(jobs[0].jobDescription,fixture.expected.model.description)
})

test('Sigma Solve rejects an application route for a different job',async()=>{
 const r=replay({transform:p=>{if(p.requestedURL===DETAIL_URL)mutateBody(p,Buffer.from(p.bodyBase64,'base64').toString().replace('apply-for-job?job=content-growth-strategist','apply-for-job?job=unrelated'))}})
 await assert.rejects(createSigmaSolveScraper().run(r.options),/application link identifies another role/i)
 assert.equal(r.requests.length,2);assert.deepEqual(r.uncaptured,[])
})