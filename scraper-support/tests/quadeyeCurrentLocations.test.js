import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { filterIndiaJobs } from '../utils/indiaLocationFilter.js'
import { extractIndiaJobs, createQuadEyeScraper, CAREERS_PAGE_URL, CAREERS_PORTAL_URL } from '../../scraper/quadeye/script.js'
const payload = JSON.parse(readFileSync(new URL('./fixtures/quadeye/current-api.json', import.meta.url), 'utf8'))
const home = '<title>Jobs | quadeye</title><link rel="canonical" href="https://www.quadeye.com/jobs"><a href="/career">Careers</a><a href="/contact-us">Contact</a><h2>Open Roles</h2>Loading roles'
const portal = '<title>Jobs at PeoplePlus</title><meta property="og:url" content="https://quadeye.zohorecruit.in/jobs/Careers/"><meta property="og:site_name" content="Quadeye"><input id="pageJson"><input id="moduleMeta"><input id="jobs" value="' + JSON.stringify(payload.data.map(job=>({id:job.id}))).replaceAll('"','&quot;') + '">'
const fetchText = async url => url === CAREERS_PAGE_URL ? home : url === CAREERS_PORTAL_URL ? portal : '<title>Quadeye</title><h1>' + payload.data.find(job => job.$url === url).Posting_Title + '</h1>'
test('QuadEye includes eight roles with explicit Gurugram Job_Location and absent Country', () => {
  const jobs = extractIndiaJobs(payload)
  // Historical parser output was 20 India rows. The complete native workplace
  // tuples now qualify nine India rows and retain twelve raw unknowns instead.
  assert.equal(jobs.length, 21)
  const absentCountry = jobs.filter(job => payload.data.find(row => row.id === job.jobId).Country == null)
  assert.equal(absentCountry.length, 8)
  assert.ok(absentCountry.every(job => job.country === null && job.nativeGeographyQualified === false))
  assert.deepEqual(jobs.filter(job => job.country === 'India').map(job => job.jobId), [
    '199893000002318440', '199893000002318430', '199893000002318371', '199893000000742323',
    '199893000000707783', '199893000000440283', '199893000002926019', '199893000002560787', '199893000000864279',
  ])
  assert.equal(jobs.filter(job => job.nativeGeographyQualified === false).length, 12)
  assert.ok(jobs.filter(job => job.country === 'India').every(job => job.location === 'Gurugram, India'))
  assert.ok(jobs.filter(job => job.nativeGeographyQualified === false).every(job => job.location === null && job.rawNativeWorkplaceEvidence))
})
test('QuadEye rejects unparseable public identities and unrelated application URLs while retaining unknown locations raw', () => {
  for (const [index, change] of [row=>{row.id=''},row=>{row.Job_Location=['Remote'];row.Country=null},row=>{row.$url='https://unrelated.example/job'},row=>{row.Posting_Title='';row.Job_Opening_Name=''}].entries()) {
    const changed = structuredClone(payload); change(changed.data[0])
    if (index === 1) {
      const jobs = extractIndiaJobs(changed), unknown = jobs.find(job => job.jobId === changed.data[0].id)
      assert.equal(unknown.country, null)
      assert.equal(unknown.location, null)
      assert.equal(unknown.nativeGeographyQualified, false)
      assert.deepEqual(unknown.rawNativeWorkplaceEvidence.Job_Location, ['Remote'])
      assert.equal(filterIndiaJobs([unknown]).length, 0)
      assert.ok(filterIndiaJobs(jobs).length > 0, 'Unknown geography must not discard healthy neighboring roles')
    } else assert.throws(()=>extractIndiaJobs(changed),/incomplete|location|identity|application/i)
  }
})
test('QuadEye compares public API identities with the independently rendered portal inventory', async () => {
  await assert.rejects(createQuadEyeScraper().run({fetchText,fetchJson:async()=>({...payload,data:payload.data.slice(1)})}),/incomplete|inventory/i)
})
test('QuadEye caps preserve incomplete snapshot status after validating the full inventory', async () => {
  const jobs = await createQuadEyeScraper({maxJobs:2}).run({fetchText,fetchJson:async()=>payload})
  assert.equal(jobs.length,2)
  assert.ok(jobs.every(job=>job.sourceListingComplete===false))
})
