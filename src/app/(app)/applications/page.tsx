import { redirect } from 'next/navigation'

export default function ApplicationsPage() {
  redirect('/opportunities?tab=applications')
}
