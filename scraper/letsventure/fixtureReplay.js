import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
const records=['rebrand-pages','lvx-employer-pages','zoho-pages','zoho-detail-pages','native-seed-pages'].flatMap(name=>JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/'+name+'.json.gz',import.meta.url)))))
export const fixtureFetch=(mutate=r=>r)=>async url=>{
 const row=records.find(r=>r.url===url)
 if(!row)throw Error('Uncaptured LetsVenture URL '+url)
 const changed=mutate(structuredClone(row)),response=new Response(changed.body,{status:changed.status})
 Object.defineProperty(response,'url',{value:changed.finalUrl});return response
}
