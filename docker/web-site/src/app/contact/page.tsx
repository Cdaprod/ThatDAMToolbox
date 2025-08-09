'use client'
import { useState } from 'react'

export default function Contact() {
  const [submitted, setSubmitted] = useState(false)
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitted(true)
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
