jest.mock('@jbrowse/core/configuration', () => {
  const { types } = require('@jbrowse/mobx-state-tree')
  return {
    ConfigurationReference: jest.fn(() => types.frozen()),
    readConfObject: jest.fn(),
  }
}, { virtual: true })

jest.mock('@jbrowse/core/ui', () => ({
  createJBrowseTheme: jest.fn(() => ({
    palette: {
      background: { default: '#fff' },
      divider: '#ddd',
      text: { secondary: '#333' },
    },
  })),
}), { virtual: true })

jest.mock('@jbrowse/core/pluggableElementTypes/models', () => {
  const { types } = require('@jbrowse/mobx-state-tree')
  return {
    BaseDisplay: types.model({}),
  }
}, { virtual: true })

jest.mock('@jbrowse/core/util', () => ({
  getContainingTrack: jest.fn(),
  getContainingView: jest.fn(() => ({ width: 500 })),
  getSession: jest.fn(),
}), { virtual: true })

jest.mock('@jbrowse/plugin-linear-genome-view', () => {
  const { types } = require('@jbrowse/mobx-state-tree')
  return {
    TrackHeightMixin: jest.fn(() => types.model({})),
  }
}, { virtual: true })

jest.mock('@mui/icons-material/Settings', () => ({
  __esModule: true,
  default: function SettingsIcon() {
    return null
  },
}))

import { TextDecoder, TextEncoder } from 'util'
import stateModelFactory, { renderLoraxDisplaySvg } from './model'

Object.assign(globalThis, { TextDecoder, TextEncoder })

const { renderToStaticMarkup } = require('react-dom/server') as typeof import('react-dom/server')

describe('LoraxDisplay track menu', () => {
  function createModel() {
    return stateModelFactory({} as any).create({
      type: 'LoraxDisplay',
      configuration: {},
    }) as any
  }

  function findMenuItem(menuItems: any[], label: string) {
    return menuItems.find(item => item.label === label)
  }

  it('renders Highlight descendants above Lock view and toggles both without changing existing options', () => {
    const model = createModel()

    let menuItems: any[] = model.trackMenuItems()
    const labels = menuItems.map(item => item.label)
    const fileInfoIndex = labels.indexOf('File Info')
    const resetViewIndex = labels.indexOf('Reset view')
    const metadataIndex = labels.indexOf('Metadata view')
    const descendantsItem = findMenuItem(menuItems, 'Highlight descendants')
    const lockItem = findMenuItem(menuItems, 'Lock view')
    const settingsIndex = labels.indexOf('Settings')
    const descendantsIndex = labels.indexOf('Highlight descendants')
    const lockIndex = labels.indexOf('Lock view')

    expect(resetViewIndex).toBe(fileInfoIndex + 1)
    expect(findMenuItem(menuItems, 'Reset view')).toMatchObject({
      label: 'Reset view',
    })
    expect(descendantsItem).toMatchObject({
      type: 'checkbox',
      label: 'Highlight descendants',
      checked: false,
    })
    expect(lockItem).toMatchObject({
      type: 'checkbox',
      label: 'Lock view',
      checked: false,
    })
    expect(descendantsIndex).toBe(metadataIndex + 1)
    expect(lockIndex).toBe(descendantsIndex + 1)
    expect(settingsIndex).toBeGreaterThan(lockIndex)
    expect(findMenuItem(menuItems, 'Compare topologies')).toMatchObject({
      type: 'checkbox',
      checked: false,
    })
    expect(findMenuItem(menuItems, 'Metadata view')).toMatchObject({
      type: 'checkbox',
      checked: false,
    })

    descendantsItem?.onClick?.()
    menuItems = model.trackMenuItems()

    expect(model.highlightDescendantsOnHover).toBe(true)
    expect(findMenuItem(menuItems, 'Highlight descendants')).toMatchObject({
      checked: true,
    })

    lockItem?.onClick?.()
    menuItems = model.trackMenuItems()

    expect(model.lockViewEnabled).toBe(true)
    expect(findMenuItem(menuItems, 'Lock view')).toMatchObject({
      checked: true,
    })
  })

  it('calls the registered reset view provider from the track menu', () => {
    const model = createModel()
    const resetView = jest.fn(() => true)

    model.setResetViewProvider(resetView)
    findMenuItem(model.trackMenuItems(), 'Reset view')?.onClick?.()

    expect(resetView).toHaveBeenCalledTimes(1)
  })
})

describe('renderLoraxDisplaySvg', () => {
  const opts = {}

  it('embeds provider SVG with placement and omits the old placeholder', async () => {
    const element = await renderLoraxDisplaySvg(
      {
        height: 400,
        svgExportProvider: jest.fn().mockResolvedValue({
          svg: '<svg width="10" height="10"><circle cx="5" cy="5" r="4"/></svg>',
          x: 25,
          y: 3,
        }),
      },
      opts,
    )

    const markup = renderToStaticMarkup(element)

    expect(markup).toContain('transform="translate(25 3)"')
    expect(markup).toContain('<circle cx="5" cy="5" r="4"/>')
    expect(markup).not.toContain('Lorax WebGL view is not included')
  })

  it('uses readiness fallback when provider is missing', async () => {
    const element = await renderLoraxDisplaySvg({ height: 400 }, opts)

    const markup = renderToStaticMarkup(element)

    expect(markup).toContain('Lorax view is not ready for export.')
    expect(markup).not.toContain('Lorax WebGL view is not included')
  })

  it('uses readiness fallback when provider fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})

    const element = await renderLoraxDisplaySvg(
      {
        height: 400,
        svgExportProvider: jest.fn().mockRejectedValue(new Error('no deck')),
      },
      opts,
    )

    const markup = renderToStaticMarkup(element)

    expect(markup).toContain('Lorax view is not ready for export.')
    expect(markup).not.toContain('Lorax WebGL view is not included')
  })
})
