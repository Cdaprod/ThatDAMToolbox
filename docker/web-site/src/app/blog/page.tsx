import Link from 'next/link'

const posts = [{ slug: 'hello', title: 'Hello' }]

export default function Blog() {
  return (
    <main className='p-8'>
      <h1 className='text-2xl font-bold'>Blog</h1>
      <ul className='mt-4 list-disc list-inside'>
        {posts.map(p => (
          <li key={p.slug}>
            <Link href={`/blog/${p.slug}`}>{p.title}</Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
