import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
const records=['official-pages','native-employer-jobs','native-job-api'].flatMap(name=>JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/'+name+'.json.gz',import.meta.url)))))
export const fixtureFetch=(mutate=r=>r)=>async url=>{
 const original=records.find(r=>r.url===url)
 if(!original)throw Error('Uncaptured xto10x URL '+url)
 const row=mutate(structuredClone(original)),response=new Response(row.body,{status:row.status})
 Object.defineProperty(response,'url',{value:row.finalUrl});return response
}
