import { buildApp } from './app.ts';
import { config } from './config.ts';
import { closeDatabase } from './db.ts';

const app = buildApp();

// Остановка по сигналу, а не по обрыву: недорасказанный ответ и открытое
// соединение с базой на перезапуске дают «загадочные» ошибки у клиента,
// которые потом ищут в прикладном коде.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    app.log.info({ signal }, 'останавливаемся');
    void app
      .close()
      .then(closeDatabase)
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  });
}

try {
  await app.listen({ port: config.port, host: config.host });
} catch (err) {
  app.log.error({ err }, 'не удалось занять порт');
  process.exit(1);
}
