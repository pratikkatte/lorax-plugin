import { AdapterType } from '@jbrowse/core/pluggableElementTypes'
import PluginManager from '@jbrowse/core/PluginManager'
import configSchema from './configSchema'

export default function LoraxAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(() => {
    return new AdapterType({
      name: 'LoraxAdapter',
      configSchema,
      getAdapterClass: () => import('./LoraxAdapter').then(r => r.default),
    })
  })
}