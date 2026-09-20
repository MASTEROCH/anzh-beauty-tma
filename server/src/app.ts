import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { config } from './config.ts';
import { ApiError, forbidden, unauthorized } from './errors.ts';
import { verifyToken, type SessionClaims } from './lib/jwt.ts';
import { registerHealth } from './routes/health.ts';
import { registerAuth } from './routes/auth.ts';
import { registerCatalog } from './routes/catalog.ts';
import { registerBookings } from './routes/bookings.ts';
import { registerTeam } from './routes/team.ts';
import { registerClients } from './routes/clients.ts';

declare module 'fastify' {
  interface FastifyRequest {
    session?: SessionClaims;
  }
  interface FastifyInstance {
    /**
     * Все поднятые маршруты — список, а не дерево для глаз.
     *
     * Нужен затем, чтобы машинно сверять openapi.yaml с кодом: описание
     * расходится молча, и узнают об этом на стыковке. Разбор текстового
     * вывода printRoutes для этого не годится — он пропускает вложенные
     * пути и меняется между версиями Fastify.
     */
    registeredRoutes: { method: string; url: string }[];
  }
}

/**
 * Сессия из заголовка Authorization. Роль в токене — снимок на момент
 * входа; для решений об объекте она перепроверяется по базе в том месте,
 * где принимается решение (контракт §12: право проверяется на конкретный
 * объект, а не только факт входа).
 */
export function requireSession(req: FastifyRequest): SessionClaims {
  if (!req.session) throw unauthorized();
  return req.session;
}

export function requireRole(
  req: FastifyRequest,
  ...roles: SessionClaims['role'][]
): SessionClaims {
  const s = requireSession(req);
  if (!roles.includes(s.role)) throw forbidden();
  return s;
}

export function buildApp(): FastifyInstance {
  const app = Fastify({
    // 🚨 Тело запроса не логируется никогда. В нём анкета, заметки
    // мастера и комментарий к заявке — то есть данные о здоровье
    // (контракт §6.4). Fastify по умолчанию тело не пишет; отключаем и
    // соблазн включить его «на время отладки».
    //
    // ⚠️ В Fastify 6 этот флаг заменяется на logController. Защита здесь
    // намеренно двойная: даже если при обновлении флаг тихо исчезнет,
    // сериализаторы ниже всё равно не пропустят в журнал ни тело, ни
    // заголовки. Терять её нельзя — в Authorization лежит живой токен.
    disableRequestLogging: true,
    logger: {
      level: config.isProduction ? 'info' : 'debug',
      // Из запроса в журнал уходят метод, путь и код ответа. Ни строки
      // запроса с параметрами, ни заголовков: в Authorization лежит
      // действующий токен.
      serializers: {
        req: (req) => ({ method: req.method, url: req.url.split('?')[0] }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    },
    // За обратным прокси иначе во всех журналах один и тот же адрес.
    trustProxy: true,
    bodyLimit: 256 * 1024,
  });

  const routes: { method: string; url: string }[] = [];
  app.decorate('registeredRoutes', routes);
  app.addHook('onRoute', (route) => {
    const methods = Array.isArray(route.method) ? route.method : [route.method];
    for (const method of methods) routes.push({ method, url: route.url });
  });

  // --- CORS ---------------------------------------------------------
  // Вручную и по списку. Библиотека здесь дала бы соблазн поставить «*»,
  // а это значит, что любой сайт сможет ходить в API от имени открывшего
  // его человека.
  app.addHook('onRequest', async (req, reply) => {
    const origin = req.headers.origin;
    if (origin && config.corsOrigins.includes(origin.replace(/\/$/, ''))) {
      reply.header('Access-Control-Allow-Origin', origin);
      reply.header('Vary', 'Origin');
      reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key');
      reply.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
      reply.header('Access-Control-Max-Age', '600');
    }
    if (req.method === 'OPTIONS') {
      reply.code(204).send();
    }
  });

  // --- Заголовки безопасности (контракт §12) -------------------------
  app.addHook('onSend', async (_req, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'no-referrer');
    // API отдаёт только JSON и ничего не встраивает: запрещаем всё.
    reply.header(
      'Content-Security-Policy',
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    );
    reply.header('Cross-Origin-Resource-Policy', 'same-site');
    return payload;
  });

  // --- Сессия --------------------------------------------------------
  app.addHook('onRequest', async (req) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) return;
    const result = verifyToken(header.slice(7).trim(), config.jwtSecret, config.appSource);
    // Негодный токен не роняет запрос здесь: публичные эндпоинты должны
    // работать и с протухшим токеном в заголовке. Отказ выдаёт
    // requireSession там, где сессия действительно нужна.
    if (result.ok) req.session = result.claims;
  });

  // --- Единая форма ошибки (контракт §7.1) ---------------------------
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ApiError) {
      reply.code(err.status).send(err.toBody());
      return;
    }

    // Нарушение уникальности из базы — это конфликт, а не поломка.
    const pgCode = (err as { code?: string }).code;
    if (pgCode === '23505') {
      reply.code(409).send({ error: { code: 'conflict', message: 'Уже существует' } });
      return;
    }

    if ((err as { statusCode?: number }).statusCode === 400) {
      reply.code(422).send({ error: { code: 'invalid', message: 'Некорректный запрос' } });
      return;
    }

    // Всё остальное — наша ошибка. В журнал полностью, наружу — ничего:
    // ни трассировки, ни текста запроса к базе (контракт §12).
    req.log.error({ err }, 'unhandled');
    reply.code(500).send({ error: { code: 'internal', message: 'Что-то пошло не так' } });
  });

  app.setNotFoundHandler((_req, reply) => {
    reply.code(404).send({ error: { code: 'not_found', message: 'Не найдено' } });
  });

  // --- Маршруты ------------------------------------------------------
  // Версия в пути: старые сборки приложения живут в кэше Telegram днями
  // (контракт §7.1).
  app.register(
    async (v1) => {
      await registerHealth(v1);
      await registerAuth(v1);
      await registerCatalog(v1);
      await registerBookings(v1);
      await registerTeam(v1);
      await registerClients(v1);
    },
    { prefix: '/api/v1' },
  );

  return app;
}
