jest.mock('@jbrowse/core/data_adapters/BaseAdapter', () => ({
  BaseFeatureDataAdapter: class MockBaseFeatureDataAdapter {
    config: Record<string, unknown>
    pluginManager = {}

    constructor(config: Record<string, unknown>) {
      this.config = config
    }

    getConf(key: string) {
      return this.config[key]
    }
  },
}))

jest.mock('@jbrowse/core/util/rxjs', () => ({
  ObservableCreate: jest.fn((callback: unknown) => ({ callback })),
}))

jest.mock('@jbrowse/core/util/io', () => ({
  openLocation: jest.fn(),
}))

jest.mock('socket.io-client', () => ({
  io: jest.fn(),
}))

import LoraxAdapter from './LoraxAdapter'

function createConnectedSocket() {
  const handlers: Record<string, (message?: unknown) => void> = {}
  const socket = {
    connected: true,
  } as {
    connected: boolean
    once: jest.Mock
    off: jest.Mock
    emit: jest.Mock
  }
  socket.once = jest.fn(
    (event: string, callback: (message?: unknown) => void) => {
      handlers[event] = callback
      return socket
    },
  )
  socket.off = jest.fn()
  socket.emit = jest.fn((event: string, payload: Record<string, unknown>) => {
    if (event === 'load_file') {
      handlers['load-file-result']?.({
        ok: true,
        filename: payload.file,
        config: {},
      })
    }
    return socket
  })
  return { socket, handlers }
}

describe('LoraxAdapter.freeResources', () => {
  it('does not tear down adapter-scoped socket or session state', () => {
    const adapter = new LoraxAdapter({} as never) as unknown as {
      socket?: {
        removeAllListeners: jest.Mock
        disconnect: jest.Mock
      }
      socketPromise?: Promise<unknown>
      loraxSid?: string
      freeResources(region: unknown): void
    }
    const socket = {
      removeAllListeners: jest.fn(),
      disconnect: jest.fn(),
    }
    const socketPromise = Promise.resolve(socket)
    adapter.socket = socket
    adapter.socketPromise = socketPromise
    adapter.loraxSid = 'sid-1'

    adapter.freeResources({})

    expect(socket.removeAllListeners).not.toHaveBeenCalled()
    expect(socket.disconnect).not.toHaveBeenCalled()
    expect(adapter.socket).toBe(socket)
    expect(adapter.socketPromise).toBe(socketPromise)
    expect(adapter.loraxSid).toBe('sid-1')
  })
})

describe('LoraxAdapter.loadFile session handling', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    jest.restoreAllMocks()
  })

  it('uses configured loraxSid without initializing a new backend session', async () => {
    const adapter = new LoraxAdapter({
      loraxSid: 'sid-from-website',
      project: '1000Genomes',
      file: '1kg_chr2.trees.tsz',
    } as never) as unknown as {
      socket?: unknown
      loadFile(): Promise<{ loraxSid?: string }>
    }
    const { socket } = createConnectedSocket()
    adapter.socket = socket
    global.fetch = jest.fn()

    const result = await adapter.loadFile()

    expect(global.fetch).not.toHaveBeenCalled()
    expect(socket.emit).toHaveBeenCalledWith('load_file', {
      lorax_sid: 'sid-from-website',
      project: '1000Genomes',
      file: '1kg_chr2.trees.tsz',
      share_sid: undefined,
    })
    expect(result.loraxSid).toBe('sid-from-website')
  })

  it('keeps existing filePath loading behavior when no loraxSid is configured', async () => {
    const adapter = new LoraxAdapter({
      apiBase: 'http://localhost:8080',
      filePath: '/tmp/example.trees',
    } as never) as unknown as {
      socket?: unknown
      loadFile(): Promise<{ loraxSid?: string }>
    }
    const { socket } = createConnectedSocket()
    adapter.socket = socket
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sid: 'new-sid' }),
    } as never)

    const result = await adapter.loadFile()

    expect(global.fetch).toHaveBeenCalledWith('http://localhost:8080/init-session', {
      method: 'POST',
      credentials: 'include',
    })
    expect(socket.emit).toHaveBeenCalledWith('load_file', {
      lorax_sid: 'new-sid',
      file_path: '/tmp/example.trees',
    })
    expect(result.loraxSid).toBe('new-sid')
  })
})
