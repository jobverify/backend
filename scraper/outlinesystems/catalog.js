import {fileURLToPath} from 'node:url'
import candidate from './catalog-candidate.json' with {type:'json'}
export const OUTLINE_SYSTEMS_CATALOG={...candidate,modulePath:fileURLToPath(new URL('./script.js',import.meta.url))}
export default OUTLINE_SYSTEMS_CATALOG
