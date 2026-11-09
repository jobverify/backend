import assert from 'node:assert/strict'
import test from 'node:test'
import { extractOfficialRecruitmentLinks } from '../scripts/officialRecruitmentLinks.js'

test('raw text ends at its HTML closing tag even when its contents have unmatched markup quotes', () => {
  const target = 'https://example.com/jobs'
  for (const raw of ['script', 'style', 'textarea', 'xmp']) {
    const html = `<${raw}>const text = '<a title="unfinished';</${raw}><a href="${target}">Jobs</a>`
    assert.deepEqual(extractOfficialRecruitmentLinks(html, 'https://example.com/').map(url => url.href), [target])
  }
})

test('a comment marker inside raw script text cannot swallow a later active career link', () => {
  const target = 'https://example.com/jobs'
  const html = `<script>const opening = '<!--';</script><a href="${target}">Jobs</a><!-- real end -->`
  assert.deepEqual(extractOfficialRecruitmentLinks(html, 'https://example.com/').map(url => url.href), [target])
})
