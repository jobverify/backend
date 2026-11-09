import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
const currentPublicFixture=()=>JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/amberenterprises/test-data/current-public-20261103.json.gz',import.meta.url))))
const currentCorporateHTML=()=>currentPublicFixture().responses[0].body
import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(currentDir, '../../scraper/amberenterprises/fixtures')

const loadAmberEnterprisesModule = async () => {
  try {
    return await import('../../scraper/amberenterprises/script.js')
  } catch {
    assert.fail('Expected Amber Enterprises scraper module at ../../scraper/amberenterprises/script.js')
  }
}

const readFixture = async (name) => readFile(path.join(fixturesDir, name), 'utf8')

test("Amber preserves legacy employer helper checks and current native denial instead of returning empty", async () => {
  const amberEnterprises = await loadAmberEnterprisesModule()
  const homepageHtml = await readFixture('homepage.html')
  const careersHtml = await readFixture('careers.html')
  const requestedUrls = []

  assert.equal(amberEnterprises.SOURCE, 'amberenterprises')
  assert.equal(amberEnterprises.COMPANY, 'Amber Enterprises')
  assert.equal(amberEnterprises.HOMEPAGE_URL, 'https://www.ambergroupindia.com/')
  assert.equal(amberEnterprises.CAREERS_URL, 'https://www.ambergroupindia.com/careers/')
  assert.equal(amberEnterprises.EXTERNAL_JOBS_HOST, 'www.naukri.com')
  assert.equal(amberEnterprises.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(amberEnterprises.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(amberEnterprises.hasExternalJobsHandoffSignal(careersHtml), true)


  await assert.rejects(amberEnterprises.createAmberEnterprisesScraper().run({fetchPage:async url=>{requestedUrls.push(url);if(new URL(url).hostname==='www.naukri.com')return{url,status:403,html:'denied'};return{url,status:200,html:currentCorporateHTML()}}}),error=>error.status===403&&error.inventoryEvidence.reportedTotal===null)
  assert.deepEqual(requestedUrls,[amberEnterprises.CAREERS_URL,'https://www.naukri.com/amber-enterprises-india-overview-4576343?tab=jobs&src=JDLogo'])
 })

test('Amber Enterprises accepts the current first-party homepage title variant', async () => {
  const amberEnterprises = await loadAmberEnterprisesModule()

  assert.equal(
    amberEnterprises.hasOfficialHomepageSignal(`
      <html>
        <head><title>Amber Group India | AC, Mobility Solutions Manufacturer</title></head>
        <body><a href="/careers/">Careers</a><p>Mobility Solutions</p></body>
      </html>
    `),
    true,
  )
})

test("Amber holds current corporate employer/canonical and exact native employer handoff drift", async () => {
 const amber=await loadAmberEnterprisesModule(),original=currentCorporateHTML()
 for(const html of[original.replace('Careers at Amber Group','Careers at Other Employer'),original.replace('amber-enterprises-india-overview-4576343','other-employer-overview-4576343')]){
  const calls=[];await assert.rejects(amber.run({fetchPage:async url=>{calls.push(url);return{url,status:200,html}}}),/employer.*handoff binding changed/);assert.deepEqual(calls,[amber.CAREERS_URL])
 }
})

test("Amber never retries current unavailable public transport through an alternate browser", async () => {
 const amber=await loadAmberEnterprisesModule(),error=new TypeError('fetch failed');let browserCalls=0
 await assert.rejects(amber.run({fetchPage:async()=>{throw error},fetchBrowserText:async()=>{browserCalls++;return currentCorporateHTML()}}),caught=>caught===error);assert.equal(browserCalls,0)
})
