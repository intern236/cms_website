'use client'

import { HoneypotField, useContactForm } from '@cms/site-kit/ui'
import { ArrowUpRight, CheckCircle } from '@phosphor-icons/react'

const field =
  'peer w-full border-0 border-b-2 border-rule bg-transparent px-0 pb-3 pt-7 text-[19px] text-ink outline-none transition-colors placeholder:text-transparent focus:border-ink aria-[invalid=true]:border-red-600'
const label =
  'pointer-events-none absolute left-0 top-7 origin-left text-[19px] text-mute transition-all duration-300 ease-out-expo peer-focus:top-0 peer-focus:scale-75 peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:scale-75'

/** Floating-label form that posts through the site kit to the client's CMS inbox. */
export function ContactForm({ topics }: { topics: string[] }) {
  const { onSubmit, status, errors, failure, reset } = useContactForm()
  if (status === 'sent') {
    return (
      <div role="status" className="rounded-[32px] bg-ink p-10 text-paper">
        <CheckCircle size={48} weight="fill" className="text-accent" />
        <p className="mt-6 font-display text-[clamp(2rem,4vw,3.5rem)] font-bold leading-none tracking-[-0.045em]">Message sent.</p>
        <p className="mt-4 text-[18px] text-paper/70">Thank you — we reply within one working day.</p>
        <button onClick={reset} className="mt-8 text-[15px] font-semibold underline decoration-accent decoration-2 underline-offset-4">
          Send another
        </button>
      </div>
    )
  }
  const err = (k: string) => (errors[k] ? <span className="mt-2 block text-[14px] font-medium text-red-600">{errors[k]}</span> : null)
  return (
    <form onSubmit={onSubmit} className="relative flex flex-col gap-8" noValidate>
      <div className="grid gap-8 sm:grid-cols-2">
        <label className="relative block">
          <input id="name" name="name" placeholder="Name" required autoComplete="name" aria-invalid={Boolean(errors.name)} className={field} />
          <span className={label}>Your name</span>
          {err('name')}
        </label>
        <label className="relative block">
          <input id="email" name="email" type="email" placeholder="Email" required autoComplete="email" aria-invalid={Boolean(errors.email)} className={field} />
          <span className={label}>Email</span>
          {err('email')}
        </label>
        <label className="relative block">
          <input id="company" name="company" placeholder="Company" autoComplete="organization" className={field} />
          <span className={label}>Company (optional)</span>
          {err('company')}
        </label>
        <label className="relative block">
          <input id="phone" name="phone" type="tel" placeholder="Phone" autoComplete="tel" className={field} />
          <span className={label}>Phone (optional)</span>
          {err('phone')}
        </label>
      </div>
      {topics.length > 0 && (
        <fieldset>
          <legend className="mb-3 text-[15px] text-mute">What is it about?</legend>
          <div className="flex flex-wrap gap-2">
            {topics.map((t, i) => (
              <label key={t} className="cursor-pointer">
                <input type="radio" name="topic" value={t} defaultChecked={i === 0} className="peer sr-only" />
                <span className="inline-block rounded-full border border-rule px-4 py-2 text-[15px] font-medium transition peer-checked:border-ink peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent">
                  {t}
                </span>
              </label>
            ))}
          </div>
          {err('topic')}
        </fieldset>
      )}
      <label className="relative block">
        <textarea id="message" name="message" rows={4} placeholder="Message" required aria-invalid={Boolean(errors.message)} className={`${field} resize-none`} />
        <span className={label}>Tell us about the project</span>
        {err('message')}
      </label>
      <HoneypotField />
      {failure && <p role="alert" className="text-[15px] font-medium text-red-600">{failure}</p>}
      <button
        type="submit"
        disabled={status === 'sending'}
        className="group inline-flex items-center gap-3 self-start rounded-full bg-ink py-4 pl-8 pr-4 text-[18px] font-semibold text-paper transition hover:scale-[1.02] disabled:opacity-60"
      >
        {status === 'sending' ? 'Sending…' : 'Send message'}
        <span className="grid size-10 place-items-center rounded-full bg-accent text-accent-ink transition-transform duration-500 group-hover:rotate-45">
          <ArrowUpRight size={18} weight="bold" />
        </span>
      </button>
    </form>
  )
}
