import https from 'node:https'
import { isIP } from 'node:net'

const ipv4Number = value => value.split('.').reduce((result, part) => result * 256 + Number(part), 0)

// Evaluate bypasses before replacing the request hostname with its pinned IP.
// The settings come from Node's enabled global agent, not an implicit proxy opt-in.
const bypassesProxy = (url, environment) => {
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  const authority = `${host}:${url.port || 443}`
  const entries = String(environment.no_proxy || environment.NO_PROXY || '').split(',')
  return entries.some(value => {
    const entry = value.trim().toLowerCase()
    if (entry === '*' || entry === host || entry === authority) return true
    if (entry.startsWith('*.')) return host.endsWith(entry.slice(1))
    if (entry.startsWith('.')) {
      const suffix = entry.slice(1)
      return host === suffix || host.endsWith('.' + suffix)
    }
    if (isIP(host) === 4 && entry.includes('-')) {
      const [first, last, extra] = entry.split('-').map(part => part.trim())
      if (extra === undefined && isIP(first) === 4 && isIP(last) === 4) {
        const current = ipv4Number(host)
        return current >= ipv4Number(first) && current <= ipv4Number(last)
      }
    }
    return false
  })
}

export const createPinnedProxyAgent = (url, addresses, environment = https.globalAgent.options.proxyEnv) => {
  if (!environment || typeof environment !== 'object') return null
  const configured = environment.https_proxy || environment.HTTPS_PROXY
  if (!configured || bypassesProxy(url, environment)) return null
  try {
    const proxy = new URL(configured)
    if (!['http:', 'https:'].includes(proxy.protocol) || /[\r\n]/.test(configured)) throw Error('Unsupported proxy')
    const chosen = addresses.find(row => row.family === 4) || addresses[0]
    // Node performs the CONNECT to this literal IP; the source request supplies
    // its original Host, TLS SNI and certificate identity separately.
    const agent = new https.Agent({ keepAlive: false, maxCachedSessions: 0,
      proxyEnv: { https_proxy: configured, no_proxy: '', NO_PROXY: '' } })
    // Node24 registers a proxied socket only after CONNECT and origin TLS.
    // Track its earlier socket too so cancellation can close a stalled tunnel.
    const pending = new Set()
    const createConnection = agent.createConnection
    agent.createConnection = function (...args) {
      const socket = Reflect.apply(createConnection, this, args)
      if (socket) {
        pending.add(socket)
        socket.once('close', () => pending.delete(socket))
      }
      return socket
    }
    const destroy = agent.destroy
    agent.destroy = function () {
      for (const socket of pending) socket.destroy()
      pending.clear()
      return Reflect.apply(destroy, this, [])
    }
    return { agent, address: chosen.address }
  } catch {
    // Node's native proxy errors can include the configured URI and credentials.
    const error = Error('Invalid configured HTTPS proxy configuration')
    error.code = 'ERR_PROXY_INVALID_CONFIG'
    throw error
  }
}

export const publicProxyError = error => {
  const code = typeof error?.code === 'string' && /^[A-Z0-9_]+$/.test(error.code) ? error.code : 'PROXY_REQUEST_FAILED'
  return Object.assign(Error(`Configured HTTPS proxy request failed (${code})`), { code })
}
