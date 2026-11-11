import assert from 'node:assert/strict'
import test from 'node:test'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'

// Isolated, authored factory models expose acquisition/close counts. They never
// launch a browser, fetch an employer page or represent native source evidence.
for(const mode of ['success','cancel','partial-failure','sync-failure','acquisition-abort','close-failure','falsy-failure'])test('browser fallback pool closes all acquired sessions: '+mode,()=>{
  const helper=new URL('../scraper-support/utils/publicExperienceEnrichment.js',import.meta.url).href
  const script=`
    import assert from 'node:assert/strict';import {registerHooks} from 'node:module';
    const mode=${JSON.stringify(mode)},controller=new AbortController();
    const state={mode,controller,opened:[],closed:[],browserCalls:0,forwarded:[]};globalThis.poolControl=state;
    const source="export const createBrowserFetchSession=(options)=>{const s=globalThis.poolControl,id=s.opened.length;s.opened.push(id);s.forwarded.push(options.signal===s.controller.signal);if(id===0&&s.mode==='sync-failure')throw Error('Controlled synchronous acquisition');return new Promise((resolve,reject)=>setImmediate(()=>{if(id===0&&['partial-failure','falsy-failure'].includes(s.mode)){reject(s.mode==='falsy-failure'?false:Error('Controlled acquisition'));return}if(id===0&&s.mode==='acquisition-abort')s.controller.abort(null);resolve({fetchPage:async url=>{s.browserCalls++;if(['cancel','close-failure'].includes(s.mode))s.controller.abort(false);return{status:200,url,html:'<html></html>'}},close:()=>{s.closed.push(id);if(id===0&&s.mode==='close-failure')throw Error('Controlled close failure')}})}))}";
    registerHooks({resolve(specifier,context,next){if(specifier==='../shared/browserFetch.js'&&context.parentURL===${JSON.stringify(helper)})return{url:'data:text/javascript,'+encodeURIComponent(source),shortCircuit:true};return next(specifier,context)}});
    globalThis.fetch=async()=>assert.fail('Real network forbidden');
    const {enrichJobsWithPublicExperience}=await import(${JSON.stringify(helper)});
    const jobs=[1,2].map(id=>({title:'Synthetic Engineer',company:'Synthetic Employer',jobId:String(id),sourceUrl:'https://careers.synthetic.test/jobs/'+id,jobDescription:null,sourceDescription:null}));
    const result=await enrichJobsWithPublicExperience(jobs,{concurrency:2,signal:controller.signal,fetchText:async()=>'<html></html>'}).then(value=>({failed:false,value}),reason=>({failed:true,reason}));
    await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));
    assert.equal(state.opened.length,2,'only one two-session pool is acquired');
    const failedFactory=['partial-failure','sync-failure','falsy-failure'].includes(mode);
    const expected=failedFactory?[1]:[0,1];
    assert.deepEqual([...state.closed].sort((a,b)=>a-b),expected,'every acquired handle closes exactly once');
    assert.ok(state.forwarded.every(Boolean),'the caller signal reaches every factory');
    if(['cancel','close-failure','acquisition-abort'].includes(mode)){assert.equal(result.failed,true);assert.equal(result.reason,mode==='acquisition-abort'?null:false)}else{assert.equal(result.failed,false);assert.equal(result.value.length,2)}
    if(mode==='acquisition-abort'||failedFactory)assert.equal(state.browserCalls,0);
    if(mode==='cancel'||mode==='close-failure')assert.equal(state.browserCalls,1,'queued cancelled reads never start');
  `
  const result=spawnSync(process.execPath,['--input-type=module','--eval',script],{cwd:fileURLToPath(new URL('../',import.meta.url)),encoding:'utf8',timeout:10000,windowsHide:true})
  assert.equal(result.error,undefined)
  assert.equal(result.status,0,result.stderr||result.stdout)
})
