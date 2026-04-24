import { notFound } from 'next/navigation'
import { createAdminClient } from '../../../lib/supabase/admin'
import OrgDetailClient from '../../components/OrgDetailClient'
import type { Organization } from '../../../lib/types/organization'
import type { Profile } from '../../../lib/types/profile'

export default async function OrgDetailPage({ params }: { params: { id: string } }) {
  const admin = createAdminClient()

  const [{ data: org }, { data: members }] = await Promise.all([
    admin.from('organizations').select('*').eq('id', params.id).single(),
    admin
      .from('profiles')
      .select('id, full_name, phone_number, role, tl_priority, is_on_duty, avatar_url, organization_id, deleted_at')
      .eq('organization_id', params.id)
      .neq('role', 'citizen')
      .is('deleted_at', null),
  ])

  if (!org) notFound()

  const tls = (members as Profile[])?.filter((m) => m.role === 'team_leader') ?? []
  const responders = (members as Profile[])?.filter((m) => m.role === 'responder') ?? []

  return (
    <OrgDetailClient
      org={org as Organization}
      tls={tls}
      responders={responders}
    />
  )
}
