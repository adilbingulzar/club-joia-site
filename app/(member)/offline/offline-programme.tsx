"use client";

import { useEffect, useState } from "react";

type Item = { id: string; date: string; startTime: string; title: string; location: string | null };
type Programme = { event: { name: string }; items: Item[] };

// by day (Map.groupBy needs newer browsers)
function groupByDate(items: Item[]) {
  const m = new Map<string, Item[]>();
  for (const i of items) m.set(i.date, [...(m.get(i.date) ?? []), i]);
  return m;
}

/** Reads every public programme the service worker has cached on this device. */
async function readCachedProgrammes(): Promise<Programme[]> {
  if (!("caches" in window)) return [];
  const names = (await caches.keys()).filter((n) => n.endsWith("-data"));
  const out: Programme[] = [];
  for (const name of names) {
    const cache = await caches.open(name);
    for (const req of await cache.keys()) {
      if (!/^\/account\/programme\/[^/]+$/.test(new URL(req.url).pathname)) continue;
      const res = await cache.match(req);
      if (res) out.push(await res.json());
    }
  }
  return out;
}

export function OfflineProgramme() {
  const [data, setData] = useState<Programme[] | null>(null);
  useEffect(() => {
    readCachedProgrammes().then(setData).catch(() => setData([]));
  }, []);
  if (data === null) return <div className="skeleton mt-8 h-40" aria-hidden />;
  if (data.length === 0) return <p className="mt-8 text-sm text-pearl-dim">No programme has been saved on this device yet.</p>;
  return (
    <div className="mt-8 space-y-10">
      {data.map((programme) => (
        <div key={programme.event.name} className="space-y-6">
          <p className="eyebrow">{programme.event.name}</p>
          {[...groupByDate(programme.items).entries()].map(([date, items]) => (
            <section key={date}>
              <h2 className="font-display text-2xl">
                {new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`))}
              </h2>
              <ul className="mt-2 divide-y divide-line">
                {items.map((i) => (
                  <li key={i.id} className="flex gap-4 py-2 text-sm">
                    <span className="w-12 font-display text-pearl">{i.startTime}</span>
                    <span className="text-pearl-muted">
                      {i.title}
                      {i.location && <span className="text-pearl-dim"> · {i.location}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ))}
    </div>
  );
}
