require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

const ROUTER_METHODS_TO_WRAP = ['get', 'post', 'put', 'patch', 'delete', 'use', 'all'];

function wrapAsyncHandler(handler) {
  if (typeof handler !== 'function') return handler;
  if (handler.length >= 4) return handler;
  return function wrappedHandler(req, res, next) {
    try {
      const maybePromise = handler(req, res, next);
      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise.catch(next);
      }
    } catch (err) {
      next(err);
    }
  };
}

function enableAsyncErrorForwarding() {
  const routerPrototype = Object.getPrototypeOf(express.Router());
  if (routerPrototype.__asyncForwardingEnabled) return;

  ROUTER_METHODS_TO_WRAP.forEach((method) => {
    const originalMethod = routerPrototype[method];
    routerPrototype[method] = function patchedRouterMethod(...handlers) {
      const wrappedHandlers = handlers.map((handler) => {
        if (Array.isArray(handler)) return handler.map(wrapAsyncHandler);
        return wrapAsyncHandler(handler);
      });
      return originalMethod.apply(this, wrappedHandlers);
    };
  });

  routerPrototype.__asyncForwardingEnabled = true;
}

enableAsyncErrorForwarding();

const authRoutes = require('./routes/auth');
const courseRoutes = require('./routes/courses');
const enrollmentRoutes = require('./routes/enrollments');
const shopRoutes = require('./routes/shops');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const reviewRoutes = require('./routes/reviews');
const notificationRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/shops', shopRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);

// serve the front end (index.html, script.js, styles.css, images/, videos/)
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// any GET that isn't /api/... and isn't a static file falls back to index.html
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// centralized error handler — every route above can just `throw` or reject
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Something went wrong' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Learn and Sell API listening on port ${PORT}`));
