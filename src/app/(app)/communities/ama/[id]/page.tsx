import { redirect } from 'next/navigation'
export default async function LegacyAmaPage() { redirect('/communities?tab=events') }
