import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {HOMEPAGE_URL,COMPANY_URL,CAREERS_URL,runCurrentPeer} from './currentNative20261117.js'
export {HOMEPAGE_URL,COMPANY_URL,CAREERS_URL}
export const SOURCE='peerrobotics'
export const COMPANY='Peer Robotics'
export const createPeerRoboticsScraper=(options={})=>({async run(runOptions={}){return runCurrentPeer({...options,...runOptions})}})
export const run=async(options={})=>createPeerRoboticsScraper().run(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
 const jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
