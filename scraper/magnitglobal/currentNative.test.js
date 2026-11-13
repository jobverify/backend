import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createMagnitNativeInventory } from './nativeInventory.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const C = 'https://magnitglobal.com/about/careers', L = 'https://magnitglobal.com/us/en/company/careers.html'
const O = 'https://jobs.dayforcehcm.com', D = O + '/prounlimited/CANDIDATEPORTAL'
const E = 'https://globaleur232.dayforcehcm.com/CandidatePortal/en-US/ProUnlimited'
const W = 'https://directsource.magnitglobal.com/eu/magnitglobal', J = W + '/jobs'
const ROLE = J + '/410-delivery-partner-helsinki-uusimaa'
const captured = name => gunzipSync(readFileSync(new URL('./fixtures/' + name + '-20261113.html.gz', import.meta.url))).toString('utf8')

// The DirectSource pages are current public originals. A small synthetic empty
// Dayforce context isolates the independent DirectSource country contract.
const nativeBoard = () => '<script id="__NEXT_DATA__" type="application/json">' + JSON.stringify({
  query: { clientNamespace: 'prounlimited', careerSiteXRefCode: 'CANDIDATEPORTAL' },
  props: { pageProps: { session: { status: 'unauthenticated' }, dehydratedState: { queries: [{
    queryKey: ['site-info', { clientNamespace: 'prounlimited', careerSiteXRefCode: 'CANDIDATEPORTAL', language: 'en-US' }],
    state: { data: { clientNamespace: 'prounlimited', jobBoardCode: 'CANDIDATEPORTAL', jobBoardId: 1, clientId: 80745,
      cultureCode: 'en-US', candidateCorrespondenceClientName: 'Magnit', smallLogo: { imageName: 'Magnit - Small' },
      largeLogo: { imageName: 'Magnit - Large' }, isoCultureCodes: ['en-US'] } },
  }] } } },
}) + '</script>'

const execute = async (changeListing = html => html, changeDetail = html => html) => {
  const calls = []
  const jobs = await createMagnitNativeInventory().run({ fetchPage: async url => {
    calls.push(url)
    let body, contentType = 'text/html'
    if (url === C) body = captured('careers')
    else if (url === L) body = '<script>window.location.href="' + C + '";</script>'
    else if (url === D || url === E) body = nativeBoard()
    else if (url === W) body = '<title>Magnit Global Talent Network</title><a href="/eu/magnitglobal/jobs">Browse Jobs</a>'
    else if (url === J) body = changeListing(captured('direct-listing'))
    else if (url === ROLE) body = changeDetail(captured('direct-detail-410'))
    else if (url === O + '/api/auth/csrf') { contentType = 'application/json'; body = JSON.stringify({ csrfToken: 'a'.repeat(64) }) }
    else if (url === O + '/api/geo/prounlimited/jobposting/search') { contentType = 'application/json'; body = JSON.stringify({ jobPostings: [], maxCount: 0, offset: 0, count: 0 }) }
    else assert.fail('Unexpected Magnit native URL: ' + url)
    return { url: url === E ? D : url, status: 200, contentType, body, setCookies: ['public-session=fixture'] }
  } })
  return { jobs, calls }
}

test('Magnit reconciles the current sole Finland option with its complete native DirectSource role', async () => {
  const { jobs, calls } = await execute()
  assert.equal(jobs.length, 0)
  assert.ok(calls.includes(ROLE), 'The sole-country inventory still requires native detail verification')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 1)
})

test('Magnit rejects a selected country when another country option exists', async () => {
  await assert.rejects(execute(html => html.replace('value="FI" selected>Finland</option>', 'value="FI" selected>Finland</option><option value="PL">Poland</option>')), /inventory is filtered/)
})

test('Magnit rejects a DirectSource country that contradicts its sole native country inventory', async () => {
  await assert.rejects(execute(undefined, html => {
    const changed = html.replace(/("addressCountry"\s*:\s*)"FI"/g, '$1"PL"')
    assert.notEqual(changed, html, 'The negative control must mutate the native country')
    return changed
  }), /country/)
})
