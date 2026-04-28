export interface SelectionDetailRow {
  k: string
  v: string | number | null | undefined
}

export interface SelectionDetail {
  kind: 'tip' | 'edge'
  title: string
  rows: SelectionDetailRow[]
  raw: unknown
}

export interface DetailsSelectionRequest {
  detail: SelectionDetail
  payload: Record<string, unknown>
  treeIndex: number
}

export function buildDetailsRequestForPick(
  kind: 'tip' | 'edge',
  picked: unknown,
): DetailsSelectionRequest | null {
  if (!picked) {
    return null
  }

  if (kind === 'tip') {
    const tip = picked as { tree_idx?: number; node_id?: number }
    if (tip.tree_idx == null || tip.node_id == null) {
      return null
    }
    return {
      detail: {
        kind: 'tip',
        title: 'Selected tip',
        rows: [
          { k: 'Tree', v: tip.tree_idx },
          { k: 'Node ID', v: tip.node_id },
        ],
        raw: picked,
      },
      payload: {
        treeIndex: tip.tree_idx,
        node: tip.node_id,
        comprehensive: true,
      },
      treeIndex: tip.tree_idx,
    }
  }

  const edge = picked as {
    tree_idx?: number
    parent_id?: number
    child_id?: number
  }
  if (edge.tree_idx == null) {
    return null
  }
  return {
    detail: {
      kind: 'edge',
      title: 'Selected edge',
      rows: [
        { k: 'Tree', v: edge.tree_idx },
        { k: 'Parent', v: edge.parent_id },
        { k: 'Child', v: edge.child_id },
      ],
      raw: picked,
    },
    payload: {
      treeIndex: edge.tree_idx,
    },
    treeIndex: edge.tree_idx,
  }
}
