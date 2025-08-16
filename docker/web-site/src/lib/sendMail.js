/**
 * sendMail - send contact form submissions via SendGrid API.
 *
 * Usage:
 *   const { sendMail } = require('./sendMail')
 *   sendMail({ name: 'Alice', email: 'a@example.com', message: 'Hi' })
 *     .then(() => console.log('sent'))
 *     .catch(console.error)
 *
 * Environment variables:
 *   SENDGRID_API_KEY - API key for SendGrid
 *   SENDGRID_TO_EMAIL - destination email address
 */
async function sendMail({ name, email, message }) {
  const apiKey = process.env.SENDGRID_API_KEY
  const to = process.env.SENDGRID_TO_EMAIL
  if (!apiKey || !to) {
    console.warn('SendGrid configuration missing')
    return false
  }
  const body = {
    personalizations: [{ to: [{ email: to }] }],
    from: { email },
    subject: 'Contact form submission',
    content: [
      {
        type: 'text/plain',
        value: `Name: ${name}\nEmail: ${email}\n\n${message}`
      }
    ]
  }
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`SendGrid error: ${res.status} ${text}`)
  }
  return true
}

module.exports = { sendMail }
