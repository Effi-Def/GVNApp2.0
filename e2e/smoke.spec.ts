import { expect, test } from '@playwright/test'

type E2EOptions = {
  scenario: 'new-user' | 'invite' | 'seeded'
  auth: 'signed-in' | 'signed-out'
  postLoginRedirect?: string
}

async function primeRuntime(page: Parameters<typeof test>[0]['page'], options: E2EOptions) {
  await page.addInitScript((args) => {
    localStorage.clear()
    sessionStorage.clear()
    localStorage.setItem('gvn:e2e:enabled', '1')
    localStorage.setItem('gvn:e2e:scenario', args.scenario)
    localStorage.setItem('gvn:e2e:auth', args.auth)
    localStorage.setItem('gvn.tutorial.v1', '1')
    localStorage.setItem('gvn-theme-setup-seen', '1')
    localStorage.setItem('whats_new_seen:2025-10-22', '1')
    localStorage.setItem('gvn-notif-denied-banner-seen:user-smoke', '1')
    if (args.postLoginRedirect) {
      sessionStorage.setItem('postLoginRedirect', args.postLoginRedirect)
    }
  }, options)
}

test('login -> onboarding/join farm -> home', async ({ page }) => {
  await primeRuntime(page, {
    scenario: 'invite',
    auth: 'signed-out',
    postLoginRedirect: '/farms/join/pig-invite',
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'Continua con Google' }).click()

  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('main').getByText('Smoke Farm')).toBeVisible()
  await expect(page.getByRole('main').getByText('Niente in programma')).toBeVisible()
})

test('crea evento -> RSVP -> chat invio messaggio', async ({ page }) => {
  await primeRuntime(page, { scenario: 'seeded', auth: 'signed-in' })

  await page.goto('/events?create=1')
  await expect(page.getByText('Nuovo Evento')).toBeVisible()
  await page.getByLabel('Titolo').fill('Braciata smoke')
  await page.getByLabel('Data').fill('2030-06-18')
  await page.locator('form').getByRole('button', { name: 'Crea', exact: true }).click()

  await expect(page.getByText('Braciata smoke')).toBeVisible()

  await page.goto('/events/event-seeded/summary')
  await page.getByRole('button', { name: /Sì/ }).click()
  const openChatButton = page.getByRole('main').getByRole('button', { name: 'Apri chat', exact: true })
  await expect(openChatButton).toBeEnabled()
  await openChatButton.click()

  await page.getByPlaceholder('Scrivi un messaggio...').fill('Messaggio smoke e2e')
  await page.getByPlaceholder('Scrivi un messaggio...').press('Enter')

  await expect(page.getByPlaceholder('Scrivi un messaggio...')).toHaveValue('')
  await expect(page.getByRole('main').getByText('Messaggio smoke e2e', { exact: true })).toBeVisible()
})

test('crea spesa collegata evento -> visualizza saldo', async ({ page }) => {
  await primeRuntime(page, { scenario: 'seeded', auth: 'signed-in' })

  await page.goto('/events/event-seeded/summary')
  await page.getByRole('button', { name: 'Aggiungi spesa' }).click()

  await expect(page.getByText('Nuova Spesa')).toBeVisible()
  await page.getByLabel('Titolo *').fill('Spesa smoke')
  await page.getByLabel('Importo totale *').fill('42')
  await page.getByRole('button', { name: /Crea Spesa/ }).click()

  await expect(page.getByText('Spesa smoke')).toBeVisible()
  await page.getByRole('button', { name: /Saldi evento/ }).click()
  await expect(page.getByText('+21.00€')).toBeVisible()
})