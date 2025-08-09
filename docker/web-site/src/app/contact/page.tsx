'use client'
import { useState } from 'react'

export default function Contact() {
  const [submitted, setSubmitted] = useState(false)
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const body = {
      name: (form.elements.namedItem('name') as HTMLInputElement).value,
      email: (form.elements.namedItem('email') as HTMLInputElement).value,
      message: (form.elements.namedItem('message') as HTMLTextAreaElement).value
    }
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (res.ok) setSubmitted(true)
  }
  return (
    <main className='p-8'>
      <h1 className='text-2xl font-bold'>Contact</h1>
      {submitted ? (
        <p className='mt-4'>Thanks for reaching out!</p>
      ) : (
        <form className='mt-4 flex flex-col gap-2 max-w-sm' onSubmit={handleSubmit}>
          <input name='name' required placeholder='Name' className='border p-2' />
          <input name='email' type='email' required placeholder='Email' className='border p-2' />
          <textarea name='message' required placeholder='Message' className='border p-2' />
          <button type='submit' className='bg-black text-white p-2'>Send</button>
        </form>
      )}
    </main>
  )
}
