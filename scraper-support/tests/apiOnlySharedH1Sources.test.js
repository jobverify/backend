import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = path.dirname(fileURLToPath(import.meta.url))
const backendDir = path.resolve(testDir, '../..')

const sources = [
  'radware',
  'rinextechnologies',
  'safranengineeringservicesindia',
  'saucelabs',
  'schneiderelectric',
  'spheraindia',
  'syrmasgs',
  'waydotcomindia',
  'wspindia',
  'yokogawaindia.workday',
  'zeoncharging',
]

test('shared H1 sources are API-only and do not retain a browser launcher path', async () => {
  for (const source of sources) {
    const script = await readFile(path.join(backendDir, 'scraper', source, 'script.js'), 'utf8')

    assert.doesNotMatch(script, /scraper-support\/utils\/browser\.js/)
    assert.doesNotMatch(script, /\blaunchBrowser\b|\bcreateOptimizedPage\b|\bfetchBrowser(?:Page|Text)?\b|\bBrowser(?:Text|Page|Fetch|Role|Listing|Api)?\b/)
  }
})
