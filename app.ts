import * as dotenv from 'dotenv';
dotenv.config();
import 'express-async-errors';
import express from 'express';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import cors from 'cors';
import { connectDB } from './db/connect.js';
import { rateLimit } from 'express-rate-limit';
import authRouter from './routes/authRoutes.js';
import userRouter from './routes/userRoutes.js';
import meetingRouter from './routes/meetingRoutes.js';
import notFoundMiddleware from './middleware/not-found.js';
import errorHandlerMiddleware from './middleware/error-handler.js';
import { signalRequest } from './middleware/webSocket.js';
import * as prometheusClient from 'prom-client';
import * as ws from 'websocket';
import { readFileSync } from 'fs';
import * as https from 'https';

const websocket = ws.server;

const credentials = {
  pfx: readFileSync('/etc/scudella/scudella.pfx'),
  passphrase: readFileSync('/etc/scudella/passphrase').toString('utf8'),
};

const app = express();

const register = new prometheusClient.Registry();
// Enable the collection of default Node.js process metrics
prometheusClient.collectDefaultMetrics({ register });

const httpRequestCounter = new prometheusClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path'],
  registers: [register],
});

// Middleware to track request count
app.use((req, _, next) => {
  httpRequestCounter.inc({ method: req.method, path: req.path });
  next();
});

// Expose a /metrics endpoint for Prometheus
app.get('/metrics', async (_, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.set('trust proxy', 1);
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 400, // Limit each IP to 400 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  })
);

app.use(
  helmet.contentSecurityPolicy({
    directives: {
      scriptSrc: ["'self'", 'https://accounts.google.com/gsi/client'],
      defaultSrc: ["'self'", 'https://accounts.google.com'],
      styleSrc: [
        "'self'",
        'https://accounts.google.com/gsi/style',
        'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/',
        "'unsafe-inline'",
      ],
      imgSrc: [
        "'self'",
        'https://lh3.googleusercontent.com',
        `${process.env.CLOUDINARY_IMAGES}`,
      ],
    },
  })
);
app.use(
  helmet.crossOriginOpenerPolicy({
    policy: 'same-origin-allow-popups',
  })
);
app.use(
  helmet.referrerPolicy({
    policy: 'strict-origin-when-cross-origin',
  })
);

app.use(cors());

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('tiny'));
}

// go through all middleware
app.use(express.json());
app.use(cookieParser(process.env.JWT_SECRET));
app.use(mongoSanitize());

// setup static and middleware
app.use(express.static('./public'));

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/meeting', meetingRouter);

app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

const httpsServer = https.createServer(credentials, app);

const port = process.env.PORT || 5000;
const mongoURL = process.env.MONGO_URL ?? '';
const start = async () => {
  try {
    await connectDB(mongoURL);
    httpsServer.listen(port, () => {
      console.log(`Server is listening on port ${port}...`);
    });
  } catch (error) {
    console.log(error);
  }
};

start();

// web socket functions
const websocketServer = new websocket({
  httpServer: httpsServer,
  autoAcceptConnections: false,
});
websocketServer.on('request', signalRequest);
