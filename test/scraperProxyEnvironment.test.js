import assert from 'node:assert/strict'
import test from 'node:test'
import { createScraperProxyInitializer } from '../scraper-support/utils/proxyEnvironment.js'

test('unconfigured processes keep their current agents and dispatcher', () => {
  let calls = 0
  const initialize = createScraperProxyInitializer({ env: { NO_PROXY: 'localhost' }, execArgv: [],
    setGlobalProxyFromEnv: () => { calls++ } })
  assert.equal(initialize().mode, 'direct')
  assert.equal(initialize(), initialize())
  assert.equal(calls, 0)
})

test('only proxy settings are forwarded, preserving lowercase precedence and explicit bypasses', () => {
  const env = { HTTP_PROXY: 'http://upper.example.test:80', http_proxy: 'http://lower.example.test:81',
    HTTPS_PROXY: 'https://proxy.example.test:443', NO_PROXY: 'localhost,.internal.example.test', no_proxy: '',
    MONGO_URI: 'PRIVATE_DATABASE_VALUE', API_KEY: 'PRIVATE_KEY' }
  let forwarded, calls = 0
  const initialize = createScraperProxyInitializer({ env, execArgv: [], setGlobalProxyFromEnv: value => { forwarded = value; calls++ } })
  const result = initialize()
  assert.equal(result.mode, 'proxy-environment')
  assert.equal(result.httpProxyConfigured, true); assert.equal(result.httpsProxyConfigured, true)
  assert.deepEqual(forwarded, Object.fromEntries(Object.entries(env).filter(([key]) => /proxy/i.test(key))))
  assert.equal(forwarded.no_proxy, '')
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_|example\.test|http:/)
  assert.equal(initialize(), result); assert.equal(calls, 1)
  assert.equal(env.MONGO_URI, 'PRIVATE_DATABASE_VALUE')
})

for (const disabled of ['0', 'false', '']) {
  test(`an explicit Node proxy opt-out remains effective: ${JSON.stringify(disabled)}`, () => {
    const initialize = createScraperProxyInitializer({ env: { HTTP_PROXY: 'http://proxy.example.test', NODE_USE_ENV_PROXY: disabled },
      execArgv: [], setGlobalProxyFromEnv: () => { throw new Error('must not reset') } })
    assert.equal(initialize().mode, 'disabled')
  })
}

test('startup proxy support is retained without overriding configured agents', () => {
  for (const [env, execArgv] of [[{ NODE_USE_ENV_PROXY: '1' }, []], [{ NODE_USE_ENV_PROXY: '0' }, ['--use-env-proxy']]]) {
    const initialize = createScraperProxyInitializer({ env, execArgv,
      setGlobalProxyFromEnv: () => { throw new Error('must not reset') } })
    assert.equal(initialize().mode, 'runtime-configured')
  }
})

test('unsupported runtimes fail clearly only when proxy configuration requires initialization', () => {
  const initialize = createScraperProxyInitializer({ env: { HTTP_PROXY: 'http://proxy.example.test' }, execArgv: [], setGlobalProxyFromEnv: null })
  assert.throws(initialize, error => error.code === 'SCRAPER_PROXY_RUNTIME_UNSUPPORTED' && error.abortPipeline)
  assert.equal(createScraperProxyInitializer({ env: {}, execArgv: [], setGlobalProxyFromEnv: null })().mode, 'direct')
})

test('invalid proxies and native setup errors fail without exposing addresses or credentials', () => {
  for (const value of ['invalid://PRIVATE_PROXY_VALUE', 'not a proxy', 'http://user:PRIVATE_PASSWORD@proxy.example.test']) {
    const initialize = createScraperProxyInitializer({ env: { HTTPS_PROXY: value }, execArgv: [],
      setGlobalProxyFromEnv: () => { throw new Error('PRIVATE_NATIVE_ERROR ' + value) } })
    assert.throws(initialize, error => {
      assert.equal(error.code, 'SCRAPER_PROXY_CONFIGURATION_INVALID')
      assert.equal(error.abortPipeline, true)
      assert.doesNotMatch(String(error), /PRIVATE_|proxy\.example\.test|user:/)
      assert.equal(error.cause, undefined)
      return true
    })
  }
})
