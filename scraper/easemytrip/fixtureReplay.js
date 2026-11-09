import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
const packets=JSON.parse(gunzipSync(readFileSync(new URL('../../test/test-data/recruitmentGoal20261104/easemytrip-native-quality.json.gz',import.meta.url)))).packets
const records=packets.map(q=>({url:q.requestedURL,finalUrl:q.finalURL,status:q.status,body:q.bodyText,headers:q.headers}))
export const fixtureFetch=(mutate=record=>record)=>async url=>{
 const captured=records.find(r=>r.url===url)
 if(!captured)throw Error('Uncaptured EaseMyTrip URL '+url)
 const row=mutate(structuredClone(captured)),response=new Response(row.body,{status:row.status,headers:row.headers})
 Object.defineProperty(response,'url',{value:row.finalUrl});return response
}
