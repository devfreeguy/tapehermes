import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { createLocale, message } from '../locale.js'
import { createTrace } from '../trace.js'

it('switches an existing playground trace without changing raw data, and remembers the choice', async () => {
  const html = readFileSync(join(process.cwd(), 'playground.html'), 'utf8')
  function loadPage() {
    document.open()
    document.write(html)
    document.close()
    return createLocale(document, window)
  }
  localStorage.clear()
  const { copy } = loadPage()
  const trace = createTrace({
    doc: document, copy, local: true,
    fetchImpl: async () => Response.json({ result: 'Payment' }),
  })
  trace.begin(message('Running {0}', 'asteroid'))
  await trace.fetch('/tapeapi/v1/asteroid')
  const detail = [...document.querySelectorAll('#activity details')].at(-1)
  detail.open = true
  const field = document.getElementById('food-input')
  field.value = 'an edited value'
  expect(document.documentElement.lang).toBe('zh-CN')
  expect(detail.querySelector('summary').textContent).toBe('响应 JSON')
  document.querySelector('[data-language="en"]').click()
  expect(document.documentElement.lang).toBe('en')
  expect(document.title).toBe('API Playground | TapeHermes')
  expect(detail.querySelector('summary').textContent).toBe('Response JSON')
  expect(detail.querySelector('pre').textContent).toContain('"Payment"')
  expect(detail.open).toBe(true)
  expect(field.value).toBe('an edited value')
  loadPage()
  expect(document.documentElement.lang).toBe('en')
  document.querySelector('[data-language="zh-CN"]').click()
  expect(document.querySelector('h1').textContent).toBe('API 试用台')
  localStorage.clear()
})

