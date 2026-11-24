-- Payment links made by staff in the members app (admin > Payment links).
-- Run once on the website's database (phpMyAdmin > SQL, or: mysql DB_NAME < this file).
-- "Duplicate column name" means it already ran (npm run db:setup / the site's start adds the same columns).

ALTER TABLE shop_orders
  ADD COLUMN created_by VARCHAR(191) NULL,                         -- members app staff account (users.id) that made the link
  ADD COLUMN staff_cancelled_at DATETIME(3) NULL AFTER created_by, -- the link cancelled by staff
  ADD COLUMN link_expires_at DATETIME(3) NULL AFTER staff_cancelled_at, -- the link can be paid until then (1 to 5 days)
  ADD KEY orders_created_by (created_by, created_at);

-- Check:
-- SHOW COLUMNS FROM shop_orders WHERE Field IN ('created_by', 'staff_cancelled_at', 'link_expires_at');
