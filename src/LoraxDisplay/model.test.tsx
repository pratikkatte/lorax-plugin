jest.mock('@jbrowse/core/configuration', () => ({
  ConfigurationReference: jest.fn(),
  readConfObject: jest.fn(),
}), { virtual: true })

jest.mock('@jbrowse/core/ui', () => ({
  createJBrowseTheme: jest.fn(() => ({
    palette: {
      background: { default: '#fff' },
      divider: '#ddd',
      text: { secondary: '#333' },
    },
  })),
}), { virtual: true })

jest.mock('@jbrowse/core/pluggableElementTypes/models', () => ({
  BaseDisplay: {},
}), { virtual: true })

jest.mock('@jbrowse/core/util', () => ({
  getContainingTrack: jest.fn(),
  getContainingView: jest.fn(() => ({ width: 500 })),
  getSession: jest.fn(),
}), { virtual: true })

jest.mock('@jbrowse/plugin-linear-genome-view', () => ({
  TrackHeightMixin: jest.fn(() => ({})),
}), { virtual: true })

jest.mock('@mui/icons-material/Settings', () => ({
  __esModule: true,
  default: function SettingsIcon() {
    return null
  },
}))

import { TextDecoder, TextEncoder } from 'util'
import { renderLoraxDisplaySvg } from './model'

Object.assign(globalThis, { TextDecoder, TextEncoder })

const { renderToStaticMarkup } = require('react-dom/server') as typeof import('react-dom/server')

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
