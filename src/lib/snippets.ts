export function snippets(formEndpoint: string, redirectUrl: string) {
	const redirect = redirectUrl.trim();
	const htmlAction = redirect ? `${formEndpoint}?redirect=${encodeURIComponent(redirect)}` : formEndpoint;
	return {
		html: `<form action="${htmlAction}" method="POST">
  <input type="text" name="name" placeholder="Your Name" required />
  <input type="email" name="email" placeholder="Your Email" required />
  <textarea name="message" placeholder="Your Message"></textarea>
  <button type="submit">Submit</button>
</form>`,
		js: `fetch('${formEndpoint}', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'John Doe',
    email: 'john@example.com',
    message: 'Hello!'
  })
})
  .then(response => response.json())
  .then(data => console.log('Success:', data))
  .catch(error => console.error('Error:', error))`,
		react: `import { useState } from 'react'

function ContactForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  })
  const [status, setStatus] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus('sending')

    try {
      const response = await fetch('${formEndpoint}', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        setStatus('success')
        setFormData({ name: '', email: '', message: '' })
      } else {
        setStatus('error')
      }
    } catch (error) {
      setStatus('error')
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Your Name"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        required
      />
      <input
        type="email"
        placeholder="Your Email"
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        required
      />
      <textarea
        placeholder="Your Message"
        value={formData.message}
        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
      />
      <button type="submit" disabled={status === 'sending'}>
        {status === 'sending' ? 'Sending...' : 'Submit'}
      </button>
      {status === 'success' && <p>Message sent successfully!</p>}
      {status === 'error' && <p>Error sending message. Please try again.</p>}
    </form>
  )
}`,
		svelteFetch: `<script lang="ts">
  let status = $state<'idle' | 'sending' | 'sent' | 'error'>('idle')

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault()
    const form = event.currentTarget as HTMLFormElement
    status = 'sending'

    try {
      const response = await fetch('${formEndpoint}', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form)))
      })
      status = response.ok ? 'sent' : 'error'
      if (response.ok) form.reset()
    } catch {
      status = 'error'
    }
  }
</script>

<form onsubmit={handleSubmit}>
  <input type="text" name="name" placeholder="Your Name" required />
  <input type="email" name="email" placeholder="Your Email" required />
  <textarea name="message" placeholder="Your Message"></textarea>
  <button type="submit" disabled={status === 'sending'}>
    {status === 'sending' ? 'Sending...' : 'Submit'}
  </button>
  {#if status === 'sent'}<p>Message sent successfully!</p>{/if}
  {#if status === 'error'}<p>Error sending message. Please try again.</p>{/if}
</form>`,
		svelteRemote: `// contact.remote.ts
import { form } from '$app/server'
import { error } from '@sveltejs/kit'
import * as v from 'valibot'

export const contact = form(
  v.object({
    name: v.pipe(v.string(), v.nonEmpty()),
    email: v.pipe(v.string(), v.email()),
    message: v.optional(v.string(), '')
  }),
  async (data) => {
    const response = await fetch('${formEndpoint}', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) error(502, 'Could not send message')
    return { success: true }
  }
)`,
		svelteRemoteComponent: `<script lang="ts">
  import { contact } from './contact.remote'
</script>

<form {...contact}>
  <input {...contact.fields.name.as('text')} placeholder="Your Name" required />
  <input {...contact.fields.email.as('email')} placeholder="Your Email" required />
  <textarea {...contact.fields.message.as('text')} placeholder="Your Message"></textarea>
  <button disabled={!!contact.pending}>Submit</button>
  {#if contact.result?.success}<p>Message sent successfully!</p>{/if}
</form>`
	};
}
