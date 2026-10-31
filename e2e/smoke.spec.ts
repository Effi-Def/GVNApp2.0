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

test('crea idea -> Ci sto -> organizza evento', async ({ page }) => {
  await primeRuntime(page, { scenario: 'seeded', auth: 'signed-in' })

  await page.goto('/ideas?create=1')
  await expect(page.getByText('Nuova idea', { exact: true }).last()).toBeVisible()
  await page.getByLabel('Cosa vi piacerebbe fare?').fill('Pesce a Sori')
  await page.locator('form').getByRole('button', { name: /Ristorante/ }).click()
  await page.locator('form').getByRole('button', { name: 'Aggiungi', exact: true }).click()

  const interest = page.getByRole('button', { name: /Ci sto/ })
  await expect(interest).toHaveText(/Ci sto · 1/)
  await interest.click()
  await expect(interest).toHaveText(/Ci sto · 0/)
  await interest.click()
  await expect(interest).toHaveText(/Ci sto · 1/)

  await page.getByRole('article').getByRole('button', { name: 'Organizza', exact: true }).click()
  await page.getByRole('button', { name: /Ho una data/ }).click()

  await expect(page.getByText('Nuovo Evento')).toBeVisible()
  await expect(page.getByLabel('Titolo')).toHaveValue('Pesce a Sori')
  await page.getByLabel('Data').fill('2030-07-20')
  await page.locator('form').getByRole('button', { name: 'Crea', exact: true }).click()
  await expect(page.getByRole('main').getByText('Pesce a Sori')).toBeVisible()

  // In-app navigation: page.goto would run primeRuntime again and wipe the mock data
  await page.getByRole('link', { name: 'Da fare' }).click()
  await page.getByText(/Già organizzate \(1\)/).click()
  await expect(page.getByRole('button', { name: 'Apri evento' })).toBeVisible()
})

test('idea -> sondaggio date -> votazione chiusa -> evento', async ({ page }) => {
  await page.clock.install({ time: new Date('2030-03-25T10:00:00.000Z') })
  await primeRuntime(page, { scenario: 'seeded', auth: 'signed-in' })

  await page.goto('/ideas?create=1')
  await page.getByLabel('Cosa vi piacerebbe fare?').fill('Gita a Camogli')
  await page.locator('form').getByRole('button', { name: 'Aggiungi', exact: true }).click()
  await page.getByRole('article').getByRole('button', { name: 'Organizza', exact: true }).click()
  await page.getByRole('button', { name: /Quando siete liberi/ }).click()

  await expect(page.locator('input[type="text"]').first()).toHaveValue('Quando facciamo “Gita a Camogli”?')
  const dateInputs = page.locator('form input[type="date"]')
  await dateInputs.nth(0).fill('2030-04-06')
  await dateInputs.nth(1).fill('2030-04-07')
  await page.getByRole('button', { name: /Invia sondaggio/ }).click()

  const main = page.getByRole('main')
  await main.getByRole('button', { name: /domenica 7 aprile/ }).click()
  await expect(main.getByText('Hai votato in questo sondaggio')).toBeVisible()
  const createEvent = main.getByRole('button', { name: /Crea l’evento per domenica 7 aprile/ })
  await expect(createEvent).toHaveCount(0)

  await page.clock.fastForward(73 * 60 * 60 * 1000)
  await createEvent.click()

  await expect(page.getByLabel('Titolo')).toHaveValue('Gita a Camogli')
  await expect(page.getByLabel('Data')).toHaveValue('2030-04-07')
  await page.locator('form').getByRole('button', { name: 'Crea', exact: true }).click()
  await expect(main.getByText('Gita a Camogli')).toBeVisible()

  await page.getByRole('link', { name: 'Da fare' }).click()
  await page.getByText(/Già organizzate \(1\)/).click()
  await main.getByRole('button', { name: 'Fatta', exact: true }).click()
  await expect(main.getByText(/Fatte ✅ \(1\)/)).toBeVisible()
})

test('messaggio in chat -> salva come idea', async ({ page }) => {
  await primeRuntime(page, { scenario: 'seeded', auth: 'signed-in' })

  await page.goto('/events/event-seeded/summary')
  await page.getByRole('button', { name: /Sì/ }).click()
  const openChatButton = page.getByRole('main').getByRole('button', { name: 'Apri chat', exact: true })
  await expect(openChatButton).toBeEnabled()
  await openChatButton.click()
  await page.getByPlaceholder('Scrivi un messaggio...').fill('Dovremmo andare a Lisbona')
  await page.getByPlaceholder('Scrivi un messaggio...').press('Enter')
  await expect(page.getByPlaceholder('Scrivi un messaggio...')).toHaveValue('')

  const message = page.getByRole('main').getByText('Dovremmo andare a Lisbona', { exact: true })
  await expect(message).toBeVisible()
  await message.hover()
  await page.getByRole('button', { name: 'Opzioni messaggio' }).click()
  await page.getByRole('button', { name: /Salva come idea/ }).click()

  await expect(page.getByLabel('Cosa vi piacerebbe fare?')).toHaveValue('Dovremmo andare a Lisbona')
  await page.locator('form').getByRole('button', { name: 'Aggiungi', exact: true }).click()
  await expect(page.getByRole('article').getByText('Dovremmo andare a Lisbona')).toBeVisible()
})

test('crea lista -> avanza stato -> resta dopo aver cambiato pagina', async ({ page }) => {
  await primeRuntime(page, { scenario: 'seeded', auth: 'signed-in' })

  await page.goto('/lists?create=1')
  await page.getByLabel('Titolo lista').fill('Preparativi')
  await page.getByLabel('Tipo lista').selectOption('todo')
  await page.getByLabel('Elemento 1', { exact: true }).fill('Prenotare')
  await page.getByRole('button', { name: 'Crea lista' }).click()

  const main = page.getByRole('main')
  await expect(main.getByText('Prenotare')).toBeVisible()
  await expect(main.getByText('Condivisa')).toBeVisible()

  await main.getByRole('button', { name: 'Da fare', exact: true }).click()
  await main.getByRole('button', { name: 'In corso', exact: true }).click()
  await expect(main.getByRole('button', { name: 'Fatto', exact: true })).toBeVisible()
  await expect(main.getByText(/1\/1 \(100%\)/)).toBeVisible()

  // The list must survive leaving the page, without a reload
  await page.getByRole('link', { name: 'Eventi' }).click()
  await expect(page).toHaveURL(/\/events/)
  await page.getByRole('link', { name: 'Liste' }).click()
  await expect(main.getByText('Prenotare')).toBeVisible()
  await expect(main.getByText(/1\/1 \(100%\)/)).toBeVisible()
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
  await expect(page.getByText(/\+21,00\s€/)).toBeVisible()
})