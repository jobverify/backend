import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { extractWorkdayStructuredDetail } from '../scraper-support/myworkday/engine.js'
import { extractJobFilterSignals } from '../src/utils/jobFilterSignals.js'

const capture = JSON.parse(readFileSync(new URL('./fixtures/cocacolaExperience20261110.json', import.meta.url)))

// A generic numeric fallback must not beat a native minimum requirement merely
// because a possessive apostrophe or "progressive" separates years/experience.
test('Coca-Cola native criteria retain the five-year minimum instead of 130-year employer history', () => {
  const detail = extractWorkdayStructuredDetail(capture.nativeSourceRecord)
  assert.equal(detail.experienceRequired, '5+ years')
  assert.ok(detail.jobDescription.includes('Minimum of 5 years’ progressive experience'))
  assert.ok(detail.jobDescription.includes('130&#43; years'))
  assert.equal(detail.publicExperienceChecked, true)
})

for (const apostrophe of ['', "'", '’', '&#39;', '&rsquo;']) {
  test('minimum progressive experience precedes employer history with apostrophe ' + JSON.stringify(apostrophe), () => {
    const { experienceProfile } = extractJobFilterSignals({
      description: `Minimum of 5 years${apostrophe} progressive experience in finance. Our company continues to thrive after 130+ years.`,
    })
    assert.equal(experienceProfile.minimumYears, 5)
    assert.equal(experienceProfile.maximumYears, null)
    assert.equal(experienceProfile.evidence, '5+ years')
  })
}
