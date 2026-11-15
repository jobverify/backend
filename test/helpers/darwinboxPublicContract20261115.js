import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'

export const readDarwinboxPublicContract20261115 = () => JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/darwinbox/fixtures/current-public-contract-20261115.json.gz', import.meta.url))))

// Today's browser responses establish the public client/data contract only.
// This transport is strictly for offline integration regressions. It supplies
// no claim that native Node HTTP currently gets through the observed 403s.
export function darwinboxPublicContractFetch20261115(change = () => {}) {
  const fixture = readDarwinboxPublicContract20261115(), origin = 'https://fisdom.darwinbox.in', calls = []
  const fetchImpl = async (value, init = {}) => {
    const url = String(value), method = init.method || 'GET'
    init.signal?.throwIfAborted()
    let body, type = 'text/html'
    if (url === 'https://www.fisdom.com/careers/') body = fixture.corporate
    else if (url === 'https://www.fisdom.com/') body = fixture.homepage
    else if (url === origin + '/ms/candidate/careers') body = /Chrome\//.test(new Headers(init.headers).get('user-agent') || '') ? fixture.legacyShell : fixture.seoShell
    else if (url === origin + '/ms/candidatev2/main') body = fixture.v2Shell
    else if (url === origin + '/ms/candidate/main.38495915aab0be25d160.js') { body = fixture.legacyClient; type = 'application/javascript' }
    else if (url === origin + '/ms/candidatev2/main.819c4120b20f8091.js') { body = fixture.v2Client; type = 'application/javascript' }
    else {
      type = 'application/json'
      if (url === origin + '/ms/candidateapi/companyinfo') body = structuredClone(fixture.legacyCompany)
      else if (url === origin + '/ms/candidateapi/getCompanyConfig?is_preview=false&companyId=main') body = structuredClone(fixture.company)
      else if (url === origin + '/ms/candidateapi/groupcompanycareersetting?companyId=main') body = { status: 'success', message: { code: 0 } }
      else if (url === origin + '/ms/candidateapi/job/alljobs?companyId=main') {
        assert.equal(method, 'POST')
        assert.deepEqual(JSON.parse(init.body), { companyId: 'main', sort_option: 'new', limit: 10, page: 1 })
        body = structuredClone(fixture.listing)
      } else if (url === origin + '/ms/candidateapi/job/a64197589077ab?companyId=main') body = structuredClone(fixture.detail1)
      else if (url === origin + '/ms/candidateapi/job/a64118f91e68cf?companyId=main') body = structuredClone(fixture.detail2)
      else assert.fail('No observed current Darwinbox fixture for ' + url)
    }
    const packet = { url, status: 200, body, contentType: type }
    calls.push({ url, method, init })
    change(packet, calls)
    const response = new Response(typeof packet.body === 'string' ? packet.body : JSON.stringify(packet.body), {
      status: packet.status, headers: { 'Content-Type': packet.contentType },
    })
    Object.defineProperty(response, 'url', { value: packet.url })
    return response
  }
  return { fixture, calls, fetchImpl }
}
