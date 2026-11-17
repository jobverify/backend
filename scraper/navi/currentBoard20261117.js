import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
export const currentNaviBoardProfile=Object.freeze(JSON.parse(readFileSync(new URL('./currentBoardProfile20261117.json',import.meta.url),'utf8')))
export const matchesCurrentNaviBoard=html=>typeof html==='string'&&Buffer.byteLength(html)===currentNaviBoardProfile.bytes
 &&createHash('sha256').update(html).digest('hex')===currentNaviBoardProfile.bodySHA256
