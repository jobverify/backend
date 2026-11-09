// Only typed, non-hiring values from reviewed public WordPress
// configuration literals may vary. Extra code/keys retain their exact hash.
export function normalizeAccelyaCorporateScript(node) {
  const body = node.raw || ''
  if (node.attrs.id === 'bk-main-js-extra') {
    // All nine reviewed declared programs leave this localization unread.
    // Their complete bytes are verified by the source before and after native
    // hydration. This is not an observed CSRF/request-token allowance.
    const literal = body.match(/^\s*var appBk = \{"bk":"([a-f0-9]{10})"\};\s*\/\/# sourceURL=bk-main-js-extra\s*$/)
    if (literal) return body.replace(`"bk":"${literal[1]}"`, '"bk":"<reviewed-unused-localization-value>"')
  }
  if (node.attrs.id === 'wpml-cookie-js-extra') {
    const match = body.match(/^\s*var wpml_cookies = (\{[^\n]*\});\s*\/\/# sourceURL=wpml-cookie-js-extra\s*$/)
    if (match) try {
      const value = JSON.parse(match[1]), cookie = value['wp-wpml_current_language']
      if (Object.keys(value).length === 1 && cookie && Object.keys(cookie).sort().join(',') === 'expires,path,value'
        && cookie.value === 'en' && cookie.path === '/' && typeof cookie.expires === 'string'
        && Number.isFinite(Date.parse(cookie.expires))) {
        cookie.expires = '<reviewed-language-cookie-expiry>'
        return JSON.stringify(value)
      }
    } catch { /* An unreviewed literal keeps its original signature. */ }
  }
  const match = body.match(/^\s*var rocket_beacon_data = (\{[^\n]*\})\s*;?\s*$/)
  if (match) try {
    const value = JSON.parse(match[1])
    if (value.ajax_url === 'https://w3.accelya.com/wp-admin/admin-ajax.php' && value.url === 'https://w3.accelya.com/careers'
      && typeof value.nonce === 'string' && /^[a-f0-9]{10}$/.test(value.nonce) && typeof value.is_mobile === 'boolean'
      && ['width_threshold', 'height_threshold'].every(key => Number.isInteger(value[key]) && value[key] > 0 && value[key] <= 10000)) {
      value.nonce = '<reviewed-performance-beacon-token>'
      value.is_mobile = '<reviewed-viewport-parameter>'
      value.width_threshold = value.height_threshold = '<reviewed-viewport-parameter>'
      return JSON.stringify(value)
    }
  } catch { /* An unreviewed literal keeps its original signature. */ }
  return body
}
