import assert from 'node:assert/strict'
import test from 'node:test'

import {
  APPLICATION_URL,
  extractRoleListings,
} from '../../scraper/bharatfinancialinclusionlimited/script.js'

test('extractRoleListings keeps BFIL native application instructions separate from missing role criteria', () => {
  const html = `
    <section><div class="opportunities-list">
      <h5>Microfinance Business Unit (MFI)</h5>
      <ul>
        <li>Field Assistant (Sangam Manager)</li>
        <li>Assistant Branch Manager</li>
      </ul>
      </div>
      <p>If interested, please send us your application.</p>
      <p>[Vertical Name] / [Preferred Location] / [Role]</p>
      <p>Example: BSS / Mysore / Loan Officer</p>
    </section>
  `

  const jobs = extractRoleListings(html)

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].title, 'Field Assistant (Sangam Manager)')
  assert.equal(jobs[0].applyUrl, APPLICATION_URL)
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].country, null)
  assert.equal(jobs[0].jobDescription, null)
  assert.match(jobs[0].nativeApplicationInstructions, /\[Vertical Name\]/)
})
