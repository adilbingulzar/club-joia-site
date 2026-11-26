import { EmptyState } from '@/member/components/joia/states';

// A member page that doesn't exist (an event, a ticket, ...)
export default function NotFound() {
  return <EmptyState title="Not found" description="This page doesn’t exist or is no longer available." action={{ href: '/account', label: 'Back to home' }} />;
}
