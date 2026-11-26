import TierPage, { tierMetadata } from '@/components/TierPage';

export const metadata = tierMetadata('pearly-white');

export default function Page() {
  return <TierPage id="pearly-white" />;
}
