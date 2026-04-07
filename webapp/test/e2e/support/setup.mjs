import { setWorldConstructor, setDefaultTimeout, Before, After } from '@cucumber/cucumber'
import { chromium } from '@playwright/test'

const BASE_URL = process.env.WEBAPP_URL ?? 'http://localhost:3000'
const USERS_API_URL = process.env.USERS_API_URL ?? 'http://localhost:3001'

export class YoviWorld {
  constructor() {
    this.baseUrl = BASE_URL
    this.usersApiUrl = USERS_API_URL
    this.browser = null
    this.page = null

    // Fixed credentials shared by login and create-game scenarios
    this.testUser = {
      username: 'e2etestuser',
      email: 'e2e@test.local',
      password: 'TestPass123',
    }

    // Unique credentials for the registration scenario
    const ts = Date.now()
    this.newUser = {
      username: `e2enew${ts}`,
      email: `e2enew${ts}@test.local`,
      password: 'TestPass123',
    }
  }
}

setWorldConstructor(YoviWorld)
setDefaultTimeout(30_000)

Before(async function () {
  this.browser = await chromium.launch({ headless: true })
  const ctx = await this.browser.newContext()
  this.page = await ctx.newPage()
})

After(async function () {
  await this.browser?.close()
})
