import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import type * as ReactNamespace from 'react'

interface MockProps {
  children?: React.ReactNode
}

jest.mock('tss-react/mui', () => ({
  makeStyles: () => () => () => ({
    classes: {
      accordionDetails: 'accordionDetails',
      paper: 'paper',
      pre: 'pre',
      sectionHeader: 'sectionHeader',
      tabPanel: 'tabPanel',
      trackTitle: 'trackTitle',
      filterBox: 'filterBox',
      filterInput: 'filterInput',
      filterRow: 'filterRow',
      linkButton: 'linkButton',
      tag: 'tag',
      valueList: 'valueList',
      valueRow: 'valueRow',
    },
  }),
}))

jest.mock('@mui/icons-material/ExpandMore', () => {
  return function MockExpandMoreIcon() {
    return null
  }
})

jest.mock('@mui/material', () => {
  const ReactMock = jest.requireActual<typeof ReactNamespace>('react')
  const passthrough = (tag: 'div' | 'pre') => {
    return function MockComponent({ children }: MockProps) {
      return ReactMock.createElement(tag, null, children)
    }
  }

  return {
    Accordion: passthrough('div'),
    AccordionDetails: passthrough('div'),
    AccordionSummary: passthrough('div'),
    Box: passthrough('div'),
    Divider: passthrough('div'),
    Paper: passthrough('div'),
    Tab: ({ label }: { label?: React.ReactNode }) =>
      ReactMock.createElement('button', null, label),
    Tabs: passthrough('div'),
    Typography: passthrough('div'),
  }
})

jest.mock(
  '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/SimpleField',
  () => {
    return function MockSimpleField({
      name,
      value,
    }: {
      name: string
      value: unknown
    }) {
      return (
        <div>
          <span>{name}</span>
          <span>{String(value)}</span>
        </div>
      )
    }
  },
)

import LoraxMetadataWidget from './LoraxMetadataWidget'

function renderWidget(modelOverrides: Record<string, unknown> = {}) {
  return render(
    <LoraxMetadataWidget
      model={
        {
          id: 'loraxMetadata',
          type: 'LoraxMetadataWidget',
          trackLabel: 'Lorax',
          snapshot: { config: {} },
          selectedDetail: null,
          detailsState: null,
          filterState: null,
          filterController: null,
          activeTab: 0,
          ...modelOverrides,
        } as never
      }
    />,
  )
}

describe('LoraxMetadataWidget Details tab', () => {
  it('shows an empty details state before interaction', () => {
    renderWidget()

    expect(screen.getByText('Select an element to view details')).toBeTruthy()
  })

  it('shows a loading state while details are being fetched', () => {
    renderWidget({
      detailsState: {
        selectedDetail: {
          kind: 'tip',
          title: 'Selected tip',
          rows: [],
          raw: {},
        },
        data: null,
        loading: true,
        error: null,
        treeIndex: 1,
      },
    })

    expect(screen.getByText('Fetching details...')).toBeTruthy()
  })

  it('renders tree-only details from an edge response', () => {
    renderWidget({
      detailsState: {
        selectedDetail: {
          kind: 'edge',
          title: 'Selected edge',
          rows: [],
          raw: {},
        },
        data: {
          tree: {
            interval: [10, 20],
            num_roots: 1,
            num_nodes: 4,
            mutations: [
              {
                id: 7,
                position: 12.4,
                inherited_state: 'A',
                derived_state: 'G',
              },
            ],
          },
        },
        loading: false,
        error: null,
        treeIndex: 2,
      },
    })

    expect(screen.getByText('Tree Details')).toBeTruthy()
    expect(screen.getByText('10, 20')).toBeTruthy()
    expect(screen.getByText('Mutations (1)')).toBeTruthy()
    expect(screen.getByText('A → G (Pos: 12)')).toBeTruthy()
  })

  it('renders comprehensive tip details', () => {
    renderWidget({
      detailsState: {
        selectedDetail: {
          kind: 'tip',
          title: 'Selected tip',
          rows: [],
          raw: {},
        },
        data: {
          node: {
            id: 5,
            time: 0,
            individual: 3,
            metadata: { name: 'sample-5' },
          },
          individual: {
            id: 3,
            flags: 0,
            location: [1, 2],
            parents: [8, 9],
            nodes: [5],
            metadata: { country: 'Canada' },
          },
          population: {
            id: 2,
            metadata: { region: 'North America' },
          },
          mutations: [
            {
              id: 11,
              position: 42,
              ancestral_state: 'A',
              derived_state: 'T',
              time: 1.5,
            },
          ],
        },
        loading: false,
        error: null,
        treeIndex: 4,
      },
    })

    expect(screen.getByText('Node Details')).toBeTruthy()
    expect(screen.getByText('sample-5')).toBeTruthy()
    expect(screen.getByText('Individual Details')).toBeTruthy()
    expect(screen.getByText('Country')).toBeTruthy()
    expect(screen.getByText('Canada')).toBeTruthy()
    expect(screen.getByText('Population')).toBeTruthy()
    expect(screen.getByText('North America')).toBeTruthy()
    expect(screen.getByText('Mutations on Node (1)')).toBeTruthy()
    expect(screen.getByText('A → T')).toBeTruthy()
  })

  it('shows details errors', () => {
    renderWidget({
      detailsState: {
        selectedDetail: {
          kind: 'tip',
          title: 'Selected tip',
          rows: [],
          raw: {},
        },
        data: null,
        loading: false,
        error: 'backend failed',
      },
    })

    expect(
      screen.getByText('Error fetching details: backend failed'),
    ).toBeTruthy()
  })
})

describe('LoraxMetadataWidget Filter tab', () => {
  const filterState = {
    tsconfig: {
      project: '1000Genomes',
      filename: '1kg_chr2.trees.tsz',
      tree_info: false,
    },
    searchTerm: '',
    searchTags: ['GBR'],
    selectedColorBy: 'name',
    coloryby: { name: 'Population' },
    metadataColors: {
      name: {
        GBR: [79, 182, 193, 255],
        CHS: [154, 148, 89, 255],
      },
    },
    loadedMetadata: { name: 'pyarrow' },
    enabledValues: ['GBR', 'CHS'],
    highlightedMetadataValue: 'GBR',
    displayLineagePaths: true,
    visibleTrees: [10, 11],
    treeColors: { '10': '#91C2F4' },
    colorByTree: false,
    hoveredTreeIndex: null,
    activeFeatureId: null,
  }

  it('renders an empty filter state', () => {
    renderWidget({ activeTab: 2 })

    expect(screen.getAllByText('No metadata available').length).toBeGreaterThan(
      0,
    )
    expect(screen.getByText('No visible trees')).toBeTruthy()
  })

  it('renders metadata filter controls from filterState', () => {
    renderWidget({ activeTab: 2, filterState })

    expect(screen.getByLabelText('Metadata key')).toBeTruthy()
    expect(screen.getAllByText('GBR').length).toBeGreaterThan(0)
    expect(screen.getByText('CHS')).toBeTruthy()
    expect(screen.getByText('Feature presets')).toBeTruthy()
    expect(screen.getByText('Tree 10')).toBeTruthy()
  })

  it('calls controller actions for search tags and enabled values', () => {
    const controller = {
      removeSearchTag: jest.fn(),
      toggleEnabledValue: jest.fn(),
      addSearchTag: jest.fn(),
    }
    renderWidget({ activeTab: 2, filterState, filterController: controller })

    fireEvent.click(screen.getByLabelText('Remove GBR'))
    expect(controller.removeSearchTag).toHaveBeenCalledWith(0)

    fireEvent.click(screen.getAllByText('Remove')[0])
    expect(controller.toggleEnabledValue).toHaveBeenCalledWith('GBR')

    fireEvent.click(screen.getAllByText('Search')[1])
    expect(controller.addSearchTag).toHaveBeenCalledWith('GBR')
  })

  it('calls controller actions for key selection and color changes', () => {
    const controller = {
      setSelectedColorBy: jest.fn(),
      setSearchTerm: jest.fn(),
      setSearchTags: jest.fn(),
      setMetadataColor: jest.fn(),
    }
    renderWidget({ activeTab: 2, filterState, filterController: controller })

    fireEvent.change(screen.getByLabelText('Metadata key'), {
      target: { value: 'name' },
    })
    expect(controller.setSelectedColorBy).toHaveBeenCalledWith('name')

    fireEvent.change(screen.getByLabelText('Color for CHS'), {
      target: { value: '#010203' },
    })
    expect(controller.setMetadataColor).toHaveBeenCalledWith(
      'name',
      'CHS',
      [1, 2, 3, 255],
    )
  })

  it('calls preset controller actions', () => {
    const controller = {
      applyPresetFeature: jest.fn(),
      disablePresetFeature: jest.fn(),
    }
    const { rerender } = render(
      <LoraxMetadataWidget
        model={
          {
            id: 'loraxMetadata',
            type: 'LoraxMetadataWidget',
            trackLabel: 'Lorax',
            snapshot: { config: {} },
            selectedDetail: null,
            detailsState: null,
            filterState,
            filterController: controller,
            activeTab: 2,
          } as never
        }
      />,
    )

    fireEvent.click(screen.getByTitle('Enable preset'))
    expect(controller.applyPresetFeature).toHaveBeenCalled()

    rerender(
      <LoraxMetadataWidget
        model={
          {
            id: 'loraxMetadata',
            type: 'LoraxMetadataWidget',
            trackLabel: 'Lorax',
            snapshot: { config: {} },
            selectedDetail: null,
            detailsState: null,
            filterState: {
              ...filterState,
              activeFeatureId: 'lactase_persistence',
            },
            filterController: controller,
            activeTab: 2,
          } as never
        }
      />,
    )
    fireEvent.click(screen.getByTitle('Disable preset'))
    expect(controller.disablePresetFeature).toHaveBeenCalled()
  })
})
