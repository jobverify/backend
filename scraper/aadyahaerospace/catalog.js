import path from 'node:path'
import {fileURLToPath} from 'node:url'
import CURRENT_METADATA from '../../scraper-support/providers/providerExtensions/zz-007-aadyahaerospace.json' with {type:'json'}
const directory=path.dirname(fileURLToPath(import.meta.url))
export const AADYAH_CATALOG={...CURRENT_METADATA,modulePath:path.join(directory,'script.js'),dryRunFile:path.join(directory,'jobs.json')}
export default AADYAH_CATALOG
