import { When, Then } from '@cucumber/cucumber'
import assert from 'node:assert'

When('I click {string} on Game Y', async function (buttonText) {
  // Game Y is selected by default on the games page; just click the button
  await this.page.waitForSelector(`button:has-text("${buttonText}")`, { timeout: 10_000 })
  await this.page.click(`button:has-text("${buttonText}")`)
  await this.page.waitForURL('**/games/y', { timeout: 10_000 })
})

When('I select {string} mode', async function (modeTitle) {
  // ModeCard uses role="button" and contains the mode title text
  await this.page.waitForSelector(`[role="button"]:has-text("${modeTitle}")`, { timeout: 10_000 })
  await this.page.click(`[role="button"]:has-text("${modeTitle}")`)
  await this.page.waitForURL('**/games/y/config/**', { timeout: 10_000 })
})

When('I click {string}', async function (buttonText) {
  await this.page.waitForSelector(`button:has-text("${buttonText}")`, { timeout: 10_000 })
  await this.page.click(`button:has-text("${buttonText}")`)
})

Then('I should see the game board', async function () {
  // Wait for navigation to the game play page
  await this.page.waitForURL('**/games/y/play/**', { timeout: 15_000 })

  // Verify the SVG game board is rendered
  const board = await this.page.waitForSelector('[aria-label="Game Y Board"]', { timeout: 10_000 })
  assert.ok(board, 'Game Y Board should be visible')
})
