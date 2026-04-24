import Link from 'next/link'
import { signup } from '../lib/auth/actions'

export default function SignupPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  return (
    <main style={{ maxWidth: 400, margin: '80px auto', padding: '0 16px' }}>
      <h1>Guardian Dispatch</h1>
      <h2>Create Account</h2>

      {searchParams.error && (
        <p style={{ color: 'red', marginBottom: 16 }}>
          {searchParams.error}
        </p>
      )}

      <form action={signup}>
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="email">Email</label>
          <br />
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            style={{
  width: '100%',
  padding: 8,
  marginTop: 4,
  border: '1px solid black',
  borderRadius: 4,
}}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label htmlFor="password">Password</label>
          <br />
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            style={{
  width: '100%',
  padding: 8,
  marginTop: 4,
  border: '1px solid black',
  borderRadius: 4,
}}
          />
        </div>

        <button type="submit" style={{ width: '100%', padding: 10 }}>
          Create Account
        </button>
      </form>

      <p style={{ marginTop: 16 }}>
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </main>
  )
}