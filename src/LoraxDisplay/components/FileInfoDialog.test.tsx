import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import type * as ReactNamespace from 'react'

interface MockProps {
  children?: React.ReactNode
  component?: keyof JSX.IntrinsicElements
  open?: boolean
  onClick?: () => void
}

jest.mock('@mui/material', () => {
  const ReactMock = jest.requireActual<typeof ReactNamespace>('react')

  const passthrough = (tag: keyof JSX.IntrinsicElements) => {
    return function MockComponent({ children, component }: MockProps) {
      return ReactMock.createElement(component ?? tag, null, children)
    }
  }

  return {
    Box: passthrough('div'),
    Button: ({ children, onClick }: MockProps) =>
      ReactMock.createElement('button', { onClick }, children),
    Dialog: ({ children, open }: MockProps) =>
      open ? ReactMock.createElement('div', null, children) : null,
    DialogActions: passthrough('div'),
    DialogContent: passthrough('div'),
    DialogTitle: passthrough('h2'),
    Divider: () => ReactMock.createElement('hr'),
    Typography: passthrough('div'),
  }
})

import FileInfoDialog from './FileInfoDialog'

describe('FileInfoDialog', () => {
  it('renders website-equivalent file info fields from the snapshot', () => {
    render(
      <FileInfoDialog
        open
        onClose={jest.fn()}
        snapshot={{
          config: {
            genome_length: 12345,
            intervals_count: 9,
            num_samples: 3,
            project: 'Demo project',
            table_counts: {
              nodes: 10,
              edges: 20,
            },
            provenance: {
              count: 1,
              latest: {
                timestamp: '2026-05-10T12:00:00Z',
                software: 'tskit',
                software_version: '1.0',
              },
              records: [
                {
                  id: 0,
                  timestamp: '2026-05-10T12:00:00Z',
                  record: { command: 'simulate' },
                },
              ],
            },
            top_level_metadata: {
              species: 'human',
            },
          },
        }}
      />,
    )

    expect(screen.getByText('File Info')).toBeTruthy()
    expect(screen.getByText('sequence length:')).toBeTruthy()
    expect(screen.getByText('12,345 bp')).toBeTruthy()
    expect(screen.getByText('Recombination Intervals:')).toBeTruthy()
    expect(screen.getByText('Samples:')).toBeTruthy()
    expect(screen.getByText('Project:')).toBeTruthy()
    expect(screen.getByText('Demo project')).toBeTruthy()
    expect(screen.getByText('nodes:')).toBeTruthy()
    expect(screen.getByText('edges:')).toBeTruthy()
    expect(screen.getByText('Provenance')).toBeTruthy()
    expect(screen.getByText('latest software:')).toBeTruthy()
    expect(screen.getByText('tskit 1.0')).toBeTruthy()
    expect(screen.getByText('Full provenance records')).toBeTruthy()
    expect(screen.getByText(/"command": "simulate"/)).toBeTruthy()
    expect(screen.getByText('Top-level metadata')).toBeTruthy()
    expect(screen.getByText(/"species": "human"/)).toBeTruthy()
  })

  it('renders an empty state when file info is unavailable', () => {
    render(<FileInfoDialog open onClose={jest.fn()} snapshot={null} />)

    expect(screen.getByText('File info is not available yet.')).toBeTruthy()
  })

  it('calls onClose from the close button', () => {
    const onClose = jest.fn()
    render(<FileInfoDialog open onClose={onClose} snapshot={null} />)

    fireEvent.click(screen.getByText('Close'))

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
