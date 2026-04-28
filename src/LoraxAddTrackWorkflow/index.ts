import { lazy } from 'react'
import { AddTrackWorkflowType } from '@jbrowse/core/pluggableElementTypes'
import { types } from 'mobx-state-tree'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function LoraxAddTrackWorkflowF(pm: PluginManager) {
  pm.addAddTrackWorkflowType(
    () =>
      new AddTrackWorkflowType({
        name: 'Lorax upload track',
        ReactComponent: lazy(() => import('./AddTrackWorkflow')),
        stateModel: types.model({
          apiBase: types.optional(types.string, ''),
        }),
      }),
  )
}
