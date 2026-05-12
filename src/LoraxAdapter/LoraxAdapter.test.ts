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
