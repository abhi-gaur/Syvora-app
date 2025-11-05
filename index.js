// index.js - simple Express app with Postgres and Prometheus metrics
const express = require('express');
const morgan = require('morgan');
const { Pool } = require('pg');
require('express-async-errors');
const client = require('prom-client');

const app = express();
app.use(express.json());
app.use(morgan('combined'));

// Prom-client default metrics + histograms/counters
client.collectDefaultMetrics({ timeout: 5000 });

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'code'],
  buckets: [0.005,0.01,0.05,0.1,0.3,0.5,1,2,5]
});

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Count of HTTP requests',
  labelNames: ['method','route','code']
});

// DB
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@db:5432/postgres',
  // optional SSL settings for production
});

// timing middleware
app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    const route = req.route && req.route.path ? req.route.path : req.path;
    end({ method: req.method, route, code: res.statusCode });
    httpRequestsTotal.inc({ method: req.method, route, code: res.statusCode }, 1);
  });
  next();
});

app.get('/healthz', (_, res) => res.status(200).send('ok'));

const itemsRouter = require('./routes/items');
app.use('/items', itemsRouter(pool));

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

// error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'internal error' });
});

// --- keep the rest of your file above unchanged ---

const PORT = process.env.PORT || 3000;

// Wait-for-DB logic: attempt to connect a few times before starting HTTP server
async function waitForDBAndStart(retries = 12, delayMs = 5000) {
  for (let i = 1; i <= retries; i++) {
    try {
      await pool.query('SELECT 1');
      console.log('DB ready, starting server');
      // start the HTTP server only once DB is reachable
      const server = app.listen(PORT, () => console.log(`webapp listening on ${PORT}`));

      // handle graceful shutdown
      const shutdown = (signal) => {
        console.info(`Received ${signal}. Closing HTTP server and DB pool...`);
        server.close(async () => {
          try {
            await pool.end();
            console.info('DB pool closed, exiting.');
            process.exit(0);
          } catch (err) {
            console.error('Error closing DB pool:', err);
            process.exit(1);
          }
        });
        // fall back to forceful exit after a timeout
        setTimeout(() => {
          console.error('Forcing shutdown.');
          process.exit(1);
        }, 30000).unref();
      };

      process.on('SIGINT', () => shutdown('SIGINT'));
      process.on('SIGTERM', () => shutdown('SIGTERM'));

      // catch unhandled rejections and log them (optionally exit)
      process.on('unhandledRejection', (reason, promise) => {
        console.error('Unhandled Rejection at:', promise, 'reason:', reason);
        // depending on policy you may want to exit here; for now we log
      });

      return;
    } catch (err) {
      console.warn(`DB not ready (attempt ${i}/${retries}): ${err.message}`);
      if (i === retries) {
        console.error('DB did not become ready in time, exiting');
        process.exit(1); // fail fast; orchestrator should restart
      }
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

waitForDBAndStart();

