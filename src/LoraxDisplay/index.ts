import PluginManager from '@jbrowse/core/PluginManager'
import { lazy } from 'react'
import { DisplayType } from '@jbrowse/core/pluggableElementTypes'
import configSchema from './configSchema'
import stateModelFactory from './model'

export default function LoraxDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    return new DisplayType({
      name: 'LoraxDisplay',
      displayName: 'Lorax ARG Display',
      configSchema,
      stateModel: stateModelFactory(configSchema),
      trackType: 'LoraxTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: lazy(() => import('./components/LoraxComponent')),
    })
  })
}