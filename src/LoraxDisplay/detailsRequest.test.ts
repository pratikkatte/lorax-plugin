import { buildDetailsRequestForPick } from './detailsRequest'

describe('buildDetailsRequestForPick', () => {
  it('builds the comprehensive tip details payload', () => {
    const tip = { tree_idx: 3, node_id: 9 }

    expect(buildDetailsRequestForPick('tip', tip)).toEqual({
      detail: {
        kind: 'tip',
        title: 'Selected tip',
        rows: [
          { k: 'Tree', v: 3 },
          { k: 'Node ID', v: 9 },
        ],
        raw: tip,
      },
      payload: {
        treeIndex: 3,
        node: 9,
        comprehensive: true,
      },
      treeIndex: 3,
    })
  })

  it('builds the tree-only edge details payload', () => {
    const edge = { tree_idx: 4, parent_id: 1, child_id: 2 }

    expect(buildDetailsRequestForPick('edge', edge)).toEqual({
      detail: {
        kind: 'edge',
        title: 'Selected edge',
        rows: [
          { k: 'Tree', v: 4 },
          { k: 'Parent', v: 1 },
          { k: 'Child', v: 2 },
        ],
        raw: edge,
      },
      payload: {
        treeIndex: 4,
      },
      treeIndex: 4,
    })
  })

  it('ignores incomplete picks', () => {
    expect(buildDetailsRequestForPick('tip', { tree_idx: 1 })).toBeNull()
    expect(buildDetailsRequestForPick('edge', { parent_id: 1 })).toBeNull()
  })
})
