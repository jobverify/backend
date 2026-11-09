import test from 'node:test'
import assert from 'node:assert/strict'
import { verifyInventoryHandoff } from '../scripts/verifyInventoryHandoff.js'
const evidence = () => ({ status: 'complete-inventory', firstParty: true, listingComplete: true, pagesFetched: 1,
  surface: 'https://acme.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main', reportedTotal: 1, verifiedAt: new Date().toISOString() })
test('official handoff requires an exact inventory tenant and current successful official response', async () => {
  const provider = { companyCareerPage: 'https://acme.test/careers' }
  const fetchPage = async url => ({ url, status: 200, html: '<a href="https://acme.darwinbox.in/ms/candidate/careers">Open roles</a>' })
  assert.equal((await verifyInventoryHandoff(provider, evidence(), { fetchPage })).verified, true)
  assert.equal((await verifyInventoryHandoff(provider, { ...evidence(), surface: 'https://other.darwinbox.in/ms/candidateapi/job/alljobs' }, { fetchPage })).verified, false)
})
test('guessed ATS URLs, unrelated redirects, and homepage customer links cannot prove an employer handoff', async () => {
  assert.equal((await verifyInventoryHandoff({ companyCareerPage: 'https://acme.darwinbox.in/ms/candidate/careers' }, evidence())).verified, false)
  const redirected = async () => ({ url: 'https://unrelated.test/careers', status: 200, html: '<a href="https://acme.darwinbox.in/ms/candidate/careers">Jobs</a>' })
  assert.equal((await verifyInventoryHandoff({ companyCareerPage: 'https://acme.test/careers' }, evidence(), { fetchPage: redirected })).verified, false)
  const customer = async url => ({ url, status: 200, html: '<a href="https://acme.darwinbox.in/ms/candidate/careers">Customer story</a>' })
  assert.equal((await verifyInventoryHandoff({ companyDomain: 'acme.test' }, evidence(), { fetchPage: customer })).verified, false)
})

test('Darwinbox company homepage is distinct from its customer ATS subdomains', async () => {
  const fetchPage = async url => ({ url, status: 200, html: '<a href="https://dbx.darwinbox.in/ms/candidate/careers">Open roles</a>' })
  const result = await verifyInventoryHandoff({ companyCareerPage: 'https://darwinbox.com/en-us/careers' },
    { ...evidence(), surface: 'https://dbx.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main' }, { fetchPage })
  assert.equal(result.verified, true)
})
