const OFFICIAL_ORIGIN = 'https://rebit.org.in'
const trustedClientUrl = (value, base, kind) => {
  let url
  try { url = new URL(value, base) } catch { throw new Error('ReBIT published client URL is malformed') }
  const pattern = kind === 'main' ? /^\/main-[A-Za-z0-9]+\.js$/ : /^\/chunk-[A-Za-z0-9]+\.js$/
  if (url.origin !== OFFICIAL_ORIGIN || !pattern.test(url.pathname) || url.search || url.hash || url.username || url.password) {
    throw new Error('ReBIT published client must remain on the verified first-party origin')
  }
  return url.href
}

export const resolvePublishedMainClient = html => {
  const base = String(html).match(/<base\b[^>]*href=["']([^"']+)["']/i)?.[1]
  if (base !== '/') throw new Error('ReBIT published client base changed')
  const scripts = [...String(html).matchAll(/<script\b[^>]*src=["']([^"']+)["']/gi)]
    .map(match => match[1]).filter(src => /(?:^|\/)main-[A-Za-z0-9]+\.js(?:$|[?#])/.test(src))
  if (scripts.length !== 1) throw new Error('ReBIT published main client is missing or ambiguous')
  return trustedClientUrl(scripts[0], OFFICIAL_ORIGIN + base, 'main')
}

export const parsePublishedAnonymousBootstrap = (client, clientUrl) => {
  // Read the published byte-to-base64 routine and its bound anonymous login.
  // Downloaded JavaScript is parsed as data and never evaluated.
  const decoderPattern = /function ([A-Za-z_$][\w$]*)\(([A-Za-z_$][\w$]*)\)\{let ([A-Za-z_$][\w$]*)=\2\.map\(([A-Za-z_$][\w$]*)=>String\.fromCharCode\(\4\)\)\.join\(""\);return btoa\(\3\)\}/g
  const decoders = new Set([...String(client).matchAll(decoderPattern)].map(match => match[1]))
  const loginPattern = /let ([A-Za-z_$][\w$]*)=(\[[\d,\s]+\]),([A-Za-z_$][\w$]*)=(\[[\d,\s]+\]),([A-Za-z_$][\w$]*)=([A-Za-z_$][\w$]*)\(([A-Za-z_$][\w$]*)\),([A-Za-z_$][\w$]*)=([A-Za-z_$][\w$]*)\(([A-Za-z_$][\w$]*)\);[A-Za-z_$][\w$]*\.post\(`\$\{([A-Za-z_$][\w$]*)\.apiUrl\}\/auth\/login`,\{username:([A-Za-z_$][\w$]*),password:([A-Za-z_$][\w$]*)\}\)/g
  const matches = [...String(client).matchAll(loginPattern)]
  if (matches.length !== 1) throw new Error('ReBIT published anonymous bootstrap payload changed')
  const m = matches[0]
  if (m[1] !== m[7] || m[3] !== m[10] || m[5] !== m[12] || m[8] !== m[13] || m[6] !== m[9] || !decoders.has(m[6])) {
    throw new Error('ReBIT published bootstrap encoding or bindings changed')
  }
  const encode = (raw, length) => {
    const bytes = JSON.parse(raw)
    if (bytes.length !== length || bytes.some(byte => !Number.isInteger(byte) || byte < 0 || byte > 255)) {
      throw new Error('ReBIT published bootstrap byte payload is malformed')
    }
    return Buffer.from(bytes).toString('base64')
  }
  const imports = [...String(client).matchAll(/import\{([^}]+)\}from["']([^"']+)["']/g)]
    .filter(match => match[1].split(',').some(binding => binding.trim().split(/\s+as\s+/)[1] === m[11]))
  if (imports.length !== 1) throw new Error('ReBIT published API configuration import changed')
  const configUrl = trustedClientUrl(imports[0][2], clientUrl, 'chunk')
  return {configUrl,body:{username:encode(m[2],16),password:encode(m[4],32)}}
}

export const assertPublishedApiBase = config => {
  const bases = [...String(config).matchAll(/apiUrl:["']([^"']+)["']/g)]
  if (bases.length !== 1 || bases[0][1] !== OFFICIAL_ORIGIN + '/web/api') {
    throw new Error('ReBIT published API configuration no longer matches the verified origin')
  }
}
