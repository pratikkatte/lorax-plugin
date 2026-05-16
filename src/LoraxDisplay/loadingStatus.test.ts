import { getLoraxLoadingStatus } from './loadingStatus'

describe('getLoraxLoadingStatus', () => {
  it('prioritizes the backend connection before config and tree loading', () => {
    expect(
      getLoraxLoadingStatus({
        isConnected: false,
        hasLoadConfig: false,
        treeIsLoading: true,
      }),
    ).toBe('Connecting to backend')
  })

  it('reports config loading after the backend connects and before config exists', () => {
    expect(
      getLoraxLoadingStatus({
        isConnected: true,
        hasLoadConfig: false,
        treeIsLoading: false,
      }),
    ).toBe('Loading config')
  })

  it('reports tree loading while visible trees are being fetched', () => {
    expect(
      getLoraxLoadingStatus({
        isConnected: true,
        hasLoadConfig: true,
        treeIsLoading: true,
      }),
    ).toBe('Loading trees')
  })

  it('hides backend status text once the track is connected and loaded', () => {
    expect(
      getLoraxLoadingStatus({
        isConnected: true,
        hasLoadConfig: true,
        treeIsLoading: false,
        backendStatusMessage: { message: 'Connected' },
      }),
    ).toBeUndefined()
  })

  it('hides session restored status once the track is connected and loaded', () => {
    expect(
      getLoraxLoadingStatus({
        isConnected: true,
        hasLoadConfig: true,
        treeIsLoading: false,
        backendStatusMessage: {
          message: 'Session restored. File: sample.trees',
        },
      }),
    ).toBeUndefined()
  })

  it('hides the loader once backend status is terminal', () => {
    expect(
      getLoraxLoadingStatus({
        isConnected: true,
        hasLoadConfig: true,
        treeIsLoading: false,
        backendStatusMessage: { message: 'config loaded' },
      }),
    ).toBeUndefined()
  })
})
