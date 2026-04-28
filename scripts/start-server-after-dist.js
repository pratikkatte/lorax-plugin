const fs = require('fs')
const { spawn } = require('child_process')

const bundlePath = 'dist/jbrowse-plugin-lorax.umd.development.js'
const port = process.env.npm_package_config_port || '9000'
const intervalMs = 500

function startServer() {
  const serveCommand = process.platform === 'win32' ? 'serve.cmd' : 'serve'
  const child = spawn(serveCommand, ['--cors', '--listen', port, '.'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal)
      return
    }
    process.exit(code || 0)
  })
}

function waitForBundle() {
  if (fs.existsSync(bundlePath)) {
    startServer()
    return
  }

  console.log(`Waiting for ${bundlePath} before starting plugin server...`)
  const timer = setInterval(() => {
    if (fs.existsSync(bundlePath)) {
      clearInterval(timer)
      startServer()
    }
  }, intervalMs)
}

waitForBundle()
