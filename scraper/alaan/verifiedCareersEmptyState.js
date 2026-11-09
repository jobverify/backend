// Compatibility entry point: historical reviews never authorize a current zero.
import {runAlaanPublicRead} from './currentPublic.js'
export const createVerifiedCareersEmptyStateScraper = () => ({run:runAlaanPublicRead})
export const run = options => runAlaanPublicRead(options)
