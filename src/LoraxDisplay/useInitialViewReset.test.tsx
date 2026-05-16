import React, { useRef } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { useInitialViewReset } from './useInitialViewReset'

describe('useInitialViewReset', () => {
  it('runs the vertical reset once when the loaded config is ready', async () => {
    const viewAdjustY = jest.fn(() => true)
    renderHook(() => {
      const deckRef = useRef({ viewAdjustY })
      useInitialViewReset({
        deckRef,
        loadKey: 'file-a:1000',
        ready: true,
      })
    })

    await waitFor(() => expect(viewAdjustY).toHaveBeenCalledTimes(1))
  })

  it('retries until viewAdjustY reports that bounds were available', async () => {
    const viewAdjustY = jest
      .fn()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true)

    renderHook(() => {
      const deckRef = useRef({ viewAdjustY })
      useInitialViewReset({
        deckRef,
        loadKey: 'file-a:1000',
        ready: true,
        retryMs: 1,
      })
    })

    await waitFor(() => expect(viewAdjustY).toHaveBeenCalledTimes(2))
  })
})
