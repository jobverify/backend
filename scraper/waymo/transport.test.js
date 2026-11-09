import assert from 'node:assert/strict'
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import { run, buildIndiaSearchUrl } from './script.js'
import { getRetryMetadata, withRetry } from '../../scraper-support/utils/retry.js'

test('Waymo import under a dry-run runner cannot request or persist jobs', () => {
  const url = new URL('./script.js', import.meta.url).href
  const output = execFileSync(process.execPath, ['--input-type=module', '--eval', `
    process.argv = ['node', 'unrelated-runner.js', '--dry-run'];
    globalThis.fetch = () => { throw Object.assign(Error('Unexpected import network'), { abortRetries: true }); };
    await import(${JSON.stringify(url)});
    console.log('imported');
  `], { encoding: 'utf8', timeout: 3000 })
  assert.equal(output.trim(), 'imported')
})

test('Waymo rejects unsuccessful or redirected responses before parsing their body', async t => {
  const requestUrl = buildIndiaSearchUrl()
  for (const [status, finalUrl] of [[202, requestUrl], [200, 'https://unrelated.invalid/']]) {
    let cancelled = false
    const mocked = t.mock.method(globalThis, 'fetch', async () => ({
      ok: true, status, url: finalUrl,
      body: { cancel() { cancelled = true } },
      text() { assert.fail('Rejected response body must not be read') },
    }))
    try {
      await assert.rejects(run(), error => {
        assert.equal(error.status, status)
        assert.equal(error.requestUrl, requestUrl)
        assert.equal(error.finalUrl, finalUrl)
        assert.match(error.message, new RegExp('HTTP ' + status))
        assert.ok(error.message.includes(finalUrl))
        return true
      })
      assert.equal(cancelled, true)
    } finally { mocked.mock.restore() }
  }
})

test('Waymo cannot certify partial cards against a larger displayed total', async () => {
  const html = `<div class="table-counts">Displaying <b>all&nbsp;2</b> entries</div>
    <article class="job-search-results-card-col">
      <a id="link_job_title_1" href="/jobs/one-bengaluru-india">Software Engineer</a>
      <li class="job-component-location"><span>Bengaluru, Karnataka</span></li>
    </article>`
  await assert.rejects(run({ fetchText: async () => html }), /count|incomplete/i)
})

test('Waymo rate limits retain cooldown evidence and stop the outer retry loop immediately', async t => {
  let calls = 0
  t.mock.timers.enable({ apis: ['setTimeout'] })
  t.mock.method(globalThis, 'fetch', async () => {
    calls++
    return { status: 429, url: buildIndiaSearchUrl(),
      headers: new Headers({ 'Retry-After': '120' }), body: { cancel() {} },
      text() { assert.fail('Rate-limit body must not be parsed as jobs') } }
  })
  await assert.rejects(withRetry(() => run(), { attempts: 2, baseDelayMs: 1, label: 'waymo-cooldown-test' }), error => {
    assert.equal(error.cause.status,429)
    assert.equal(error.cause.retryDelayMs,120000)
    assert.equal(error.abortRetries,true)
    assert.equal(getRetryMetadata(error).retryDelayMs,0)
    return true
  })
  t.mock.timers.tick(120000)
  assert.equal(calls,1,'Server cooldown is evidence, not permission for another request after first failure')
})

test('Waymo permanent access failures stop outer retries immediately', async t => {
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => {
    calls++
    return { status: 403, url: buildIndiaSearchUrl(), body: { cancel() {} } }
  })
  await assert.rejects(withRetry(() => run(), { attempts: 3, baseDelayMs: 0, label: 'waymo-access-test' }), error => {
    assert.equal(error.cause.status, 403)
    assert.equal(error.abortRetries, true)
    return true
  })
  assert.equal(calls, 1)
})
