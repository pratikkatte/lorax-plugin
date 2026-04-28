import { types, Instance } from 'mobx-state-tree'
import { ConfigurationReference, AnyConfigurationSchemaType, readConfObject } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { getContainingTrack, getSession, isSessionModelWithWidgets } from '@jbrowse/core/util'

import type { MenuItem } from '@jbrowse/core/ui'

/** Stable drawer widget instance id (see LoraxMetadataWidget). */
export const LORAX_METADATA_WIDGET_ID = 'loraxMetadata'

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

export default function stateModelFactory(configSchema: AnyConfigurationSchemaType) {
  const model = types.compose('LoraxDisplay', BaseDisplay, types.model({
    type: types.literal('LoraxDisplay'),
    configuration: ConfigurationReference(configSchema),
    height: types.optional(types.number, 400),
    metadataViewEnabled: types.optional(types.boolean, false),
    /** Serializable snapshot of last load_file result for the metadata drawer. */
    loadResultSnapshot: types.optional(types.frozen(), null),
  }))

  return model
    .views(() => ({
      get rendererTypeName() {
        return 'LoraxRenderer'
      },
    }))
    .actions((self) => ({
      setHeight(height: number) {
        self.height = height
      },
      setMetadataView(value: boolean) {
        self.metadataViewEnabled = value
      },
      setLoadResultSnapshot(snapshot: unknown) {
        self.loadResultSnapshot = sanitizeSnapshot(snapshot)
      },
    }))
    .views((self) => ({
        trackMenuItems(): MenuItem[] {
          return [
            {
              type: 'checkbox',
              label: 'Metadata view',
              checked: self.metadataViewEnabled,
              onClick: () => {
                const next = !self.metadataViewEnabled
                self.setMetadataView(next)
                const session = getSession(self)
                if (!isSessionModelWithWidgets(session)) {
                  return
                }
                if (next) {
                  let trackLabel = 'Lorax'
                  try {
                    const track = getContainingTrack(self)
                    trackLabel =
                      (readConfObject(track.configuration, 'name') as string) ||
                      trackLabel
                  } catch {
                    // display not under a track yet
                  }
                  const widget = session.addWidget('LoraxMetadataWidget', LORAX_METADATA_WIDGET_ID, {
                    trackLabel,
                    snapshot: self.loadResultSnapshot,
                  })
                  session.showWidget(widget)
                } else {
                  const w = session.widgets.get(LORAX_METADATA_WIDGET_ID)
                  if (w) {
                    session.hideWidget(w)
                  }
                }
              },
            },
          ]
        },
      }))
}

export type LoraxDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LoraxDisplayModel = Instance<LoraxDisplayStateModel>