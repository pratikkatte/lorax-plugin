import { computeStrictVisibleRegion } from './viewport'

describe('computeStrictVisibleRegion', () => {
  it('uses viewport pixels for ROI while clipping deck placement to visible content', () => {
    const view = {
      width: 1000,
      offsetPx: 250,
      dynamicBlocks: {
        contentBlocks: [
          { refName: 'chr1', start: 200, end: 1300, offsetPx: 200, widthPx: 1100 },
        ],
      },
      pxToBp: (px: number) => ({
        refName: 'chr1',
        index: 0,
        start: 0,
        end: 2000,
        coord: 250 + px,
      }),
    }

    expect(computeStrictVisibleRegion(view)).toEqual({
      intervalCoords: [250, 1250],
      placement: { leftPx: 0, widthPx: 1000 },
    })
  })

  it('uses the first contiguous visible span when the viewport crosses references', () => {
    const view = {
      width: 1000,
      offsetPx: 0,
      dynamicBlocks: {
        contentBlocks: [
          { refName: 'chr1', start: 900, end: 1000, offsetPx: 0, widthPx: 400 },
          { refName: 'chr2', start: 0, end: 150, offsetPx: 450, widthPx: 550 },
        ],
      },
      pxToBp: (px: number) => {
        if (px <= 400) {
          return {
            refName: 'chr1',
            index: 0,
            start: 0,
            end: 1000,
            coord: 900 + px / 4,
          }
        }
        return {
          refName: 'chr2',
          index: 1,
          start: 0,
          end: 500,
          coord: (px - 450) / 4,
        }
      },
    }

    expect(computeStrictVisibleRegion(view)).toEqual({
      intervalCoords: [900, 1000],
      placement: { leftPx: 0, widthPx: 1000 },
    })
  })
})
