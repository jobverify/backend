import http from 'node:http'

const proxyKeys = ['HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY', 'http_proxy', 'https_proxy', 'no_proxy']
const configured = value => typeof value === 'string' && value.trim().length > 0
const configurationError = (code, message) => Object.assign(new Error(message), { code, abortPipeline: true })

// Configure once before source requests begin. No Windows discovery, process
// spawning, environment mutation, credentials or proxy addresses in diagnostics.
export function createScraperProxyInitializer({
  env = process.env,
  execArgv = process.execArgv,
  setGlobalProxyFromEnv = http.setGlobalProxyFromEnv,
} = {}) {
  let initialized
  return () => {
    if (initialized) return initialized
    const values = Object.fromEntries(proxyKeys.filter(key => typeof env[key] === 'string').map(key => [key, env[key]]))
    const httpProxy = values.http_proxy || values.HTTP_PROXY
    const httpsProxy = values.https_proxy || values.HTTPS_PROXY
    const diagnostics = { httpProxyConfigured: configured(httpProxy), httpsProxyConfigured: configured(httpsProxy),
      noProxyConfigured: configured(values.no_proxy || values.NO_PROXY) }
    const result = mode => { initialized = Object.freeze({ mode, ...diagnostics }); return initialized }
    if (execArgv.includes('--use-env-proxy')) return result('runtime-configured')
    if (env.NODE_USE_ENV_PROXY !== undefined) {
      return result(env.NODE_USE_ENV_PROXY === '1' ? 'runtime-configured' : 'disabled')
    }
    if (!diagnostics.httpProxyConfigured && !diagnostics.httpsProxyConfigured) return result('direct')
    if (typeof setGlobalProxyFromEnv !== 'function') {
      throw configurationError('SCRAPER_PROXY_RUNTIME_UNSUPPORTED',
        'Configured scraper proxy requires Node24.14+ or Node proxy support enabled at startup.')
    }
    try {
      for (const value of [httpProxy, httpsProxy].filter(configured)) {
        const url = new URL(value)
        if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) throw new Error('Invalid proxy URL')
      }
      setGlobalProxyFromEnv(values)
    } catch {
      // Native errors can contain proxy usernames/passwords or URI values.
      throw configurationError('SCRAPER_PROXY_CONFIGURATION_INVALID',
        'Scraper proxy environment is invalid; check HTTP_PROXY/HTTPS_PROXY without logging their values.')
    }
    return result('proxy-environment')
  }
}

export const initializeScraperProxyEnvironment = createScraperProxyInitializer()
