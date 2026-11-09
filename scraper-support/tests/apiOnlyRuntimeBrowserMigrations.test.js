import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = path.dirname(fileURLToPath(import.meta.url))
const backendDir = path.resolve(testDir, '../..')

const sourceScripts = [
  { source: 'alchemytechsolindia', scriptPath: ['scraper', 'alchemytechsolindia', 'script.js'] },
  { source: 'amperecomputing', scriptPath: ['scraper', 'amperecomputing', 'script.js'] },
  { source: 'atmecsglobal', scriptPath: ['scraper', 'atmecsglobal', 'script.js'] },
  { source: 'backyardcreators', scriptPath: ['scraper', 'backyardcreators', 'script.js'] },
  { source: 'billdesk', scriptPath: ['scraper', 'billdesk', 'script.js'] },
  { source: 'blinkit', scriptPath: ['scraper', 'blinkit', 'script.js'] },
  { source: 'brainiuminformationtechnologies', scriptPath: ['scraper', 'brainiuminformationtechnologies', 'script.js'] },
  { source: 'canonindia', scriptPath: ['scraper', 'canonindia', 'script.js'] },
  { source: 'canva', scriptPath: ['scraper', 'canva', 'script.js'] },
  { source: 'capillarytechnologies', scriptPath: ['scraper', 'capillarytechnologies', 'script.js'] },
  { source: 'coupasoftwareinc', scriptPath: ['scraper', 'coupasoftwareinc', 'script.js'] },
  { source: 'dealshare', scriptPath: ['scraper', 'dealshare', 'script.js'] },
  { source: 'eoxvantage', scriptPath: ['scraper', 'eoxvantage', 'script.js'] },
  { source: 'everlifecpc', scriptPath: ['scraper', 'everlifecpc', 'script.js'] },
  { source: 'excelraknowledgesolutions', scriptPath: ['scraper', 'excelraknowledgesolutions', 'script.js'] },
  { source: 'fanplay', scriptPath: ['scraper', 'fanplay', 'script.js'] },
  { source: 'geniusadvisor', scriptPath: ['scraper', 'geniusadvisor', 'script.js'] },
  { source: 'google', scriptPath: ['scraper', 'google', 'script.js'] },
  { source: 'havasindia', scriptPath: ['scraper', 'havasindia.workday', 'script.js'] },
  { source: 'rocketsoftware', scriptPath: ['scraper', 'rocketsoftware', 'script.js'] },
  { source: 'orioninnovation', scriptPath: ['scraper', 'orioninnovation', 'script.js'] },
  { source: 'rubrik', scriptPath: ['scraper', 'rubrik', 'script.js'] },
  { source: 'sayonetechnologies', scriptPath: ['scraper', 'sayonetechnologies', 'script.js'] },
  { source: 'sciomanagementsolutions', scriptPath: ['scraper', 'sciomanagementsolutions', 'script.js'] },
  { source: 'vanta', scriptPath: ['scraper', 'vanta', 'script.js'] },
  { source: 'zivame', scriptPath: ['scraper', 'zivame', 'script.js'] },
]

test('browser-disabled runtime migrations do not retain browser launcher paths', async () => {
  for (const { source, scriptPath } of sourceScripts) {
    const script = await readFile(path.join(backendDir, ...scriptPath), 'utf8')

    assert.doesNotMatch(script, /scraper-support\/utils\/browser\.js/)
    assert.doesNotMatch(
      script,
      /\blaunchBrowser\b|\bcreateOptimizedPage\b|\bfetchBrowser(?:Page|Text)?\b|\bcreateBrowserFetchSession\b|\bloadBrowserUtils\b|\bBrowser(?:Text|Page|Fetch|Role|Listing|Api|Context|Jobs)?\b/,
      source,
    )
  }
})
