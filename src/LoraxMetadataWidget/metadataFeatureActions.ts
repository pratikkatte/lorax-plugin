import type React from 'react'

interface DeckActionRef {
  viewAdjustY?: () => boolean
}

export const metadataFeatureActions = {
  adjustView: ({ deckRef }: { deckRef?: React.RefObject<DeckActionRef> }) => {
    const applied = deckRef?.current?.viewAdjustY?.()
    return applied
  },
}
