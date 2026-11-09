import assert from 'node:assert/strict'
import test from 'node:test'
import { spawnSync } from 'node:child_process'
const helperUrl = new URL('../utils/linkedinJobCards.js', import.meta.url)
const helper = await import(helperUrl.href).catch(() => null)
const card = (id, fields = '') => `<div class="base-card job-search-card" data-entity-urn="urn:li:jobPosting:${id}"><a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/${id}"></a>${fields}</div>`
const fields = '<h3 class="base-search-card__title">Platform &amp; Data</h3><h4 class="base-search-card__subtitle"><a>Example</a></h4><span class="job-search-card__location">Bengaluru, India</span>'
test('shared LinkedIn reader exposes only fields belonging to an active card and keeps absent native dates null', () => {
  assert.ok(helper, 'shared active LinkedIn card reader exists')
  const rows = helper.extractLinkedinJobCards(card('111') + card('222', fields))
  assert.deepEqual(rows, [{ id: '222', href: 'https://www.linkedin.com/jobs/view/222', title: 'Platform &amp; Data', company: 'Example', location: 'Bengaluru, India', datetime: null }])
})
test('shared LinkedIn reader excludes inert cards and nested-card field borrowing', () => {
  assert.ok(helper, 'shared active LinkedIn card reader exists')
  const nested = `<div class="job-search-card" data-entity-urn="urn:li:jobPosting:111"><a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/111"></a>${card('222', fields)}</div>`
  assert.deepEqual(helper.extractLinkedinJobCards('<template>' + card('333', fields) + '</template>' + nested).map(row => row.id), ['222'])
})
test('shared LinkedIn reader completes a malformed and undated multi-card page within a bounded process', () => {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `import { readFileSync } from 'node:fs'; import { extractLinkedinJobCards } from ${JSON.stringify(helperUrl.href)}; const rows=extractLinkedinJobCards(readFileSync(0,'utf8')); console.log(JSON.stringify({count:rows.length,undated:rows.every(row=>row.datetime===null)}));`], {
    input: Array.from({ length: 128 }, (_, index) => card(String(1000 + index), index % 2 ? fields : '')).join(''),
    encoding: 'utf8', timeout: 5000, windowsHide: true,
  })
  assert.equal(result.error, undefined, result.error?.message)
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(JSON.parse(result.stdout), { count: 64, undated: true })
})
