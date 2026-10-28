import TierPage, { tierMetadata } from '@/components/TierPage';

export const metadata = tierMetadata('ultra-black');

export default function Page() {
  return <TierPage id="ultra-black" />;
}
