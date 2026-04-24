import { createAdminClient } from '../../lib/supabase/admin'
import OrgGrid from '../components/OrgGrid'
import type { Organization } from '../../lib/types/organization'
import type { Profile } from '../../lib/types/profile'

export default async function OrganizationsPage() {
  const admin = createAdminClient()

  const [{ data: orgs }, { data: members }] = await Promise.all([
    admin
      .from('organizations')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    admin
      .from('profiles')
      .select('id, full_name, role, organization_id, tl_priority, avatar_url, phone_number')
      .neq('role', 'citizen')
      .is('deleted_at', null),
  ])

  return (
    <div style={{ padding: '36px 40px' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'white', marginBottom: 4 }}>
          Organizations
        </h1>
        <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.40)' }}>
          Manage organizations, assign team leaders and responders
        </p>
      </div>

      <OrgGrid
        orgs={(orgs as Organization[]) ?? []}
        members={(members as Profile[]) ?? []}
      />
    </div>
  )
}
