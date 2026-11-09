import { readReviewedClientProgram, hasClientDocumentBase, clientScriptDeclarations } from '../../scraper-support/utils/reviewedClientProgram.js'

// The complete current declared client fixes the native tenant, the GET URL
// builder and locale/location arrays. The minified function name is immaterial.
const CLIENT_SHA256 = '53c006f9e2ce37b9ea8f71c25e327dd862e28324d9c613dac9449e965a27d986'
const LEGACY_CLIENT_SHA256 = 'b93bcd08d09b0de9d7adf0035e4e0b003543b73371f3727a4848a365838e6b47'
const CURRENT_20261107_CLIENT_SHA256='816e78f7c2af087e60597756dd0fd984af06800760b6d8f552e6b99b0563bb96'
export const isReviewedWovenLeverClient = (body, { careersHTML, scriptURL } = {}) => {
  try {
    const url = new URL(scriptURL)
    if (url.origin !== 'https://woven.toyota' || url.username || url.password || url.search || url.hash
      || !/^\/_next\/static\/chunks\/[a-z\d_-]+\.js$/i.test(url.pathname)
      || typeof careersHTML !== 'string' || Buffer.byteLength(careersHTML, 'utf8') > 3 * 1024 * 1024) return false
    if (hasClientDocumentBase(careersHTML)) return false
    const declarations = clientScriptDeclarations(careersHTML).filter(node => node.attrs.src
      && new URL(node.attrs.src, 'https://woven.toyota/en/careers/').href === scriptURL)
    const program = declarations.length === 1 && readReviewedClientProgram(body)
    return program?.sha256 === CLIENT_SHA256 || program?.sha256 === LEGACY_CLIENT_SHA256||program?.sha256===CURRENT_20261107_CLIENT_SHA256
  } catch { return false }
}
