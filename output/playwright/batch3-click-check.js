async (page) => {
  const base = 'http://localhost:3001'
  const results = []

  async function record(kind, name, href) {
    const text = await page.locator('body').innerText().catch(() => '')
    results.push({
      kind,
      name,
      href,
      url: page.url(),
      ok: !/404|This page could not be found|Application error/i.test(text),
    })
  }

  async function clickHeader(name) {
    await page.goto(base)
    await page.getByRole('button', { name: 'Open menu' }).click()
    const link = page.locator('nav').getByRole('link', { name, exact: true }).first()
    const href = await link.getAttribute('href')
    await link.click()
    await page.waitForURL((url) => url.pathname === href, { timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(800)
    await record('header service', name, href)
  }

  async function clickFooter(name) {
    await page.goto(base)
    const footer = page.locator('footer')
    await footer.scrollIntoViewIfNeeded()
    const link = footer.getByRole('link', { name, exact: true }).first()
    const href = await link.getAttribute('href')
    await link.click()
    await page.waitForURL((url) => url.pathname === href, { timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(800)
    await record('footer city', name, href)
  }

  for (const name of ['Botox', 'Cheek Filler', 'Daxxify', 'Jawline Filler', 'Xeomin']) {
    await clickHeader(name)
  }
  for (const name of ['New York City', 'Los Angeles', 'Miami', 'Houston', 'Austin']) {
    await clickFooter(name)
  }

  return JSON.stringify(results, null, 2)
}
