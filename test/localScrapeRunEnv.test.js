import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DEFAULT_LOCAL_SCRAPE_ENV,
  buildLocalScrapeRunEnv,
} from '../scripts/localScrapeRunEnv.js'

test('local scrape launchers keep the runner default Workday timeout unless explicitly overridden', () => {
  assert.equal(DEFAULT_LOCAL_SCRAPE_ENV.WORKDAY_SCRAPER_TIMEOUT_MS, '210000')
  assert.equal(
    buildLocalScrapeRunEnv({}, {}).WORKDAY_SCRAPER_TIMEOUT_MS,
    '210000',
  )
  assert.equal(
    buildLocalScrapeRunEnv({}, {}).WORKDAY_DETAIL_FETCH_CONCURRENCY,
    '1',
  )
})

test('local scrape launchers pass through SCRAPER_CONCURRENCY from .env when present', () => {
  assert.equal(
    buildLocalScrapeRunEnv({}, {
      SCRAPER_CONCURRENCY: '5',
    }).SCRAPER_CONCURRENCY,
    '5',
  )
})

test('local scrape launchers prefer process SCRAPER_CONCURRENCY over .env', () => {
  assert.equal(
    buildLocalScrapeRunEnv({ SCRAPER_CONCURRENCY: '5' }, { SCRAPER_CONCURRENCY: '10' }).SCRAPER_CONCURRENCY,
    '5',
  )
})

test('local scrape launchers do not inject a hardcoded SCRAPER_CONCURRENCY default', () => {
  assert.equal(buildLocalScrapeRunEnv({}, {}).SCRAPER_CONCURRENCY, undefined)
})

test('local scrape launchers preserve explicit Workday timeout overrides', () => {
  assert.equal(
    buildLocalScrapeRunEnv({
      WORKDAY_SCRAPER_TIMEOUT_MS: '90000',
    }, {}).WORKDAY_SCRAPER_TIMEOUT_MS,
    '90000',
  )
})

test('local scrape launchers enable system CA support by default', () => {
  assert.equal(DEFAULT_LOCAL_SCRAPE_ENV.NODE_OPTIONS, '--use-system-ca')
  assert.equal(buildLocalScrapeRunEnv({}, {}).NODE_OPTIONS, '--use-system-ca')
  assert.equal(
    buildLocalScrapeRunEnv({}, {
      NODE_OPTIONS: '--openssl-legacy-provider',
    }).NODE_OPTIONS,
    '--openssl-legacy-provider --use-system-ca',
  )
})

test('local scrape launchers append system CA support to existing Node options', () => {
  assert.equal(
    buildLocalScrapeRunEnv({
      NODE_OPTIONS: '--trace-warnings',
    }, {}).NODE_OPTIONS,
    '--trace-warnings --use-system-ca',
  )
})

test('local scrape launchers avoid duplicating system CA support', () => {
  assert.equal(
    buildLocalScrapeRunEnv({
      NODE_OPTIONS: '--trace-warnings --use-system-ca',
    }, {}).NODE_OPTIONS,
    '--trace-warnings --use-system-ca',
  )
})
