// openapi.yaml — главный артефакт поставки (контракт §0.1): под
// зафиксированным контрактом бэкенд можно позже заменить целиком, не
// тронув фронтенд.
//
// Ценность у него ровно до тех пор, пока он совпадает с кодом.
// Расходится описание молча: эндпоинт переименовали, документ остался
// прежним, и узнают об этом на стыковке. Поэтому сверка машинная, а не
// «не забыть обновить».

import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { startHarness, type Harness } from './harness.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const METHODS = ['get', 'post', 'patch', 'put', 'delete'] as const;

interface Spec {
  openapi: string;
  info: { title: string; version: string };
  paths: Record<string, Record<string, unknown>>;
  components: { schemas: Record<string, unknown>; responses: Record<string, unknown> };
}

let spec: Spec;
let h: Harness;

/** Фактические маршруты сервера, приведённые к форме OpenAPI. */
function actualRoutes(): Set<string> {
  const out = new Set<string>();
  for (const { method, url } of h.app.registeredRoutes) {
    const verb = method.toLowerCase();
    // HEAD Fastify добавляет к каждому GET сам, OPTIONS обслуживает CORS.
    if (verb === 'head' || verb === 'options') continue;
    if (!url.startsWith('/api/v1/')) continue;
    out.add(`${verb} ${url.replace(/^\/api\/v1/, '').replace(/:([A-Za-z0-9_]+)/g, '{$1}')}`);
  }
  return out;
}

function specRoutes(): Set<string> {
  const out = new Set<string>();
  for (const [path, item] of Object.entries(spec.paths)) {
    for (const method of METHODS) {
      if (item[method]) out.add(`${method} ${path}`);
    }
  }
  return out;
}

before(async () => {
  spec = parse(await readFile(join(ROOT, 'openapi.yaml'), 'utf8')) as Spec;
  h = await startHarness();
});

after(async () => {
  await h.stop();
});

describe('openapi.yaml', () => {
  test('разбирается и объявляет версию', () => {
    assert.match(spec.openapi, /^3\.\d+\.\d+$/);
    assert.ok(spec.info.title);
    assert.ok(spec.info.version);
  });

  test('🚨 описывает РОВНО те маршруты, что поднимает сервер', () => {
    const real = actualRoutes();
    const described = specRoutes();

    const undocumented = [...real].filter((r) => !described.has(r)).sort();
    const phantom = [...described].filter((r) => !real.has(r)).sort();

    assert.deepEqual(
      undocumented,
      [],
      'эндпоинты есть в коде, но не описаны — фронтенд о них не узнает',
    );
    assert.deepEqual(
      phantom,
      [],
      'описаны эндпоинты, которых нет — по такому документу клиент напишут неверно',
    );
  });

  test('каждая операция объявляет успех и хотя бы один неуспех', () => {
    for (const [path, item] of Object.entries(spec.paths)) {
      for (const method of METHODS) {
        const op = item[method] as
          | {
              responses?: Record<string, unknown>;
              parameters?: unknown[];
              requestBody?: unknown;
              security?: unknown[];
            }
          | undefined;
        if (!op) continue;

        const codes = Object.keys(op.responses ?? {});
        assert.ok(
          codes.some((c) => c.startsWith('2')),
          `${method.toUpperCase()} ${path}: нет успешного ответа`,
        );

        // Исключение ровно одно и по существу: операция, которой клиент
        // не передаёт НИЧЕГО — ни параметров, ни тела, ни сессии, — не
        // может отказать по его вине. Таких две: проба живости и
        // публичный состав студии. Придумывать им 4xx ради круглого
        // правила значило бы описать несуществующее поведение.
        const takesNothing =
          !op.parameters?.length &&
          !op.requestBody &&
          Array.isArray(op.security) &&
          op.security.length === 0;
        if (takesNothing) continue;

        // Не обязательно 4xx: у /health неуспех это 503 — база
        // недоступна, и вины клиента в этом нет.
        assert.ok(
          codes.some((c) => c.startsWith('4') || c.startsWith('5')),
          `${method.toUpperCase()} ${path}: описан только успех`,
        );
      }
    }
  });

  test('закрытые эндпоинты не помечены как публичные, и наоборот', () => {
    // Витрина, здоровье и вход — единственное, что работает без сессии.
    const PUBLIC = new Set([
      'get /health',
      'get /health/live',
      'post /auth/telegram',
      'get /services',
      'get /services/{slug}',
      'get /team',
    ]);

    for (const [path, item] of Object.entries(spec.paths)) {
      for (const method of METHODS) {
        const op = item[method] as { security?: unknown[] } | undefined;
        if (!op) continue;
        const key = `${method} ${path}`;
        const declaredPublic = Array.isArray(op.security) && op.security.length === 0;
        assert.equal(
          declaredPublic,
          PUBLIC.has(key),
          declaredPublic
            ? `${key} объявлен публичным, а в списке публичных его нет`
            : `${key} должен быть публичным, но требует сессию`,
        );
      }
    }
  });

  test('все $ref разрешаются', () => {
    const missing: string[] = [];
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (!node || typeof node !== 'object') return;
      for (const [key, value] of Object.entries(node)) {
        if (key === '$ref' && typeof value === 'string') {
          const parts = value.replace(/^#\//, '').split('/');
          let cursor: unknown = spec;
          for (const p of parts) {
            cursor = (cursor as Record<string, unknown> | undefined)?.[p];
          }
          if (cursor === undefined) missing.push(value);
        } else walk(value);
      }
    };
    walk(spec.paths);
    assert.deepEqual(missing, []);
  });

  test('заявленные публичные эндпоинты действительно отвечают без сессии', async () => {
    for (const url of ['/health', '/health/live', '/services', '/team']) {
      const res = await h.app.inject({ method: 'GET', url: `/api/v1${url}` });
      assert.notEqual(res.statusCode, 401, `${url} обещан публичным, но требует сессию`);
    }
  });
});
