import assert from 'node:assert/strict';
import test from 'node:test';
import { ESLint } from 'eslint';

test('backend lint rejects semantic defects that the syntax parser accepts', async () => {
  const [result] = await new ESLint().lintText("export const data = {role: 'user', role: 'admin'}; missingGuard(); window.localStorage.clear();", {
    filePath: 'src/securityLintCanary.js',
  });
  assert.ok(result.messages.some(message => message.ruleId === 'no-dupe-keys' && message.severity === 2));
  assert.ok(result.messages.some(message => message.ruleId === 'no-undef' && message.severity === 2));
  assert.ok(result.messages.some(message => message.ruleId === 'no-undef' && message.message.includes('window')));
});
