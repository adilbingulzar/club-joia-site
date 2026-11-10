import LoginForm from '@/components/admin/LoginForm';

type Props = { searchParams: Promise<{ expired?: string }> };

export default async function AdminLoginPage({ searchParams }: Props) {
  const expired = (await searchParams).expired;
  return (
    <main className="adm-login">
      <LoginForm notice={expired ? 'You were signed out. Please sign in again.' : undefined} />
    </main>
  );
}
