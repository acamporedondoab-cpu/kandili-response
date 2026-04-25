'use client'

interface Props {
  activeCount: number
  onDutyCount: number
  tlsOnDutyCount: number
  resolvedToday: number
  avgResponseMins: number | null
}

interface StatCardProps {
  label: string
  value: string | number
  sub: string
  numberColor: string
  bg: string
  border: string
}

function StatCard({ label, value, sub, numberColor, bg, border }: StatCardProps) {
  return (
    <div
      className={`${bg} ${border} rounded-2xl p-6 flex flex-col gap-2 border transition-transform duration-150 hover:-translate-y-0.5 hover:brightness-110`}
    >
      <span className="text-[11px] font-semibold uppercase tracking-[0.10em] text-white/35">{label}</span>
      <span className={`text-4xl font-semibold leading-none ${numberColor}`}>{value}</span>
      <span className="text-[11px] text-white/30 mt-0.5">{sub}</span>
    </div>
  )
}

export default function StatsRow({ activeCount, onDutyCount, tlsOnDutyCount, resolvedToday, avgResponseMins }: Props) {
  const avgLabel =
    avgResponseMins === null
      ? '—'
      : avgResponseMins < 60
      ? `${avgResponseMins}m`
      : `${Math.floor(avgResponseMins / 60)}h ${avgResponseMins % 60}m`

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      <StatCard
        label="Active Incidents"
        value={activeCount}
        sub="Pending or in progress"
        numberColor="text-red-400"
        bg="bg-red-500/5"
        border="border-red-500/20"
      />
      <StatCard
        label="Responders On Duty"
        value={onDutyCount}
        sub="Currently available"
        numberColor="text-emerald-400"
        bg="bg-emerald-500/5"
        border="border-emerald-500/20"
      />
      <StatCard
        label="Team Leaders On Duty"
        value={tlsOnDutyCount}
        sub="Active during incidents"
        numberColor="text-sky-400"
        bg="bg-sky-500/5"
        border="border-sky-500/20"
      />
      <StatCard
        label="Resolved Today"
        value={resolvedToday}
        sub="Since midnight"
        numberColor="text-violet-400"
        bg="bg-violet-500/5"
        border="border-violet-500/20"
      />
      <StatCard
        label="Avg Response Time"
        value={avgLabel}
        sub="Report → on scene"
        numberColor="text-amber-400"
        bg="bg-amber-500/5"
        border="border-amber-500/20"
      />
    </div>
  )
}
