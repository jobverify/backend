import test from 'node:test'
import assert from 'node:assert/strict'
import { hasOfficialHomepageSignal } from './script.js'
const oldTitle = 'Apexon - Enterprise AI, Data &amp; Digital Engineering Solutions'
const currentTitle = 'Enterprise AI, Data, and Agentic Engineering | Apexon'
const page = title => `<title>${title}</title><p>Peak Ingenuity</p><a href="/about/careers/">Careers</a>`
test('admits the finite original and current Apexon homepage title profiles', () => {
  assert.equal(hasOfficialHomepageSignal(page(oldTitle)), true)
  assert.equal(hasOfficialHomepageSignal(page(currentTitle)), true)
})
test('new title retains the original slogan and exact own careers link requirements', () => {
  assert.equal(hasOfficialHomepageSignal(page(currentTitle).replace('Peak Ingenuity', 'Other slogan')), false)
  assert.equal(hasOfficialHomepageSignal(page(currentTitle).replace('/about/careers/', 'https://unrelated.invalid/about/careers/')), false)
})
test('unreviewed and near titles are still refused', () => {
  for (const title of [currentTitle + ' extra', currentTitle.replace('Apexon', 'Other'), currentTitle.replace('Agentic', 'Digital')]) {
    assert.equal(hasOfficialHomepageSignal(page(title)), false)
  }
})
