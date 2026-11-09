// Test-only immutable public response loader for this four-source repair batch.
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
export function nativeFixture(directory){
 const manifest=JSON.parse(fs.readFileSync(new URL('./test-data/manifest-20261103.js',directory),'utf8').replace(/^export default /,'')),bytes=fs.readFileSync(new URL('./test-data/native-20261103.json.gz',directory))
 if(createHash('sha256').update(bytes).digest('hex')!==manifest.fixtureSha256)throw Error('Fixture archive integrity mismatch')
 const rows=JSON.parse(gunzipSync(bytes))
 for(const row of rows)if(createHash('sha256').update(row.html).digest('hex')!==row.sha256)throw Error('Native response integrity mismatch')
 const find=url=>rows.findLast(r=>r.requestedUrl===url||r.finalUrl===url)
 const get=url=>{const row=find(url);if(!row)throw Error('Unpublished fixture URL '+url);return row.html}
 const fetchPage=async url=>{const row=find(url);if(!row)throw Error('Unpublished fixture URL '+url);return{status:row.status,url:row.finalUrl,body:row.html,text:async()=>row.html,headers:new Headers({'content-type':row.contentType,...row.publicHeaders})}}
 return{rows,get,fetchPage}
}
