import express from 'express';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(
  fileURLToPath(import.meta.url)
);

const app = express();

const PORT =
  Number(process.env.PORT || 3000);

const DATA_FILE =
  path.resolve(
    process.env.DATA_FILE ||
    path.join(__dirname, 'data/schedule.json')
  );

const ADMIN_USERNAME =
  process.env.ADMIN_USERNAME || 'admin';

const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD ||
  'change-this-password';


let schedule =
  JSON.parse(
    await fs.readFile(DATA_FILE, 'utf8')
  );


app.disable('x-powered-by');

app.set('trust proxy', 1);

app.use(compression());

app.use(
  express.json({
    limit: '100kb'
  })
);

app.use(
  express.static(
    path.join(__dirname, 'public'),
    {
      maxAge: '1h'
    }
  )
);


/* =========================================================
   ADMIN RATE LIMIT
   ========================================================= */

const adminLimiter =
  rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false
  });


/* =========================================================
   CONSTANT-TIME PASSWORD CHECK
   ========================================================= */

function safeEqual(a, b) {

  const aa = Buffer.from(String(a));

  const bb = Buffer.from(String(b));

  return (
    aa.length === bb.length &&
    crypto.timingSafeEqual(aa, bb)
  );
}


/* =========================================================
   ADMIN AUTHENTICATION
   ========================================================= */

function authorized(req) {

  const h =
    req.get('authorization') || '';

  if (!h.startsWith('Basic ')) {
    return false;
  }

  try {

    const decoded =
      Buffer.from(
        h.slice(6),
        'base64'
      ).toString('utf8');

    const i =
      decoded.indexOf(':');

    return (
      i >= 0 &&
      safeEqual(
        decoded.slice(0, i),
        ADMIN_USERNAME
      ) &&
      safeEqual(
        decoded.slice(i + 1),
        ADMIN_PASSWORD
      )
    );

  } catch {

    return false;
  }
}


/* =========================================================
   VALIDATION
   ========================================================= */

function validIso(s) {

  return (
    typeof s === 'string' &&
    Number.isFinite(Date.parse(s))
  );
}


function cleanText(s, max = 240) {

  return typeof s === 'string'
    ? s.trim().slice(0, max)
    : '';
}


function validateSchedule(s) {

  if (
    !s ||
    !cleanText(s.eventName, 100) ||
    !validIso(s.start) ||
    !validIso(s.end)
  ) {

    return (
      'Event name, start and end are required.'
    );
  }


  const start =
    Date.parse(s.start);

  const end =
    Date.parse(s.end);


  if (end <= start) {

    return (
      'End time must be after start time.'
    );
  }


  if (
    !Array.isArray(s.milestones) ||
    !Array.isArray(s.announcements)
  ) {

    return (
      'Milestones and announcements must be arrays.'
    );
  }


  for (const m of s.milestones) {

    if (
      !cleanText(m.name, 100) ||
      !['offset', 'exact'].includes(m.type)
    ) {

      return 'Invalid milestone.';
    }


    if (
      m.type === 'offset' &&
      (
        !Number.isFinite(
          Number(m.minutesAfterStart)
        ) ||
        Number(m.minutesAfterStart) < 0
      )
    ) {

      return 'Invalid milestone offset.';
    }


    if (
      m.type === 'exact' &&
      !validIso(m.exactAt)
    ) {

      return (
        'Invalid milestone date-time.'
      );
    }


    const at =
      m.type === 'offset'
        ? start +
          Number(m.minutesAfterStart) *
          60000
        : Date.parse(m.exactAt);


    if (at < start || at > end) {

      return (
        'Every milestone must fall inside the event.'
      );
    }


    if (
      !Number.isFinite(
        Number(m.warnMinutes)
      ) ||
      Number(m.warnMinutes) < 0 ||
      Number(m.warnMinutes) > 1440
    ) {

      return 'Invalid warning time.';
    }
  }


  for (const a of s.announcements) {

    if (
      !cleanText(a.text, 300) ||
      !validIso(a.showFrom) ||
      !validIso(a.showUntil) ||
      Date.parse(a.showUntil) <=
        Date.parse(a.showFrom)
    ) {

      return 'Invalid announcement.';
    }
  }


  return null;
}


/* =========================================================
   PUBLIC STATE
   ========================================================= */

app.get(
  '/api/state',
  (_req, res) => {

    res.json({
      serverNow: Date.now(),
      schedule
    });

  }
);


/* =========================================================
   PUBLISH SCHEDULE
   ========================================================= */

app.put(
  '/api/state',
  adminLimiter,
  async (req, res) => {

    if (!authorized(req)) {

      return res
        .status(401)
        .set(
          'WWW-Authenticate',
          'Basic realm="Event Countdown Admin"'
        )
        .json({
          error: 'Unauthorized'
        });
    }


    const body =
      req.body || {};


    const normalized = {

      eventName:
        cleanText(body.eventName, 100),

      start:
        body.start,

      end:
        body.end,


      milestones:
        Array.isArray(body.milestones)
          ? body.milestones.map(m => ({

              id:
                cleanText(m.id, 80) ||
                crypto.randomUUID(),

              name:
                cleanText(m.name, 100),

              type:
                m.type,

              minutesAfterStart:
                Number.isFinite(
                  Number(m.minutesAfterStart)
                )
                  ? Number(m.minutesAfterStart)
                  : null,

              exactAt:
                m.exactAt || null,

              warnMinutes:
                Number.isFinite(
                  Number(m.warnMinutes)
                )
                  ? Number(m.warnMinutes)
                  : 5,

              message:
                cleanText(
                  m.message,
                  300
                )

            }))
          : [],


      announcements:
        Array.isArray(body.announcements)
          ? body.announcements.map(a => ({

              id:
                cleanText(a.id, 80) ||
                crypto.randomUUID(),

              text:
                cleanText(a.text, 300),

              showFrom:
                a.showFrom,

              showUntil:
                a.showUntil

            }))
          : []
    };


    const error =
      validateSchedule(normalized);


    if (error) {

      return res
        .status(400)
        .json({ error });
    }


    normalized.updatedAt =
      new Date().toISOString();


    schedule =
      normalized;


    await fs.writeFile(
      DATA_FILE,
      JSON.stringify(
        schedule,
        null,
        2
      )
    );


    res.json({
      serverNow: Date.now(),
      schedule
    });

  }
);


/* =========================================================
   STOP EVENT
   ========================================================= */

app.post(
  '/api/stop',
  adminLimiter,
  async (req, res) => {

    if (!authorized(req)) {

      return res
        .status(401)
        .set(
          'WWW-Authenticate',
          'Basic realm="Event Countdown Admin"'
        )
        .json({
          error: 'Unauthorized'
        });
    }


    const now =
      new Date().toISOString();


    /*
     * Immediately end the event.
     *
     * We intentionally do NOT run the normal
     * schedule validation here because milestones
     * that were scheduled for later would otherwise
     * be outside the newly shortened event.
     */

    schedule = {

      ...schedule,

      end: now,

      updatedAt: now,

      stoppedAt: now

    };


    await fs.writeFile(
      DATA_FILE,
      JSON.stringify(
        schedule,
        null,
        2
      )
    );


    res.json({

      serverNow: Date.now(),

      schedule

    });

  }
);


/* =========================================================
   ADMIN PAGE
   ========================================================= */

app.get(
  '/admin',
  (req, res) => {

    if (!authorized(req)) {

      return res
        .status(401)
        .set(
          'WWW-Authenticate',
          'Basic realm="Event Countdown Admin"'
        )
        .send(
          'Admin authentication required'
        );
    }


    res.sendFile(
      path.join(
        __dirname,
        'public/admin.html'
      )
    );

  }
);


/* =========================================================
   PUBLIC PAGE
   ========================================================= */

app.get(
  '/*splat',
  (_req, res) => {

    res.sendFile(
      path.join(
        __dirname,
        'public/index.html'
      )
    );

  }
);


/* =========================================================
   START SERVER
   ========================================================= */

app.listen(
  PORT,
  () => {

    console.log(
      `Event Countdown running on http://localhost:${PORT}`
    );

  }
);