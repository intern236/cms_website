'use client'

import { useState } from 'react'
import { Plus } from '@phosphor-icons/react'

/** Questions and answers. One open at a time; the plus turns into a cross. */
export function Faq({ items }: { items: { question: string; answer: string }[] }) {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <section className="mt-16">
      <h2 className="mb-6 font-display text-[clamp(2rem,3.2vw,2.75rem)] font-bold tracking-[-0.04em]">Questions, answered</h2>
      <ul className="border-t border-rule">
        {items.map((f, i) => {
          const active = open === i
          return (
            <li key={i} className="border-b border-rule">
              <button onClick={() => setOpen(active ? null : i)} aria-expanded={active} className="flex w-full items-center justify-between gap-6 py-6 text-left">
                <span className="font-display text-[21px] font-semibold leading-snug tracking-[-0.02em]">{f.question}</span>
                <span className={`grid size-10 shrink-0 place-items-center rounded-full border border-rule transition-all duration-500 ease-out-expo ${active ? 'rotate-45 border-ink bg-ink text-paper' : ''}`}>
                  <Plus size={16} weight="bold" />
                </span>
              </button>
              <div className={`grid transition-all duration-500 ease-out-expo ${active ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden">
                  <p className="pb-7 pr-14 font-read text-[18px] leading-relaxed text-ink-2">{f.answer}</p>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
