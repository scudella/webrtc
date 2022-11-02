require('dotenv').config();
const path = require('path');
const { readFileSync } = require('fs');

// protocols
const https = require('https');
const websocket = require('websocket').server;

const credentials = {
  pfx: readFileSync('/etc/scudella/scudella.pfx'),
  passphrase: readFileSync('/etc/scudella/passphrase'),
};

require('express-async-errors');
// express
const express = require('express');
const app = express();

// database
const connectDB = require('./db/connect');

// other packages
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimiter = require('express-rate-limit');
const helmet = require('helmet');
const xss = require('xss-clean');
const cors = require('cors');

// routers

const authRouter = require('./routes/authRoutes');
const userRouter = require('./routes/userRoutes');
const meetingRouter = require('./routes/meetingRoutes');

// middleware
const notFoundMiddleware = require('./middleware/not-found');
const errorHandlerMiddleware = require('./middleware/error-handler');
const { signalRequest } = require('./middleware/webSocket');

app.set('trust proxy', 1);
app.use(
  rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300, // Limit each IP to 300 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  })
);

app.use(helmet());
app.use(cors());
app.use(xss());

app.use(morgan('tiny'));

// go through all middleware
app.use(express.json());
app.use(cookieParser(process.env.JWT_SECRET));

// setup static and middleware
app.use(express.static('./public'));

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/meeting', meetingRouter);

app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

const httpsServer = https.createServer(credentials, app);

const port = process.env.PORT || 5000;
const start = async () => {
  try {
    await connectDB(process.env.MONGO_URL);
    httpsServer.listen(
      port,
      console.log(`Server is listening on port ${port}...`)
    );
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
