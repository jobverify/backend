import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
const load=name=>JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/'+name+'.json.gz',import.meta.url))))
const records=['fresh-native-pages','fresh-client-application','fresh-application-page'].flatMap(load).filter(r=>r.status===200)
export const fixtureFetch=(change=record=>record)=>async url=>{
 const captured=records.find(r=>r.url===url)
 if(!captured)throw Error('Uncaptured Greyamp request '+url)
 const record=change(structuredClone(captured)),response=new Response(record.body,{status:record.status})
 Object.defineProperty(response,'url',{value:record.finalUrl});return response
}
