-- A payment link's fixed discount off the tickets (admin > Payment links > Discount).
-- amount stays what the buyer pays: the tickets' total minus the discount. NULL = no discount.
-- Run once on the website's database (phpMyAdmin > SQL, or: mysql DB_NAME < this file).
-- "Duplicate column name" means it already ran (npm run db:setup / the site's start adds the same column).

ALTER TABLE shop_orders
  ADD COLUMN discount DECIMAL(12,2) NULL AFTER link_expires_at;

-- Check:
-- SHOW COLUMNS FROM shop_orders WHERE Field = 'discount';
