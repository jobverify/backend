import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import * as scraper from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const fixture = name => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')

test('Petrus current product app validates its complete public route module before returning zero', async () => {
  const home = fixture('petrus-home.html')
  const fetched = []
  const jobs = await scraper.run({ fetchPage: async url => { fetched.push(url); return url === scraper.HOMEPAGE_URL ? {status:200,url,html:home} : {status:404,url,html:fixture('petrus-route-404.html')} }, fetchText: async url => { fetched.push(url); return fixture('petrus-current-client.js') } })
  assert.deepEqual(jobs, [])
  assert.ok(fetched.some(url => url.endsWith('/assets/index-Ma6WJLuf.js')))
  await assert.rejects(scraper.run({ fetchPage: async url => ({status:200,url,html:home}), fetchText: async () => fixture('petrus-current-client.js') + 'JobPosting Current Openings' }), /route bundle|client/)
})


test('Petrus absence of hiring routes remains discovery-only for company inventory', async () => {
  const jobs = await scraper.run({fetchPage:async url => url === scraper.HOMEPAGE_URL ? {status:200,url,html:fixture('petrus-home.html')} : {status:404,url,html:fixture('petrus-route-404.html')},fetchText:async () => fixture('petrus-current-client.js')})
  assert.equal(readInventoryEvidence(jobs)?.status, 'discovery-only')
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
})
