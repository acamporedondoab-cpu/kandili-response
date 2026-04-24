import { redirect } from 'next/navigation'
import { getCurrentUserWithProfile } from '../lib/supabase/profile'
import Sidebar from './components/Sidebar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const current = await getCurrentUserWithProfile()

  if (!current || current.profile?.role !== 'super_admin') {
    redirect('/dashboard')
  }

  return (
    <div className="flex min-h-screen bg-[#070B18]">
      <Sidebar adminName={current.profile?.full_name ?? 'Admin'} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
