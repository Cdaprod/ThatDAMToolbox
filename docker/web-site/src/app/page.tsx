export default function Home() {
  const login = process.env.NEXT_PUBLIC_LOGIN_URL
  return (
    <main className='p-8 text-center'>
      <h1 className='text-4xl font-bold'>That DAM Toolbox</h1>
      <p className='mt-4'>Welcome to the platform</p>
      {login && (
        <a href={login} className='mt-6 inline-block px-4 py-2 bg-blue-600 text-white rounded'>
          Sign in
        </a>
      )}
    </main>
  )
}
