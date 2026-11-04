// NestJS integration tests assert with supertest's `.expect(…)`: real ESLint (opt-in, see lint-real.test.mjs).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aquila, dropWorkspace, lintWorkspace } from './helpers.mjs';

const DEPS = process.env.AQUILA_LINT_DEPS;
const skip = DEPS ? false : 'set AQUILA_LINT_DEPS to run ESLint for real';

test('NestJS: an e2e test whose only assertion is supertest `.expect(200)` passes sonarjs/assertions-in-tests', { skip }, () => {
  const { top, root } = lintWorkspace(DEPS, {
    'src/app.ts': 'export const app = { getHttpServer: (): unknown => null };\n',
    'test/users.e2e-spec.ts': [
      "import request from 'supertest';",
      "import { app } from '../src/app';",
      '',
      'const api = () => request(app.getHttpServer());',
      '',
      "describe('users', () => {",
      "  it('lists', async () => {",
      "    await api().post('/users').send({ name: 'a' }).expect(201);",
      '  });',
      "  it('gets', () => request(app.getHttpServer()).get('/users').expect(200));",
      '});',
      '',
    ].join('\n'),
    'tsconfig.json': JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'commonjs', strict: true, esModuleInterop: true, skipLibCheck: true, types: [] }, include: ['src', 'test'] }),
  });
  try {
    assert.equal(aquila(root, 'init', '--tools=codex', '--lint=high').code, 0);
    assert.doesNotMatch(aquila(root, 'lint').out, /assertions-in-tests/);
  } finally {
    dropWorkspace(top);
  }
});
