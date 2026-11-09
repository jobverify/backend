import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const script = new URL('../scripts/sweepDeleteUser.js', import.meta.url).href;
function run({ failPending = false, failCleanup = false } = {}) {
  const sources = {
    'fixture:dotenv': 'export default {config(){}};',
    'fixture:mongoose': "export default {async disconnect(){console.log('fixture-disconnected')}};",
    'fixture:database': 'export default async function() {};',
    'fixture:User': "export default {async findOne(){return {_id:'user-1',email:'fixture@gmail.com'}},async deleteOne(){}};",
    'fixture:PendingUser': 'export default {async deleteMany(){' + (failPending ? "throw new Error('fixture database failure')" : 'return {deletedCount:0}') + '}};',
    'fixture:legacy': 'export default {async deleteMany(){return {deletedCount:1}}};',
    'fixture:cleanup': 'export async function removeUserAccount(user){' + (failCleanup ? "throw new Error('fixture cleanup failure')" : "console.log('fixture-account-cleanup:'+user._id+':'+user.email)") + '}',
  };
  const harness = [
    "import { registerHooks } from 'node:module';",
    "process.env.NODE_ENV = 'test'; process.argv[2] = 'fixture@gmail.com';",
    'const sources = ' + JSON.stringify(sources) + ';',
    String.raw`
    registerHooks({
      resolve(specifier, context, next) {
        let url;
        if (specifier === 'dotenv') url = 'fixture:dotenv';
        else if (specifier === 'mongoose') url = 'fixture:mongoose';
        else if (specifier.endsWith('/db/db.js')) url = 'fixture:database';
        else if (specifier.endsWith('/services/userAccountDeletion.js')) url = 'fixture:cleanup';
        else if (specifier.endsWith('/models/User.js')) url = 'fixture:User';
        else if (specifier.endsWith('/models/PendingUser.js')) url = 'fixture:PendingUser';
        else if (specifier.includes('/models/')) url = 'fixture:legacy';
        return url ? {url,shortCircuit:true} : next(specifier,context);
      },
      load(url,context,next) { return url in sources ? {format:'module',source:sources[url],shortCircuit:true} : next(url,context); }
    });`,
    'await import(' + JSON.stringify(script) + ');',
  ].join('\n');
  return spawnSync(process.execPath, ['--input-type=module', '--eval', harness], { encoding: 'utf8', windowsHide: true, timeout: 15000 });
}

test('failed user maintenance exits unsuccessfully and still disconnects the database', () => {
  const result = run({ failPending: true });
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /fixture database failure/);
  assert.match(result.stdout, /fixture-disconnected/);
});
test('user maintenance delegates complete account cleanup with the resolved account identity', () => {
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /fixture-account-cleanup:user-1:fixture@gmail.com/);
  assert.match(result.stdout, /fixture-disconnected/);
});
test('a failed linked-data cleanup preserves a failed exit and closes the maintenance connection', () => {
  const result = run({ failCleanup: true });
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /fixture cleanup failure/);
  assert.match(result.stdout, /fixture-disconnected/);
});
