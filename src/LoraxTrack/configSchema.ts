import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { createBaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'
import PluginManager from '@jbrowse/core/PluginManager'

export default function configSchemaFactory(pluginManager: PluginManager) {
  return ConfigurationSchema('LoraxTrack', {
    defaultHeight: {
      type: 'number',
      description: 'Default height of the Lorax track in pixels',
      defaultValue: 400,
    },
  }, {
    baseConfiguration: createBaseTrackConfig(pluginManager),
    explicitIdentifier: 'trackId',
  })
}