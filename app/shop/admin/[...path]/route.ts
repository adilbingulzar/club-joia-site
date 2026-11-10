// The sales dashboard's API (/shop/admin/login, stats, orders, orders/<ref>): lib/shop/admin.ts.
import { adminApi } from '@/lib/shop/admin';
import { guarded, json } from '@/lib/shop/http';

async function handle(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const path = (await ctx.params).path.join('/');
  return guarded('admin ' + path, async function () {
    const a = await adminApi(request, path);
    return json(a.body, a.status);
  }, function () {
    return json({ error: 'Something went wrong' }, 500);
  });
}

export const GET = handle;
export const POST = handle;
