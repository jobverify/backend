import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createBrowserUserDataDir,
  launchBrowser,
  resolveBrowserExecutablePath,
} from '../utils/browser.js'

test('resolveBrowserExecutablePath prefers an explicit Puppeteer executable override when it exists', () => {
  const executablePath = 'C:\\Tools\\Chrome\\chrome.exe'

  assert.equal(
    resolveBrowserExecutablePath({
      platform: 'win32',
      env: {
        PUPPETEER_EXECUTABLE_PATH: executablePath,
      },
      existsSync: (candidate) => candidate === executablePath,
    }),
    executablePath,
  )
})

test('resolveBrowserExecutablePath falls back to a system Chrome install on Windows', () => {
  const systemChrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

  assert.equal(
    resolveBrowserExecutablePath({
      platform: 'win32',
      env: {},
      existsSync: (candidate) => candidate === systemChrome,
    }),
    systemChrome,
  )
})

test('resolveBrowserExecutablePath returns null when no supported browser executable is present', () => {
  assert.equal(
    resolveBrowserExecutablePath({
      platform: 'win32',
      env: {},
      existsSync: () => false,
    }),
    null,
  )
})

test('createBrowserUserDataDir allocates a unique temp profile prefix for each browser launch', async () => {
  let receivedPrefix = null

  const userDataDir = await createBrowserUserDataDir({
    tmpdirPath: 'C:\\Temp',
    mkdtempImpl: async (prefix) => {
      receivedPrefix = prefix
      return `${prefix}abc123`
    },
  })

  assert.equal(receivedPrefix, 'C:\\Temp\\jobverify-puppeteer-profile-')
  assert.equal(userDataDir, 'C:\\Temp\\jobverify-puppeteer-profile-abc123')
})

test('launchBrowser rejects a requesting source with an API-only migration error', async () => {
  await assert.rejects(
    launchBrowser({ sourcePath: 'scraper/example/script.js' }),
    (error) => (
      error?.code === 'SCRAPER_BROWSER_DISABLED'
      && error?.abortRetries === true
      && error.message.includes('API-only')
      && error.message.includes('scraper/example/script.js')
    ),
  )
})

test('launchBrowser without source metadata gives a clear API-only migration error', async () => {
  await assert.rejects(
    launchBrowser(),
    (error) => (
      error?.code === 'SCRAPER_BROWSER_DISABLED'
      && error?.abortRetries === true
      && error.message.includes('API-only')
      && error.message.includes('Migrate this scraper to HTTP/API access.')
      && !error.message.includes('unknown source/configuration')
    ),
  )
})
