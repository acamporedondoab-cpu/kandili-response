import LoginCard from './LoginCard'

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  return (
    <main className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#070B18]">
      {/* Background video */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover z-0"
      >
        <source src="/video/herovid.mp4" type="video/mp4" />
      </video>

      {/* Dark overlay */}
      <div
        className="absolute inset-0 z-10"
        style={{ background: 'linear-gradient(180deg, rgba(7,11,24,0.55) 0%, rgba(7,11,24,0.65) 100%)' }}
      />

      <LoginCard error={searchParams.error} />
    </main>
  )
}
