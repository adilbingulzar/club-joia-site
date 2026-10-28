import TierPage, { tierMetadata } from '@/components/TierPage';

export const metadata = tierMetadata('ruby-red');

export default function Page() {
  return <TierPage id="ruby-red" />;
}
