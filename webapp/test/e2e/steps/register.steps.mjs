import { Given, When, Then } from '@cucumber/cucumber'
import assert from 'assert'

Given('the register page is open', async function () {
  const page = this.page
  if (!page) throw new Error('Page not initialized')
  await page.goto('http://localhost:5173/register')
})

When('I enter {string} as the username and submit', async function (username) {
  const page = this.page

  await page.fill('[aria-label="Username"]', username)
  await page.fill('[aria-label="Email"]', 'email@test.com')
  await page.fill('[aria-label="Password"]', 'password123')
  await page.click('[type="submit"]')
})

Then('I should be redirected to the game screen', async function () {
  const page = this.page
  await page.waitForURL('**/game', { timeout: 5000 })
  await page.waitForSelector('[aria-label="Game board"]', { timeout: 5000 })
  assert.ok(page.url().includes('/game'))
})
