import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import { AbstractSessionModel, isAbstractMenuManager } from '@jbrowse/core/util'
import { version } from '../package.json'
// import {
//   ReactComponent as HelloViewReactComponent,
//   stateModel as helloViewStateModel,
// } from './HelloView'

import LoraxTrackF from './LoraxTrack'
import LoraxDisplayF from './LoraxDisplay'
import LoraxAdapterF from './LoraxAdapter'
import LoraxRPCMethodsF from './LoraxRPC'
import LoraxMetadataWidgetF from './LoraxMetadataWidget'

export default class LoraxPlugin extends Plugin {
  name = 'LoraxPlugin'
  version = version

  install(pluginManager: PluginManager) {
    LoraxTrackF(pluginManager)
    LoraxDisplayF(pluginManager)
    LoraxAdapterF(pluginManager)
    LoraxRPCMethodsF(pluginManager)
    LoraxMetadataWidgetF(pluginManager)
  }

  configure(_pluginManager: PluginManager) {
    console.log('LoraxPlugin configured')
  }
}
