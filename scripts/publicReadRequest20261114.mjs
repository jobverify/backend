// Keep the earlier capture helper immutable so its recorded hashes remain useful.
export const serializePublicReadRequest = async (input, options = {}) => {
  const request = new Request(input, options)
  request.signal.throwIfAborted()
  const headers = Object.fromEntries(request.headers)
  if (!headers['user-agent']) headers['user-agent'] = 'node'
  headers['accept-encoding'] = 'identity'
  const bodyBase64 = request.body === null ? null : Buffer.from(await request.arrayBuffer()).toString('base64')
  request.signal.throwIfAborted()
  const packet = { url: request.url, method: request.method, headers, bodyBase64, redirect: request.redirect }
  Object.defineProperty(packet, 'signal', { value: request.signal })
  return packet
}

const credentialKey = /^(?:access[_-]?token|id[_-]?token|refresh[_-]?token|auth[_-]?token|guest[_-]?token|csrf[_-]?token|jwt|token|api[_-]?key|authorization|auth|session(?:[_-]?id)?|x-amz-(?:signature|credential|security-token))$/i

export const redactCaptureUrl = value => {
  let url
  try { url = new URL(value, 'https://capture.invalid') } catch { return value }
  let changed = false
  for (const key of new Set(url.searchParams.keys())) {
    if (credentialKey.test(key)) { url.searchParams.set(key, '[omitted]'); changed = true }
  }
  if (!changed) return value
  return /^[a-z][a-z\d+.-]*:/i.test(value) ? url.href : url.pathname + url.search + url.hash
}

export const redactCaptureText = value => value.replace(/https?:\/\/[^\s"'<>]+/g, url => redactCaptureUrl(url))

export const publicReadJsonReplacer = (key, value) => {
  if (typeof value !== 'string') return value
  if (credentialKey.test(key) && value.length >= 16) return '[omitted]'
  return redactCaptureText(value)
}

export const shouldOmitCredentialBody = (url, body) => {
  if (/\/(?:token|tokens|guest-token|csrf-token|access-token|refresh-token|session)(?:\/|$)/i.test(new URL(url).pathname)) return true
  let value
  try { value = JSON.parse(body.toString('utf8')) } catch { return false }
  const pending = [value]
  while (pending.length) {
    const object = pending.pop()
    if (!object || typeof object !== 'object') continue
    for (const [key, candidate] of Object.entries(object)) {
      if (credentialKey.test(key) && typeof candidate === 'string' && candidate.length >= 16) return true
      if (candidate && typeof candidate === 'object') pending.push(candidate)
    }
  }
  return false
}
