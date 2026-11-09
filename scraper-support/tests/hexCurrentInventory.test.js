import assert from 'node:assert/strict'
import test from 'node:test'

import { createHexScraper, extractOpenRoleCards, hasCompleteUsOnlyInventory } from '../../scraper/hex/script.js'

const page = (count, cards) => `
  <title>Hex Careers - Join the Team | Hex</title>
  <h1>Make everyone a data person</h1>
  <p>It's just "Hex"!</p>
  <p>We're hiring in San Francisco, New York, and remote.</p>
  <h2>Open roles</h2>
  <div class="OpenRolesSidebar__TotalRoleCount-x">[<!-- -->${count}<!-- -->]</div>
  ${cards.join('\n')}
`
const role = (slug, title, location) => `
  <a class="OpenRole__Wrapper-x" href="/careers/${slug}/">
    <p class="OpenRole__TitleText-x">${title}</p>
    <p class="OpenRole__LocationText-x">${location}</p>
  </a>
`
const usOnly = page(2, [
  role('software-engineer-backend-(platform)', 'Software Engineer, Backend (Platform)', 'Remote - US or New York'),
  role('cloud-security-engineer', 'Cloud Security Engineer', 'Remote - US, San Francisco or New York'),
])

test('Hex checks every role card against the page total and US-only locations', async () => {
  assert.deepEqual(extractOpenRoleCards(usOnly).map((job) => job.location), [
    'Remote - US or New York',
    'Remote - US, San Francisco or New York',
  ])
  assert.equal(hasCompleteUsOnlyInventory(usOnly), true)
  const visited = []
  const jobs = await createHexScraper().run({
    fetchText: async (url) => {
      visited.push(url)
      return usOnly
    },
  })
  assert.deepEqual(visited, ['https://hex.tech/careers/'])
  assert.deepEqual(jobs, [])
})

test('Hex fails closed on new India location, missing role, or duplicate role', () => {
  assert.equal(hasCompleteUsOnlyInventory(usOnly.replace('Remote - US or New York', 'Bengaluru, India')), false)
  assert.equal(hasCompleteUsOnlyInventory(usOnly.replace('[<!-- -->2<!-- -->]', '[<!-- -->3<!-- -->]')), false)
  assert.equal(hasCompleteUsOnlyInventory(page(2, [
    role('cloud-security-engineer', 'Cloud Security Engineer', 'Remote - US'),
    role('cloud-security-engineer', 'Cloud Security Engineer', 'Remote - US'),
  ])), false)
})
