export const UNDER_21 = 'You must be older than 21 to buy tickets.';

// True from the buyer's 21st birthday. `dob` is yyyy-mm-dd.
export function isOver21(dob: string, now = new Date()): boolean {
  const limit = new Date(now);
  limit.setUTCFullYear(limit.getUTCFullYear() - 21);
  return dob <= limit.toISOString().slice(0, 10);
}
