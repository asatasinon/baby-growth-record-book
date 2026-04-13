import fs from 'node:fs'
import path from 'node:path'

import { defineConfig } from '@tarojs/cli'

function loadFrontendEnv() {
  const candidates = [
    path.resolve(process.cwd(), '..', '.env'),
    path.resolve(process.cwd(), 'frontend', '.env')
  ]

  const envPath = candidates.find((candidate) => fs.existsSync(candidate))
  if (!envPath) {
    return
  }

  const content = fs.readFileSync(envPath, 'utf-8')
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) {
      continue
    }

    const delimiterIndex = line.indexOf('=')
    if (delimiterIndex < 1) {
      continue
    }

    const key = line.slice(0, delimiterIndex).trim()
    const value = line.slice(delimiterIndex + 1).trim().replace(/^['"]|['"]$/g, '')
    process.env[key] = value
  }
}

loadFrontendEnv()

function requireApiBaseUrl(): string {
  const rawValue = process.env.TARO_APP_API_BASE_URL?.trim()
  if (!rawValue || rawValue === 'undefined' || rawValue === 'null') {
    throw new Error('Missing TARO_APP_API_BASE_URL in frontend/.env')
  }
  return rawValue.replace(/\/+$/, '')
}

const API_BASE_URL = requireApiBaseUrl()

export default defineConfig({
  projectName: 'baby-growth-miniapp',
  date: '2026-04-12',
  designWidth: 750,
  deviceRatio: {
    640: 2.34 / 2,
    750: 1,
    828: 1.81 / 2
  },
  sourceRoot: 'src',
  outputRoot: 'dist',
  alias: {
    '@': path.resolve(__dirname, '..', 'src')
  },
  defineConstants: {
    __API_BASE_URL__: JSON.stringify(API_BASE_URL)
  },
  plugins: ['@tarojs/plugin-framework-react'],
  framework: 'react',
  compiler: {
    type: 'webpack5'
  },
  mini: {},
  h5: {
    publicPath: '/',
    staticDirectory: 'static'
  }
})
