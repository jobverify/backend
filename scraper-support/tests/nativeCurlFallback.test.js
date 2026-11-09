import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchBioconFirstPartyText, CAREERS_PAGE_URL } from '../../scraper/biocon/script.js'
import { fetchClarionJobsText, FEATURED_JOBS_URL } from '../../scraper/clariontechnologies/script.js'
import { defaultFetchPage, CAREERS_URL } from '../../scraper/knowlarity/script.js'

const certificateError = () => new TypeError('fetch failed', {
  cause: Object.assign(new Error('unable to verify the first certificate'), {
    code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  }),
})

for (const platform of ['linux', 'win32']) {
  for (const source of ['biocon', 'clariontechnologies', 'knowlarity']) {
    test(`${source} certificate fallback runs the available curl command on ${platform}`, async t => {
      const descriptor = Object.getOwnPropertyDescriptor(process, 'platform')
      Object.defineProperty(process, 'platform', { ...descriptor, value: platform })
      t.after(() => Object.defineProperty(process, 'platform', descriptor))
      const html = '<html><title>Careers</title></html>'
      const fetchFailure = async () => { throw certificateError() }
      const execFile = async (command, args, options) => {
        assert.equal(command, platform === 'win32' ? 'curl.exe' : 'curl')
        assert.equal(args.includes('--insecure'), false)
        assert.equal(args.includes('-k'), false)
        assert.equal(options.signal instanceof AbortSignal || options.signal === undefined, true)
        return { stdout: source === 'knowlarity'
          ? html + '\n__KNOWLARITY_CURL_METADATA__200\t' + CAREERS_URL : html }
      }
      const result = source === 'biocon'
        ? await fetchBioconFirstPartyText(CAREERS_PAGE_URL, { fetchText: fetchFailure, execFile })
        : source === 'clariontechnologies'
          ? await fetchClarionJobsText(FEATURED_JOBS_URL, { fetchPage: fetchFailure, execFile })
          : await defaultFetchPage(CAREERS_URL, { fetchImpl: fetchFailure, execFile })
      assert.equal(typeof result === 'string' ? result : result.html, html)
    })
  }
}
