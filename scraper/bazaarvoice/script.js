import { run as runReviewedWordPress, fetchBazaarvoicePacket } from './native.js'
import { runCurrentBazaarvoice } from './currentNative.js'
export { SOURCE, readBazaarvoiceProof } from './native.js'

// Retain the original public reader/proof API. Select the deployment using the
// actual first employer response; each profile keeps its own identity checks.
export async function run(options = {}) {
  const url = 'https://www.bazaarvoice.com/company/careers/'
  options.signal?.throwIfAborted()
  let first
  try {
    first = options.readPacket ? await options.readPacket(url, { method: 'GET', redirect: 'manual', signal: options.signal })
      : await fetchBazaarvoicePacket(url, { signal: options.signal, fetchImpl: options.fetchImpl })
  } catch (error) {
    if (!error.retainedResponse || error.retainedResponse.status < 300 || error.retainedResponse.status >= 400) throw error
    first = error.retainedResponse
  }
  options.signal?.throwIfAborted()
  if (first?.status === 200) {
    let opening = first
    return runReviewedWordPress({ ...options, readPacket: async (requested, context) => {
      if (opening && requested === url) { const packet = opening; opening = null; return packet }
      return options.readPacket ? options.readPacket(requested, context)
        : fetchBazaarvoicePacket(requested, { signal: context.signal, fetchImpl: options.fetchImpl })
    } })
  }
  return runCurrentBazaarvoice({ ...options, initialPacket: first })
}
