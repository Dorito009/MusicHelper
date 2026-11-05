import { expect, test } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

test('import an .mxl score, play it through in wait-for-me mode with the computer keyboard, and see the results', async ({ page }) => {
  await page.goto('practice')
  await expect(page.getByText('No scores yet')).toBeVisible()
  await expect(page).toHaveTitle('Music Helper | Practice')

  await page.getByTestId('score-file-input').setInputFiles(path.join(here, 'fixtures/simple-melody.mxl'))
  await expect(page.getByText('Imported 1 score.')).toBeVisible()
  await page.getByRole('link', { name: 'Simple melody', exact: true }).click()
  await expect(page.locator('[data-testid=score-view] svg')).toBeVisible()

  await page.getByRole('button', { name: 'Wait for me' }).click()
  await page.getByRole('button', { name: 'Start', exact: true }).click()
  await expect(page.getByTestId('waiting-chip')).toHaveText('Play: C4')

  // C D E F# | G Bb on the DAW-style layout (A = C4), plus one wrong note (K = C5).
  await page.mouse.click(5, 300)
  for (const key of ['KeyA', 'KeyK', 'KeyS', 'KeyD', 'KeyT', 'KeyG', 'KeyU']) {
    await page.keyboard.down(key)
    await page.keyboard.up(key)
  }

  const results = page.getByTestId('results-panel')
  await expect(results).toBeVisible()
  await expect(page.getByTestId('results-accuracy')).toHaveText('86 % accuracy')
  await expect(results).toContainText('6 right notes')
  await expect(results).toContainText('1 wrong notes')
  await expect(page.getByTestId('history-list').first()).toContainText('86 %')

  // The library shows the best accuracy.
  await page.getByRole('link', { name: 'Library', exact: true }).click()
  await expect(page.locator('tbody')).toContainText('86 %')
})

test('practice header keeps theory in one collapsed menu and has no mute or settings buttons', async ({ page }) => {
  await page.goto('practice/settings')
  await expect(page).toHaveTitle('Music Helper | Practice settings')
  await expect(page.getByLabel('mute sound')).toHaveCount(0)
  await page.getByRole('button', { name: 'Theory' }).click()
  await page.getByRole('menuitem', { name: 'Scales' }).click()
  await expect(page).toHaveTitle('Music Helper | Scales')
  await expect(page.getByLabel(/mute sound/)).toBeVisible()
})
