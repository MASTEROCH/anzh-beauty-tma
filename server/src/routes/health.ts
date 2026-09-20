import type { FastifyInstance } from 'fastify';
import { pingDatabase } from '../db.ts';

// Контракт §14: отвечает и без базы, и с базой.
//
// Два разных вопроса в одном ответе: «процесс жив» и «процесс видит
// базу». Проверка, которая падает целиком при недоступной базе, не
// отличает упавший сервер от упавшей базы — и балансировщик снимает
// живой процесс вместо того, чтобы показать настоящую причину.

export async function registerHealth(app: FastifyInstance): Promise<void> {
  app.get('/health', async (_req, reply) => {
    const startedAt = Date.now();
    const db = await pingDatabase();
    reply.code(db ? 200 : 503).send({
      status: db ? 'ok' : 'degraded',
      process: 'ok',
      database: db ? 'ok' : 'unreachable',
      took_ms: Date.now() - startedAt,
      time: new Date().toISOString(),
    });
  });

  // Живость без обращения к базе: для перезапуска по таймауту.
  app.get('/health/live', async () => ({ status: 'ok' }));
}
