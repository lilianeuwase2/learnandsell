-- Demo/seed data mirroring the current front-end mock content.
-- Run with: psql -U postgres -d learn_and_sell -f db/seed.sql

INSERT INTO courses (id, name, icon, image_url, color, duration, description) VALUES
  ('11111111-1111-1111-1111-111111111111','Tailoring','🧵','images/courses/tailoring.jpg','pill-mint','6 weeks','Cut, sew and finish garments from measurement to hem.'),
  ('22222222-2222-2222-2222-222222222222','Beading','📿','images/courses/beading.jpg','pill-amber','3 weeks','Design and string beaded jewellery and accessories.'),
  ('33333333-3333-3333-3333-333333333333','Basket weaving','🧺','images/courses/basket-weaving.jpg','pill-blue','4 weeks','Traditional Rwandan weaving using sisal and banana fibre.');

INSERT INTO lessons (course_id, title, order_index, video_url) VALUES
  ('11111111-1111-1111-1111-111111111111','Reading a measuring tape',0,'videos/tailoring-measuring-tape.mp4'),
  ('11111111-1111-1111-1111-111111111111','Cutting your first pattern',1,NULL),
  ('11111111-1111-1111-1111-111111111111','Machine stitching basics',2,NULL),
  ('11111111-1111-1111-1111-111111111111','Finishing seams and hems',3,NULL),
  ('22222222-2222-2222-2222-222222222222','Bead types and tools',0,'videos/beading-bead-types.mp4'),
  ('22222222-2222-2222-2222-222222222222','Stringing techniques',1,NULL),
  ('22222222-2222-2222-2222-222222222222','Pattern design',2,NULL),
  ('22222222-2222-2222-2222-222222222222','Clasps and finishing',3,NULL),
  ('33333333-3333-3333-3333-333333333333','Preparing fibre',0,NULL),
  ('33333333-3333-3333-3333-333333333333','Base weaving',1,NULL),
  ('33333333-3333-3333-3333-333333333333','Building the walls',2,NULL),
  ('33333333-3333-3333-3333-333333333333','Rim finishing',3,NULL);

INSERT INTO quizzes (course_id, question, options, correct_index) VALUES
  ('11111111-1111-1111-1111-111111111111', 'What''s the safest way to finish your first seam?',
   '["Sew slowly and check tension every few stitches","Sew as fast as possible to save thread","Skip the backstitch at the end"]', 0),
  ('22222222-2222-2222-2222-222222222222', 'Why knot between beads on a bracelet?',
   '["It looks decorative only","It stops the whole strand unravelling if one part breaks","It is not necessary"]', 1),
  ('33333333-3333-3333-3333-333333333333', 'Why soak fibre before weaving?',
   '["To make it more flexible and less likely to crack","To change its colour","It is optional and rarely done"]', 0);

-- Demo admin account: contact "admin@learnandsell.rw", password "admin1234"
-- (password_hash generated with bcrypt below at seed-time by the app instead;
--  see src/scripts/createAdmin.js for a scripted way to add this safely.)

-- Demo seller (graduated + shop + products) so the marketplace isn't empty
-- on first run. Login: contact "demo.seller@learnandsell.rw", password "demo1234"
INSERT INTO users (id, name, contact, password_hash, role, language, active)
VALUES ('99999999-9999-9999-9999-999999999999','Demo Sellers','demo.seller@learnandsell.rw',
  '$2a$10$dWq8qMyHhcd5qN.EckkQX.J9caDdEXZyKDaZJtOv.mEija4FWgftG','learner','English', true);

INSERT INTO enrollments (user_id, course_id, lessons_done, quiz_passed, graduated_at)
VALUES ('99999999-9999-9999-9999-999999999999','11111111-1111-1111-1111-111111111111',4,true, now());

INSERT INTO shops (id, owner_id, name, description, category, momo_provider, momo_number)
VALUES ('88888888-8888-8888-8888-888888888888','99999999-9999-9999-9999-999999999999',
  'Demo Sellers','Sample listings to showcase the marketplace','Tailoring','MTN MoMo','0780000000');

INSERT INTO products (shop_id, name, description, category, image_url, price_rwf) VALUES
  ('88888888-8888-8888-8888-888888888888','Kitenge wrap dress','Hand-sewn, made to size','Tailoring','images/products/kitenge-wrap-dress.jpg',18000),
  ('88888888-8888-8888-8888-888888888888','School uniform set','Durable cotton blend','Tailoring','images/products/school-uniform-set.jpg',12000),
  ('88888888-8888-8888-8888-888888888888','Beaded choker necklace','Layered glass beads','Beading','images/products/beaded-choker-necklace.jpg',6000),
  ('88888888-8888-8888-8888-888888888888','Beaded bracelet set','Set of three, adjustable','Beading','images/products/beaded-bracelet-set.jpg',4500),
  ('88888888-8888-8888-8888-888888888888','Woven storage basket','Sisal and banana fibre','Basket weaving','images/products/woven-storage-basket.jpg',9000),
  ('88888888-8888-8888-8888-888888888888','Table mat set','Set of four, hand-dyed','Basket weaving',NULL,7000);

