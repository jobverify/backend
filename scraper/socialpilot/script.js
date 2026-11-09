import { createVerifiedCareersSurfaceScraper } from './verifiedCareersSurface.js'

export const CAREERS_URL = 'https://socialpilot.applytojob.com/apply'

export const run = (options) => createVerifiedCareersSurfaceScraper({
  company: 'SocialPilot', careersUrl: CAREERS_URL, source: 'socialpilot',
}).run(options)
