import { defineConfig } from '@tarojs/cli'

export default defineConfig({
  projectName: 'baby-growth-miniapp',
  date: '2026-04-12',
  designWidth: 750,
  sourceRoot: 'src',
  outputRoot: 'dist',
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
