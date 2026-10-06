import { defineConfig, devices } from '@playwright/test'
import fs from 'fs'

// Local credentials (IZ_EMAIL, IZ_PASSWORD) live in .env, which is not committed
if (fs.existsSync('.env')) process.loadEnvFile('.env')

export default defineConfig({
	testDir: './tests',
	timeout: 180_000,
	expect: { timeout: 15_000 },
	fullyParallel: false,
	workers: 1,
	retries: 0,
	reporter: [['list'], ['html', { open: 'never' }]],
	use: {
		baseURL: 'https://demo-main.ieltszoneapp.uz',
		viewport: { width: 1440, height: 900 },
		screenshot: 'only-on-failure',
		trace: 'retain-on-failure',
		video: 'retain-on-failure',
		actionTimeout: 20_000,
		navigationTimeout: 60_000,
	},
	projects: [
		{ name: 'setup', testMatch: /auth\.setup\.ts/ },
		{
			name: 'chromium',
			use: {
				...devices['Desktop Chrome'],
				viewport: { width: 1440, height: 900 },
				storageState: '.auth/ceo.json',
			},
			dependencies: ['setup'],
		},
	],
})
