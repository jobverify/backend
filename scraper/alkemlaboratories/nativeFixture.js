import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
export function nativeFixture(directory){
 const manifest=JSON.parse(fs.readFileSync(new URL('./test-data/manifest-20261103.js',directory),'utf8').replace(/^export default /,'')),bytes=fs.readFileSync(new URL('./test-data/native-20261103.json.gz',directory))
 if(createHash('sha256').update(bytes).digest('hex')!==manifest.fixtureSha256)throw new Error('Fixture archive integrity mismatch')
 const rows=JSON.parse(gunzipSync(bytes))
 for(const row of rows)if(createHash('sha256').update(row.html).digest('hex')!==row.sha256)throw new Error('Native response integrity mismatch')
 const get=url=>{const row=rows.findLast(r=>r.requestedUrl===url);if(!row)throw new Error('Unpublished fixture URL '+url);return row.html}
 const fetchPage=async(url,options)=>({status:200,url,body:url.endsWith('/api/token/noauth')?JSON.stringify({access_token:'synthetic-public-visitor-token',token_type:'bearer',expires_in:3600,ShouldRedirect:false}):get(url),contentType:/\.js(?:\?|$)/.test(url)?'application/javascript':/\/api\//.test(url)?'application/json':'text/html'})
 return{rows,get,fetchPage}
}
