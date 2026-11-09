import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
export const fixtureRecords=['fresh-official-pages','fresh-linkedin-pages'].flatMap(name=>JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/'+name+'.json.gz',import.meta.url)))))
export const fixtureFetch=(mutate=r=>r)=>async url=>{
 const original=fixtureRecords.find(r=>r.url===url)
 if(!original)throw Error('Uncaptured Purplle URL '+url)
 const row=mutate(structuredClone(original)),response=new Response(row.body,{status:row.status})
 Object.defineProperty(response,'url',{value:row.finalUrl});return response
}
