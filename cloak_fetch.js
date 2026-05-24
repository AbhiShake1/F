#!/usr/bin/env node
// Stealth browser fetch — bypasses bot detection via playwright-extra + stealth plugin
// Run from ~/.F/ so it resolves packages in ~/.F/node_modules/
import { chromium } from 'playwright-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import TurndownService from 'turndown'

chromium.use(StealthPlugin())

const url = process.argv[2]
if (!url) { process.stderr.write('usage: cloak_fetch.js <url>\n'); process.exit(1) }

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
const html = await page.content()
await browser.close()

const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' })
process.stdout.write(td.turndown(html) + '\n')
