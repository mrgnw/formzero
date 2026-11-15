import { useState } from "react"
import { useParams } from "react-router"
import type { Route } from "./+types/forms.$formId.integration"
import { Copy, Check, HelpCircle } from "lucide-react"
import { Highlight, themes } from "prism-react-renderer"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip"

export const meta: Route.MetaFunction = () => {
  return [
    { title: "Integration | FormZero" },
    { name: "description", content: "Integrate your form with HTML, JavaScript, React, or Svelte" },
  ];
};

export default function IntegrationPage() {
  const params = useParams()
  const formId = params.formId
  const [copiedEndpoint, setCopiedEndpoint] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [redirectUrl, setRedirectUrl] = useState("")

  // Use browser location to construct endpoint
  const formEndpoint = typeof window !== "undefined"
    ? `${window.location.origin}/api/forms/${formId}/submissions`
    : `/api/forms/${formId}/submissions`

  const htmlAction = redirectUrl.trim()
    ? `${formEndpoint}?redirect=${encodeURIComponent(redirectUrl.trim())}`
    : formEndpoint

  const handleCopyEndpoint = async () => {
    await navigator.clipboard.writeText(formEndpoint)
    setCopiedEndpoint(true)
    setTimeout(() => setCopiedEndpoint(false), 2000)
  }

  const handleCopyCode = async (code: string) => {
    await navigator.clipboard.writeText(code)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  const htmlExample = `<form action="${htmlAction}" method="POST">
  <input type="text" name="name" placeholder="Your Name" required />
  <input type="email" name="email" placeholder="Your Email" required />
  <textarea name="message" placeholder="Your Message"></textarea>
  <button type="submit">Submit</button>
</form>`

  const jsExample = `fetch('${formEndpoint}', {
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
  .catch(error => console.error('Error:', error))`

  const reactExample = `import { useState } from 'react'

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
}`

  const svelteFetchExample = `<script lang="ts">
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
</form>`

  const svelteRemoteExample = `// contact.remote.ts
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
)`

  const svelteRemoteComponentExample = `<script lang="ts">
  import { contact } from './contact.remote'
</script>

<form {...contact}>
  <input {...contact.fields.name.as('text')} placeholder="Your Name" required />
  <input {...contact.fields.email.as('email')} placeholder="Your Email" required />
  <textarea {...contact.fields.message.as('text')} placeholder="Your Message"></textarea>
  <button disabled={!!contact.pending}>Submit</button>
  {#if contact.result?.success}<p>Message sent successfully!</p>{/if}
</form>`

  const renderCodeBlock = (code: string, language: string) => (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleCopyCode(code)}
        className="absolute top-2 right-2 z-10 h-7 px-2 text-xs"
      >
        {copiedCode ? (
          <Check className="h-3 w-3" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
      </Button>
      <Highlight
        theme={themes.vsDark}
        code={code}
        language={language}
      >
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <pre
            className={className}
            style={{
              ...style,
              margin: 0,
              borderRadius: "0.375rem",
              fontSize: "0.75rem",
              padding: "0.75rem",
              overflowX: "auto",
            }}
          >
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })}>
                {line.map((token, key) => (
                  <span key={key} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  )

  return (
    <div className="flex flex-1 flex-col gap-3">
      <Card>
        <CardHeader>
          <CardTitle>Endpoint</CardTitle>
          <CardDescription>
            Use this as your HTML form <code className="rounded bg-muted px-1 py-0.5 text-xs">action</code> URL or just send JSON to it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <code className="flex-1 rounded-md bg-muted px-3 py-2 text-xs font-mono break-all">
              {formEndpoint}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyEndpoint}
              className="shrink-0 w-full sm:w-auto sm:px-3"
            >
              {copiedEndpoint ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span className="sm:hidden ml-2">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span className="sm:hidden ml-2">Copy Endpoint</span>
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Integration Examples</CardTitle>
          <CardDescription>
            Choose your preferred method to submit data to your form.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="html" className="w-full">
            <TabsList>
              <TabsTrigger value="html">HTML</TabsTrigger>
              <TabsTrigger value="javascript">JavaScript</TabsTrigger>
              <TabsTrigger value="react">React</TabsTrigger>
              <TabsTrigger value="svelte">Svelte</TabsTrigger>
            </TabsList>

            <TabsContent value="html" className="mt-3 space-y-3">
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="redirect-url">Redirect URL (optional)</Label>
                  <TooltipProvider delayDuration={150}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label="How this works"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <HelpCircle className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>
                          We append <code>?redirect=</code> to the form&apos;s action URL in the snippet below. It&apos;s a copy-and-paste helper - nothing is saved on your form.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Input
                  id="redirect-url"
                  type="url"
                  value={redirectUrl}
                  onChange={(e) => setRedirectUrl(e.target.value)}
                  placeholder="https://yoursite.com/thanks.html"
                />
                <p className="text-xs text-muted-foreground">
                  After submission, users are redirected here. Leave empty to send them back to the page they came from.
                </p>
              </div>
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyCode(htmlExample)}
                  className="absolute top-2 right-2 z-10 h-7 px-2 text-xs"
                >
                  {copiedCode ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
                <Highlight
                  theme={themes.vsDark}
                  code={htmlExample}
                  language="markup"
                >
                  {({ className, style, tokens, getLineProps, getTokenProps }) => (
                    <pre
                      className={className}
                      style={{
                        ...style,
                        margin: 0,
                        borderRadius: "0.375rem",
                        fontSize: "0.75rem",
                        padding: "0.75rem",
                        overflowX: "auto",
                      }}
                    >
                      {tokens.map((line, i) => (
                        <div key={i} {...getLineProps({ line })}>
                          {line.map((token, key) => (
                            <span key={key} {...getTokenProps({ token })} />
                          ))}
                        </div>
                      ))}
                    </pre>
                  )}
                </Highlight>
              </div>
            </TabsContent>

            <TabsContent value="javascript" className="mt-3">
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyCode(jsExample)}
                  className="absolute top-2 right-2 z-10 h-7 px-2 text-xs"
                >
                  {copiedCode ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
                <Highlight
                  theme={themes.vsDark}
                  code={jsExample}
                  language="javascript"
                >
                  {({ className, style, tokens, getLineProps, getTokenProps }) => (
                    <pre
                      className={className}
                      style={{
                        ...style,
                        margin: 0,
                        borderRadius: "0.375rem",
                        fontSize: "0.75rem",
                        padding: "0.75rem",
                        overflowX: "auto",
                      }}
                    >
                      {tokens.map((line, i) => (
                        <div key={i} {...getLineProps({ line })}>
                          {line.map((token, key) => (
                            <span key={key} {...getTokenProps({ token })} />
                          ))}
                        </div>
                      ))}
                    </pre>
                  )}
                </Highlight>
              </div>
            </TabsContent>

            <TabsContent value="react" className="mt-3">
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyCode(reactExample)}
                  className="absolute top-2 right-2 z-10 h-7 px-2 text-xs"
                >
                  {copiedCode ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
                <Highlight
                  theme={themes.vsDark}
                  code={reactExample}
                  language="jsx"
                >
                  {({ className, style, tokens, getLineProps, getTokenProps }) => (
                    <pre
                      className={className}
                      style={{
                        ...style,
                        margin: 0,
                        borderRadius: "0.375rem",
                        fontSize: "0.75rem",
                        padding: "0.75rem",
                        overflowX: "auto",
                      }}
                    >
                      {tokens.map((line, i) => (
                        <div key={i} {...getLineProps({ line })}>
                          {line.map((token, key) => (
                            <span key={key} {...getTokenProps({ token })} />
                          ))}
                        </div>
                      ))}
                    </pre>
                  )}
                </Highlight>
              </div>
            </TabsContent>
            <TabsContent value="svelte" className="mt-3 space-y-4">
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Plain form</h3>
                <p className="text-xs text-muted-foreground">
                  The HTML form is a valid <code className="rounded bg-muted px-1 py-0.5 text-xs">.svelte</code> file as is. It does a full-page POST and uses the redirect URL from the HTML tab.
                </p>
                {renderCodeBlock(htmlExample, "markup")}
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Svelte 5 with fetch</h3>
                <p className="text-xs text-muted-foreground">
                  Submits JSON without leaving the page and tracks status with <code className="rounded bg-muted px-1 py-0.5 text-xs">$state</code>.
                </p>
                {renderCodeBlock(svelteFetchExample, "markup")}
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-medium">SvelteKit remote function (experimental)</h3>
                <p className="text-xs text-muted-foreground">
                  The server forwards the submission, so the browser never makes a cross-origin request. Needs <code className="rounded bg-muted px-1 py-0.5 text-xs">kit.experimental.remoteFunctions</code> and <code className="rounded bg-muted px-1 py-0.5 text-xs">compilerOptions.experimental.async</code> in <code className="rounded bg-muted px-1 py-0.5 text-xs">svelte.config.js</code>, plus <code className="rounded bg-muted px-1 py-0.5 text-xs">valibot</code>.
                </p>
                {renderCodeBlock(svelteRemoteExample, "typescript")}
                {renderCodeBlock(svelteRemoteComponentExample, "markup")}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
