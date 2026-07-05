import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function LocaleRoot({ params }: Props) {
  const { locale } = await Promise.resolve(params);
  redirect(`/${locale}/dashboard`);
}
