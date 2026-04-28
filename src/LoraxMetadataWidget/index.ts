import { lazy } from 'react'

import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { WidgetType } from '@jbrowse/core/pluggableElementTypes'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { types } from 'mobx-state-tree'

import type PluginManager from '@jbrowse/core/PluginManager'

const configSchema = ConfigurationSchema('LoraxMetadataWidget', {})

function sanitizeSnapshot(snapshot: unknown) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return snapshot
  }
  const obj = snapshot as Record<string, unknown>
  const config =
    obj.config && typeof obj.config === 'object' && !Array.isArray(obj.config)
      ? (obj.config as Record<string, unknown>)
      : undefined
  const { loraxSid: _loraxSid, ...rest } = obj
  if (!config) {
    return rest
  }
  const {
    sid: _sid,
    intervals,
    mutations,
    metadata_schema,
    ...configRest
  } = config
  return {
    ...rest,
    config: {
      ...configRest,
      intervals_count: Array.isArray(intervals) ? intervals.length : undefined,
      mutations_count: Array.isArray(mutations) ? mutations.length : undefined,
      metadata_schema_keys:
        metadata_schema && typeof metadata_schema === 'object'
          ? Object.keys(metadata_schema as Record<string, unknown>).length
          : undefined,
    },
  }
}

const stateModel = types
  .model('LoraxMetadataWidget', {
    id: ElementId,
    type: types.literal('LoraxMetadataWidget'),
    trackLabel: types.optional(types.string, ''),
    snapshot: types.maybeNull(types.frozen()),
    selectedDetail: types.maybeNull(types.frozen()),
    detailsState: types.maybeNull(types.frozen()),
  })
  .actions(self => ({
    setSnapshot(snapshot: unknown) {
      self.snapshot = sanitizeSnapshot(snapshot)
    },
    setSelectedDetail(detail: unknown) {
      self.selectedDetail = detail
    },
    setDetailsState(detailsState: unknown) {
      self.detailsState = detailsState
    },
  }))

export default function LoraxMetadataWidgetF(pluginManager: PluginManager) {
  pluginManager.addWidgetType(() => {
    return new WidgetType({
      name: 'LoraxMetadataWidget',
      heading: 'Lorax metadata',
      configSchema,
      stateModel,
      ReactComponent: lazy(() => import('./components/LoraxMetadataWidget')),
    })
  })
}
