// Demó statikus export: a dinamikus szegmens prerender-paraméterei a seed-idkből.
// (A kliens page.tsx-et nem érinti; normál buildnél üres → nincs prerender.)
import { paramsFor } from '@/lib/demo/static-params';

export function generateStaticParams() {
  return paramsFor('projects', 'projectId');
}

export default function DemoParamsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
