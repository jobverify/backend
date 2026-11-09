import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {verifySearch} from '../../scraper/arrowelectronics.workday/native.js';
import {models} from '../../scraper/arrowelectronics.workday/models.js';
const app={refNum:'ARELUS',widgetApiEndpoint:'https://careers.arrow.com/widgets',locale:'en_us',deviceType:'desktop',country:'us',pageName:'search-results',baseDomain:'https://careers.arrow.com',baseUrl:'https://careers.arrow.com/us/en/',siteType:'external'};
const construction=`var phApp = phApp || ${JSON.stringify(app)};phApp.ddo={"eagerLoadRefineSearch":{"status":200}};`;
const page=extra=>`<script>${construction}${extra}</script>`;
const rejects=html=>assert.throws(()=>verifySearch(html),e=>e.code==='PHENOM_INCOMPLETE_SNAPSHOT');
for(const [name,mutation] of [
 ['later-refNum-mutation','phApp.refNum="OTHER";'],
 ['whole-app-replacement','phApp={"refNum":"OTHER"};'],
 ['later-ddo-property-mutation','phApp.ddo.eagerLoadRefineSearch.status=403;'],
]) test('diagnostic340 rejects '+name,()=>rejects(page(mutation)));

test('accepted JSON constructions preserve the models and unrelated scalar reads',()=>{
 assert.deepEqual(verifySearch(page('const url=window.phApp.baseUrl;const same=phApp.refNum === "ARELUS";')).app,app);
 assert.deepEqual(models(page('')).ddo,{eagerLoadRefineSearch:{status:200}});
});
for(const mutation of [
 'phApp["refNum"]="OTHER";',"phApp['ddo']['eagerLoadRefineSearch'].status=403;",
 'window.phApp.refNum="OTHER";','window["phApp"]={};','globalThis.phApp.refNum="OTHER";',
 'phApp.refNum+="OTHER";','phApp.ddo.eagerLoadRefineSearch.status++;','++phApp.ddo.eagerLoadRefineSearch.status;',
 'delete phApp.refNum;','phApp[key]="OTHER";','phApp.ddo[key].status=403;',
 'Object.assign(phApp,{refNum:"OTHER"});','Object.defineProperty(phApp,"refNum",{value:"OTHER"});',
 'const alias=phApp;alias.refNum="OTHER";','const alias=phApp.ddo;alias.eagerLoadRefineSearch.status=403;',
 'phApp.ddo.update();','phApp.refNum=compute();','phApp.ddo={...other};',
 'phApp.ddo={"eagerLoadRefineSearch":{"status":200}}.changed;',
 'var phApp=phApp||{"refNum":"ARELUS"},other=phApp.refNum="OTHER";',
 '({value:phApp.refNum}={value:"OTHER"});','phApp.refNum &&= "OTHER";',
 'phApp["re"+"fNum"]="OTHER";','phApp.__proto__.refNum="OTHER";',
 'phApp.pageId=compute();','phApp.pageId="page";phApp.pageId.refNum="OTHER";',
 'eval("phApp.refNum=OTHER");', 'new Function("phApp.refNum=OTHER")();',
 'window["ph\\u0041pp"].refNum="OTHER";', 'phApp.refNum`tagged`;', 'const x=`${phApp.refNum="OTHER"}`;', 'window[key].refNum="OTHER";', 'ph\\u0041pp.refNum="OTHER";',
]) test('rejects unsupported active mutation '+mutation,()=>rejects(page(mutation)));

test('inert text cannot create a model or a mutation',()=>{
 const inert=['<!-- <script>phApp.refNum="OTHER";</script> -->','<template><script>phApp.refNum="OTHER";</script></template>','<textarea><script>phApp.refNum="OTHER";</script></textarea>','<script type="text/plain">phApp.refNum="OTHER";</script>','<script src="ignored.js">phApp.refNum="OTHER";</script>'];
 for(const html of inert) assert.deepEqual(verifySearch(page('')+html).app,app);
 assert.deepEqual(verifySearch(page('/*phApp.refNum="OTHER";*/ const text="phApp.refNum=OTHER"; const template=`phApp.refNum=OTHER`; //phApp.refNum="OTHER";\n')).app,app);
 assert.throws(()=>models('<script>const text='+JSON.stringify(construction)+'</script>'));
});

test('mutation in a later active script rejects and cannot be hidden by another valid construction',()=>{
 rejects(page('')+'<script>phApp.refNum="OTHER";</script>');
 rejects(page('phApp.refNum="OTHER";')+page(''));
});

test('all captured native search/detail models remain readable without executing scripts',()=>{
 const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/arrow/native-captures.json',import.meta.url)));
 verifySearch(fixture.searchHTML);
 for(const detail of fixture.details) assert.equal(models(detail.html).ddo.jobDetail.status,200,detail.id);
});

test('nested unexecuted construction cannot supply native models',()=>{
 assert.throws(()=>models('<script>function stale(){'+construction+'}</script>'));
});

test('supplemental captured UI constructions do not replace identity or ddo',()=>{
 const extra='phApp.pageId="page9-ds";phApp.pxSegmentState=\'stranger\';phApp.sessionParams={"csrfToken":"offline"};';
 assert.deepEqual(verifySearch(page(extra)).app,app);
});

const review347Exact=[
  {
    "name": "array-scalar-read",
    "extra": "const urls=[window.phApp.baseUrl];",
    "expectedAccept": true
  },
  {
    "name": "object-scalar-read",
    "extra": "const urls={baseUrl:window.phApp.baseUrl};",
    "expectedAccept": true
  },
  {
    "name": "parenthesized-delete-three",
    "extra": "delete (((phApp.refNum)));",
    "expectedAccept": false
  },
  {
    "name": "parenthesized-prefix-update-three",
    "extra": "++(((phApp.refNum)));",
    "expectedAccept": false
  },
  {
    "name": "parenthesized-global-computed-identity",
    "extra": "(window)[\"phApp\"].refNum=\"OTHER\";",
    "expectedAccept": false
  },
  {
    "name": "parenthesized-global-computed-replacement",
    "extra": "(window)[\"phApp\"]={\"refNum\":\"OTHER\"};",
    "expectedAccept": false
  },
  {
    "name": "parenthesized-global-computed-ddo",
    "extra": "(window)[\"phApp\"].ddo.eagerLoadRefineSearch.status=403;",
    "expectedAccept": false
  },
  {
    "name": "global-alias-computed-write",
    "extra": "const host=window;host[\"phApp\"].refNum=\"OTHER\";",
    "expectedAccept": false
  },
  {
    "name": "escaped-comment-line-separator",
    "extra": "// harmless\u2028phApp.refNum=\"OTHER\";",
    "expectedAccept": false
  },
  {
    "name": "escaped-comment-paragraph-separator",
    "extra": "// harmless\u2029phApp.refNum=\"OTHER\";",
    "expectedAccept": false
  }
];
for(const probe of review347Exact) test('review347exact '+probe.name,()=>{
 if(probe.expectedAccept) assert.deepEqual(verifySearch(page(probe.extra)).app,app);
 else rejects(page(probe.extra));
});

const grouped=(value,depth)=>'('.repeat(depth)+value+')'.repeat(depth);
for(const root of ['window','globalThis','self','this']) {
 for(const mutation of ['.refNum="OTHER";', '={"refNum":"OTHER"};', '.ddo.eagerLoadRefineSearch.status=403;'])
  test('review347 grouped global '+root+mutation,()=>{
   for(const depth of [1,3,4,9,32]) rejects(page(grouped(root,depth)+'["phApp"]'+mutation));
   rejects(page('const host='+grouped(root,9)+';host["phApp"]'+mutation));
  });
}
for(const operator of ['delete ','++','--']) test('review347 unary '+operator+' arbitrary balanced grouping',()=>{
 for(const depth of [1,3,4,9,32]) for(const path of ['phApp.refNum','window.phApp.refNum',grouped('window',depth)+'.phApp.refNum']) rejects(page(operator+grouped(path,depth)+';'));
});
test('review347 postfix and assignment targets remain guarded through nested grouping',()=>{
 for(const depth of [1,3,4,9,32]) for(const suffix of ['++;','--;','="OTHER";','+="OTHER";']) rejects(page(grouped('phApp.refNum',depth)+suffix));
 rejects(page('[window.phApp.refNum]=["OTHER"];'));
 rejects(page('({value:window.phApp.refNum}={value:"OTHER"});'));
});
test('review347 all ECMAScript line terminators end line comments',()=>{
 for(const separator of ['\r','\n','\r\n','\u2028','\u2029']) for(const comment of ['// harmless','<!-- harmless']) rejects(page(comment+separator+'phApp.refNum="OTHER";'));
});
test('review347 safe scalar leaves remain reads in literal containers and call arguments',()=>{
 for(const extra of ['const urls=[((window).phApp.baseUrl)];','const urls={baseUrl:((window.phApp.baseUrl))};','record(window.phApp.baseUrl);','const texts=["phApp"];','const url=((((phApp)).baseUrl));']) assert.deepEqual(verifySearch(page(extra)).app,app);
});

for(const root of ['window','globalThis','self','this']) test('review347 dynamic critical global alias '+root,()=>{
 rejects(page('const host='+grouped(root,9)+';host[key].refNum="OTHER";'));
});

const review347SlashExact=[
  {
    "name": "regex-doublequote-identity",
    "extra": "const pattern=/\"/;phApp.refNum=\"OTHER\";"
  },
  {
    "name": "regex-singlequote-identity",
    "extra": "const pattern=/'/;phApp.refNum='OTHER';"
  },
  {
    "name": "regex-doublequote-ddo",
    "extra": "const pattern=/\"/;phApp.ddo={\"eagerLoadRefineSearch\":{\"status\":403}};"
  },
  {
    "name": "regex-doublequote-app-replacement",
    "extra": "const pattern=/\"/;phApp={\"refNum\":\"OTHER\"};"
  }
];
for(const probe of review347SlashExact) test('review347slash exact '+probe.name,()=>rejects(page(probe.extra)));
test('review347slash exact control statement regex quotation boundary',()=>{
 rejects(page('if(true)/"/.test("x");phApp.refNum="OTHER";const end=/"/;'));
});

test('review347slash unsupported regexp expression boundaries fail closed',()=>{
 for(const extra of [
  'const pattern=(/"/);phApp.refNum="OTHER";',
  'const pattern=true?/"/:/\'/;phApp.refNum="OTHER";',
  'const pattern=/["\']/;phApp.refNum="OTHER";',
  'if(true){}/"/.test("x");phApp.refNum="OTHER";const end=/"/;',
  'while(false)/"/.test("x");phApp.refNum="OTHER";const end=/"/;',
  'const pattern=/simple/;phApp.refNum="OTHER";',
 ]) rejects(page(extra));
});
test('review347slash bounded decimal division stays readable',()=>{
 for(const extra of ['const ratio=8/2;','const ratio=(8 / 2) + (9 / 3);','const ratio=0.5/.25;','const ratio=1e3 / +2e1 / 2;','const ratio=8 / -2;']) assert.deepEqual(verifySearch(page(extra)).app,app);
 assert.throws(()=>verifySearch(page('const ratio=8/2;phApp.refNum="OTHER";')),/native app mutation/);
});
test('review347slash unsupported division operands and compound assignment fail closed',()=>{
 for(const extra of ['const ratio=amount/2;','const ratio=(8)/2;','const ratio=8/(2);','let amount=8;amount/=2;','const ratio=8 / /"/.source.length;']) rejects(page(extra));
});
test('review347slash comments and quoted slash text remain inert',()=>{
 for(const extra of ['const text="/regex/ and phApp.refNum=OTHER";','const text=`/"/ phApp.refNum=OTHER`;','/* /"/ phApp.refNum="OTHER"; */ const ratio=8/2;','// /"/ phApp.refNum="OTHER";\nconst ratio=8/2;']) assert.deepEqual(verifySearch(page(extra)).app,app);
});
