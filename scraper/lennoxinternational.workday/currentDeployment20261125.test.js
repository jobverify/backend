import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {run} from './script.js';
import {profile,readShell} from './nativeContract20261111.js';
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-deployment-20261125.json.gz',import.meta.url))));
const previous=JSON.parse(readFileSync(new URL('./reviewedCurrentShell20261114.json',import.meta.url)));
const text=p=>Buffer.from(p.bodyBase64,'base64').toString('utf8'),shellPacket=fixture.packets.find(p=>p.url===profile.shellURL),shell=text(shellPacket);
const assets=fixture.packets.filter(p=>p.url.includes('/platform_190.'));
const oldRelease='platform_189.2.1.261113-4ca730cca10-11-pg-0',newRelease='platform_190.0.1.261120-662648c29b2-11-pg-0';
const changed=(before,after)=>{assert.notEqual(before,after,'A negative must change the actual shell');return after;};
function replay(change=(_url,p)=>p){
 const calls=[],controller=new AbortController(),reason=Object.freeze({caller:'stop-at-first-native-listing'});
 const fetchImpl=async(url,init={})=>{
  url=String(url);init.signal?.throwIfAborted();calls.push(url);
  if(url===profile.frameURL){controller.abort(reason);throw reason;}
  const original=fixture.packets.find(p=>p.url===url);assert.ok(original,'Unexpected acquisition '+url);
  const p=change(url,{...original,body:text(original)}),response=new Response(p.body,{status:p.status,headers:p.headers});
  Object.defineProperty(response,'url',{value:p.finalURL});return response;
 };
 return{calls,controller,reason,fetchImpl};
}
test('six retained current documents preserve actual HTTP bytes and each reviewed program is byte-identical',()=>{
 assert.equal(fixture.packets.length,6);assert.equal(assets.length,3);
 assert.match(fixture.assetTransportEnvironment,/Windows configured/);
 for(const p of fixture.packets){assert.equal(p.status,200);assert.equal(p.finalURL,p.url);assert.equal(createHash('sha256').update(Buffer.from(p.bodyBase64,'base64')).digest('hex'),p.bodySHA256);}
 for(let i=0;i<3;i++){assert.equal(assets[i].url,previous.shellAssets[i].url.replace(oldRelease,newRelease));assert.equal(assets[i].bodySHA256,previous.shellAssets[i].sha256);}
});
test('whole current platform190 shell retains the exact own frame and bounded existing pagination contract',()=>{
 const value=readShell(shell);assert.equal(value.declaredFrameURL,profile.frameURL);assert.equal(value.listingPageLimit,2);
 assert.deepEqual(value.reviewedShellAssets,assets.map(p=>({url:p.url,sha256:p.bodySHA256})));
});
test('source verifies every current declared client before entering the native listing and preserves exact caller cancellation',async()=>{
 const io=replay();await assert.rejects(run({fetchImpl:io.fetchImpl,signal:io.controller.signal}),error=>error===io.reason);
 assert.deepEqual(io.calls,[...profile.corporateURLs,profile.shellURL,...assets.map(p=>p.url),profile.frameURL]);
});
for(const asset of assets)test('changed original current program rejects before any native listing: '+asset.url.split('/').at(-1),async()=>{
 const io=replay((url,p)=>{if(url===asset.url)p.body+='\n/* unreviewed program mutation */';return p;});
 await assert.rejects(run({fetchImpl:io.fetchImpl}),/shell asset bytes changed/);assert.equal(io.calls.includes(profile.frameURL),false);
});
for(const asset of assets)test('mixed old/current shell declarations reject: '+asset.url.split('/').at(-1),()=>{
 assert.throws(()=>readShell(changed(shell,shell.replace(asset.url,asset.url.replace(newRelease,oldRelease)))),/program set/);
});
for(const[name,edit]of[
 ['unknown deployment',value=>value.replaceAll(newRelease,'platform_190.0.0.unreviewed')],
 ['changed native iframe assignment',value=>value.replace('icimsFrame.src =','otherFrame.src =')],
 ['new quoted executable',value=>value.replace('</body>','<q><script>window.unreviewed=true</script></q></body>')],
 ['changed event handler',value=>value.replace('scrollToTop()','unreviewedAction()')],
])test('current whole shell rejects '+name,()=>assert.throws(()=>readShell(changed(shell,edit(shell))),/program|AST|handler/));
