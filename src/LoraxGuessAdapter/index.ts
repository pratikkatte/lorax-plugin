import PluginManager from '@jbrowse/core/PluginManager'
import type { FileLocation } from '@jbrowse/core/util/types'
import { getFileName } from '@jbrowse/core/util/tracks'

type AdapterGuesser = (
  file: FileLocation,
  index?: FileLocation,
  adapterHint?: string,
) => Record<string, unknown> | undefined

type TrackTypeGuesser = (adapterName: string) => string | undefined

export default function LoraxGuessAdapterF(pluginManager: PluginManager) {
  pluginManager.addToExtensionPoint(
    'Core-guessAdapterForLocation',
    (adapterGuesser: AdapterGuesser) => {
      return (
        file: FileLocation,
        index?: FileLocation,
        adapterHint?: string,
      ) => {
        const fileName = getFileName(file)
        const isLoraxFile = /\.(trees|tree|tsz|csv)(\.gz)?$/i.test(fileName)
        const hintMatches = adapterHint === 'LoraxAdapter'

        if (isLoraxFile || hintMatches) {
          return {
            type: 'LoraxAdapter',
            apiBase: 'http://localhost:8080',
            fileLocation: file,
            useUpload: true,
          }
        }
        return adapterGuesser(file, index, adapterHint)
      }
    },
  )

  pluginManager.addToExtensionPoint(
    'Core-guessTrackTypeForLocation',
    (trackTypeGuesser: TrackTypeGuesser) => {
      return (adapterName: string) => {
        if (adapterName === 'LoraxAdapter') {
          return 'LoraxTrack'
        }
        return trackTypeGuesser(adapterName)
      }
    },
  )
}
