import { Given, When, Then } from '@cucumber/cucumber'
import assert from 'node:assert'

// ─── Given steps ────────────────────────────────────────────────────────────

Given('I am on the registration page', async function () {
  await this.page.goto(`${this.baseUrl}/register`)
  await this.page.waitForSelector('#username')
})

Given('a test user account exists', async function () {
  const { username, email, password } = this.testUser
  // Create the test user via API; ignore if already exists
  try {
    await fetch(`${this.usersApiUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    })
  } catch {
    // Ignore network errors — the step will surface real failures later
  }
})

Given('I am on the login page', async function () {
  await this.page.goto(`${this.baseUrl}/login`)
  await this.page.waitForSelector('#email')
})

Given('I am logged in as the test user', async function () {
  const { email, password } = this.testUser

  // Obtain a JWT via the API
  const res = await fetch(`${this.usersApiUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  assert.ok(res.ok, `Login API call failed: ${res.status}`)
  const { token, user } = await res.json()

  // Seed localStorage so the app considers the user logged in
  await this.page.goto(this.baseUrl)
  await this.page.evaluate(({ token, user }) => {
    localStorage.setItem('yovi_token', JSON.stringify(token))
    localStorage.setItem('yovi_user', JSON.stringify(user))
  }, { token, user })

  // Navigate to the protected area
  await this.page.goto(`${this.baseUrl}/games`)
  await this.page.waitForURL('**/games')
})

// ─── When steps ─────────────────────────────────────────────────────────────

When('I fill in the registration form with valid data', async function () {
  await this.page.fill('#username', this.newUser.username)
  await this.page.fill('#email', this.newUser.email)
  await this.page.fill('#password', this.newUser.password)
  await this.page.fill('#passwordConfirm', this.newUser.password)
})

When('I submit the registration form', async function () {
  await this.page.click('button[type="submit"]')
})

When('I fill in the login form with the test user credentials', async function () {
  await this.page.fill('#email', this.testUser.email)
  await this.page.fill('#password', this.testUser.password)
})

When('I submit the login form', async function () {
  await this.page.click('button[type="submit"]')
})

// ─── Then steps ─────────────────────────────────────────────────────────────

Then('I should see the account created message', async function () {
  await this.page.waitForSelector('text=Account Created!', { timeout: 10_000 })
})

Then('I should be on the games page', async function () {
  await this.page.waitForURL('**/games', { timeout: 10_000 })
  const url = this.page.url()
  assert.ok(url.includes('/games'), `Expected games page but got: ${url}`)
})
