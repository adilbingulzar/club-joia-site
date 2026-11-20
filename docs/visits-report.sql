-- Website visits report (table shop_visits, lib/visits.ts).
-- day is the UAE date. A "visitor" is one person (browser and connection) on one day.
-- Change the dates in the WHERE lines; each query's result can be copied or exported (CSV) into the sheet.

-- 1. Per day: visitors and page views
SELECT day, COUNT(DISTINCT visitor) AS visitors, COUNT(*) AS page_views
FROM shop_visits
WHERE day BETWEEN '2026-11-20' AND '2026-12-31'
GROUP BY day
ORDER BY day;

-- 2. Per day: visitors by source (where each visitor's first page of the day came from)
SELECT v.day, v.source, COUNT(*) AS visitors
FROM shop_visits v
JOIN (SELECT MIN(id) AS id FROM shop_visits GROUP BY day, visitor) f ON f.id = v.id
WHERE v.day BETWEEN '2026-11-20' AND '2026-12-31'
GROUP BY v.day, v.source
ORDER BY v.day, visitors DESC;

-- 3. Per day: each page, how many views and by how many visitors
SELECT day, path AS page, COUNT(*) AS views, COUNT(DISTINCT visitor) AS visitors
FROM shop_visits
WHERE day BETWEEN '2026-11-20' AND '2026-12-31'
GROUP BY day, path
ORDER BY day, views DESC;

-- 4. One day, per visitor: which page, how many times (visitor is an anonymous code)
SELECT v.visitor, f.source, v.path AS page, COUNT(*) AS views, MIN(v.created_at) AS first_view_utc
FROM shop_visits v
JOIN (SELECT s.visitor, s.source FROM shop_visits s
      JOIN (SELECT MIN(id) AS id FROM shop_visits WHERE day = '2026-11-20' GROUP BY visitor) m ON m.id = s.id) f
  ON f.visitor = v.visitor
WHERE v.day = '2026-11-20'
GROUP BY v.visitor, f.source, v.path
ORDER BY v.visitor, views DESC;
