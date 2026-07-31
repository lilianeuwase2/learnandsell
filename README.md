# Learn and Sell

**Live demo:** https://learnandsell.onrender.com

Learn and Sell teaches out-of-school girls in Rwanda tailoring, beading and
basket weaving in English then unlocks their own digital shop the moment they graduate, with MTN MoMo and Airtel Money (simulated)
built in. Buyers can browse the marketplace, pay, and track orders; admins
manage courses, users and see platform-wide reports.

MTN MoMo / Airtel Money payment is **simulated** 

## 1. Project structure

```
learn-and-sell/
├── README.md
├── .gitignore
└── backend/
    ├── .env.example
    ├── package.json
    ├── package-lock.json
    ├── db/
    │   ├── schema.sql          
    │   └── seed.sql            
    ├── public/                 
    │   ├── index.html
    │   ├── script.js
    │   ├── styles.css
    │   ├── images/
    │   │   ├── courses/        
    │   │   └── products/       
    │   └── videos/            
    │                            
    │                          
    └── src/
        ├── db.js                
        ├── index.js             
        ├── middleware/
        │   └── auth.js           
        └── routes/
            ├── auth.js
            ├── courses.js
            ├── enrollments.js
            ├── shops.js
            ├── products.js
            ├── orders.js
            ├── reviews.js
            ├── notifications.js
            └── admin.js
```


## 2. Prerequisites

- Node.js 18+
- PostgreSQL 14+ (local install, or a hosted instance like Render's)

## 3. Local setup

First, clone the repository and navigate into the backend directory:
```bash
git clone https://github.com/lilianeuwase2/learnandsell.git
cd learn-and-sell/backend
npm install


Create a new file name a .env in the backend directory and add the following configuration 
```bash
PORT=4000
DATABASE_URL=postgresql://postgres:<your_local_password>@localhost:5432/learn_and_sell
JWT_SECRET=change_this_to_a_long_random_string
JWT_EXPIRES_IN=7d
```

Ensure that the postgreSQL service is running then create the database and load the schema and demo data:
```bash
createdb learn_and_sell
psql -U postgres -d learn_and_sell -f db/schema.sql
psql -U postgres -d learn_and_sell -f db/seed.sql
```

Run the application :
```bash
npm run dev    
# or
npm start
```

Open **http://localhost:4000** — front end and API are both served from
here. `GET /api/health` confirms the API is up.


## 4. Media hosting
 
All product/course photos and lesson videos are hosted on **Cloudinary**
(free tier) rather than committed to the repo large or numerous media
files don't push cleanly through git, and Cloudinary gives a stable direct
URL for each file. Only the resulting URLs are stored in the database:
`courses.image_url`, `products.image_url`, and `lessons.video_url`.
  

## 5. Offline lesson downloads

Each lesson can be downloaded for offline viewing via the browser's Cache
Storage API (`script.js` `downloadLessonForOffline` /
`isLessonDownloaded` / `removeLessonDownload`).

## 6. Payment simulation

No real telco integration exists yet, but the flow's *shape* matches a real
MoMo/Airtel "request to pay" integration closely enough to swap one in
later without touching anything else:

1. `POST /api/orders/checkout` creates the order + a `payments` row with
   status `pending`, validates the phone number against each provider's
   real Rwandan prefixes (MTN MoMo: `078`/`079`, Airtel Money: `072`/`073`),
   and returns immediately.
2. If the number is valid, a `setTimeout` resolves the payment to
   `confirmed` after ~2.5 seconds, simulating the subscriber approving the
   prompt on their phone.
3. The front end polls `GET /api/orders/:id/payment` every second and shows
   a live "waiting for approval on your phone…" , "Payment confirmed" state.
4. `POST /api/orders/:id/payment/retry` lets a buyer fix a bad number and
   retry without replacing the order.
5. A seller **cannot** advance an order to "shipped" until its payment is
   `confirmed` (`PATCH /api/orders/:id/advance` returns `409` otherwise) —
   payment genuinely gates fulfilment.

## 7. API overview

All routes are under `/api`. Except where noted, they require
`Authorization: Bearer <token>` from register/login. Role-restricted routes
return `403` with a clear message if the wrong role is used.

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `PATCH /auth/me`, `POST /auth/forgot-password` |
| Courses | `GET /courses` *(public)*, `POST /courses` (admin), `DELETE /courses/:id` (admin) |
| Enrollment | `GET /enrollments/me`, `POST /enrollments`, `POST /enrollments/:courseId/lessons/complete`, `POST /enrollments/:courseId/quiz` |
| Shop | `GET /shops/me`, `POST /shops`, `GET /shops/me/earnings`, `POST /shops/me/payout` |
| Products | `GET /products` *( `category`, `search`, `maxPrice`)*, `GET /products/mine`, `POST /products`, `PUT /products/:id`, `PATCH /products/:id/stock`, `DELETE /products/:id` |
| Orders | `POST /orders/checkout`, `GET /orders/:id/payment`, `POST /orders/:id/payment/retry`, `GET /orders/mine` (buyer), `GET /orders/seller`, `PATCH /orders/:id/advance` |
| Reviews | `POST /reviews`, `GET /reviews/mine`, `GET /reviews?productName=` *(public)* |
| Notifications | `GET /notifications`, `PATCH /notifications/read-all` |
| Admin | `GET /admin/overview`, `GET /admin/users`, `PATCH /admin/users/:id/toggle-active`, `GET /admin/products`, `DELETE /admin/products/:id`, `GET /admin/reports` |

## 8. Roles

- **Learner** (student/seller): enrolls in one course at a time, completes
  lessons, passes a quiz to graduate, unlocks a shop, lists products,
  fulfils orders, requests payouts.
- **Buyer**: browses the marketplace, adds to cart, checks out, tracks
  orders, leaves reviews.
- **Admin**: manages courses, suspends/reactivates users, removes
  marketplace listings, views platform-wide reports.

