import { types, Instance } from '@jbrowse/mobx-state-tree'
import {
  ConfigurationReference,
  AnyConfigurationSchemaType,
  readConfObject,
} from '@jbrowse/core/configuration'
import { createJBrowseTheme, type MenuItem } from '@jbrowse/core/ui'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import {
  getContainingTrack,
  getContainingView,
  getSession,
} from '@jbrowse/core/util'
import {
  TrackHeightMixin,
  type ExportSvgDisplayOptions,
} from '@jbrowse/plugin-linear-genome-view'

import React from 'react'
import SettingsIcon from '@mui/icons-material/Settings'

/** Stable drawer widget instance id (see LoraxMetadataWidget). */
export const LORAX_METADATA_WIDGET_ID = 'loraxMetadata'

export interface LoraxSvgExportResult {
  svg: string
  x?: number
  y?: number
}

export type LoraxSvgExportProvider = (
  opts: ExportSvgDisplayOptions,
) => Promise<LoraxSvgExportResult | null | undefined>

interface LoraxRenderSvgSelf {
  height: number
  svgExportProvider?: LoraxSvgExportProvider
}

interface WidgetSession {
  addWidget: (...args: unknown[]) => unknown
  showWidget: (widget: unknown) => void
  hideWidget: (widget: unknown) => void
  widgets: {
    get: (id: string) => unknown
  }
}

function isWidgetSession(session: unknown): session is WidgetSession {
  const candidate = session as Partial<WidgetSession> | null | undefined
  return Boolean(
    candidate &&
      typeof candidate.addWidget === 'function' &&
      typeof candidate.showWidget === 'function' &&
      typeof candidate.hideWidget === 'function' &&
      candidate.widgets &&
      typeof candidate.widgets.get === 'function',
  )
}

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
  const { sid: _sid, intervals, mutations, ...configRest } = config
  const metadataSchema = config.metadata_schema
  return {
    ...rest,
    config: {
      ...configRest,
      metadata_schema: metadataSchema,
      intervals_count: Array.isArray(intervals) ? intervals.length : undefined,
      mutations_count: Array.isArray(mutations) ? mutations.length : undefined,
      metadata_schema_keys:
        metadataSchema && typeof metadataSchema === 'object'
          ? Object.keys(metadataSchema as Record<string, unknown>).length
          : undefined,
    },
  }
}

export function renderFallbackSvg(
  self: { height: number },
  opts: ExportSvgDisplayOptions,
  message = 'Lorax view is not ready for export.',
) {
  const view = getContainingView(self as never)
  const { width } = view
  const height = opts.overrideHeight ?? self.height
  const theme = createJBrowseTheme(opts.theme)
  const pad = 8
  const labelY = Math.min(height - pad, pad + 14)
  return (
    <g>
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill={theme.palette.background.default}
        stroke={theme.palette.divider}
        strokeWidth={1}
      />
      <text
        x={pad}
        y={labelY}
        fill={theme.palette.text.secondary}
        fontSize={12}
      >
        {message}
      </text>
    </g>
  )
}

export async function renderLoraxDisplaySvg(
  self: LoraxRenderSvgSelf,
  opts: ExportSvgDisplayOptions,
): Promise<JSX.Element> {
  const provider = self.svgExportProvider
  if (!provider) {
    return renderFallbackSvg(self, opts)
  }

  try {
    const result = await provider(opts)
    if (!result?.svg) {
      return renderFallbackSvg(self, opts)
    }
    return (
      <g
        transform={`translate(${result.x ?? 0} ${result.y ?? 0})`}
        dangerouslySetInnerHTML={{ __html: result.svg }}
      />
    )
  } catch (error) {
    console.error('[LoraxPlugin] SVG export failed', error)
    return renderFallbackSvg(self, opts)
  }
}

export default function stateModelFactory(
  configSchema: AnyConfigurationSchemaType,
) {
  const model = types.compose(
    'LoraxDisplay',
    BaseDisplay,
    TrackHeightMixin(),
    types.model({
      type: types.literal('LoraxDisplay'),
      configuration: ConfigurationReference(configSchema),
      fileInfoDialogOpen: types.optional(types.boolean, false),
      settingsDialogOpen: types.optional(types.boolean, false),
      metadataViewEnabled: types.optional(types.boolean, false),
      compareTopologiesEnabled: types.optional(types.boolean, false),
      /** Serializable snapshot of last load_file result for the metadata drawer. */
      loadResultSnapshot: types.optional(types.frozen(), null),
    }),
  )

  return model
    .volatile(() => ({
      svgExportProvider: undefined as LoraxSvgExportProvider | undefined,
    }))
    .actions(self => ({
      setSvgExportProvider(provider: LoraxSvgExportProvider | undefined) {
        self.svgExportProvider = provider
      },
      setMetadataView(value: boolean) {
        self.metadataViewEnabled = value
      },
      setCompareTopologiesEnabled(value: boolean) {
        self.compareTopologiesEnabled = value
      },
      setFileInfoDialogOpen(value: boolean) {
        self.fileInfoDialogOpen = value
      },
      openFileInfoDialog() {
        self.fileInfoDialogOpen = true
      },
      closeFileInfoDialog() {
        self.fileInfoDialogOpen = false
      },
      openSettingsDialog() {
        self.settingsDialogOpen = true
      },
      closeSettingsDialog() {
        self.settingsDialogOpen = false
      },
      setLoadResultSnapshot(snapshot: unknown) {
        self.loadResultSnapshot = sanitizeSnapshot(snapshot)
      },
      async renderSvg(opts: ExportSvgDisplayOptions): Promise<JSX.Element> {
        return renderLoraxDisplaySvg(self, opts)
      },
    }))
    .views(self => ({
      trackMenuItems(): MenuItem[] {
        return [
          {
            label: 'File Info',
            onClick: () => {
              self.openFileInfoDialog()
            },
          },
          {
            type: 'checkbox',
            label: 'Compare topologies',
            checked: self.compareTopologiesEnabled,
            onClick: () => {
              self.setCompareTopologiesEnabled(!self.compareTopologiesEnabled)
            },
          },
          {
            type: 'checkbox',
            label: 'Metadata view',
            checked: self.metadataViewEnabled,
            onClick: () => {
              const next = !self.metadataViewEnabled
              self.setMetadataView(next)
              const session = getSession(self)
              if (!isWidgetSession(session)) {
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
                const widget = session.addWidget(
                  'LoraxMetadataWidget',
                  LORAX_METADATA_WIDGET_ID,
                  {
                    trackLabel,
                    snapshot: self.loadResultSnapshot,
                  },
                )
                session.showWidget(widget)
              } else {
                const w = session.widgets.get(LORAX_METADATA_WIDGET_ID)
                if (w) {
                  session.hideWidget(w)
                }
              }
            },
          },
          { type: 'divider' },
          {
            label: 'Settings',
            icon: SettingsIcon,
            onClick: () => {
              self.openSettingsDialog()
            },
          },
        ]
      },
    }))
    .preProcessSnapshot(snap => {
      if (!snap || typeof snap !== 'object' || Array.isArray(snap)) {
        return snap
      }
      const snapshot = snap as unknown as Record<string, unknown>
      const { blockState: _blockState, height, ...rest } = snapshot
      const next =
        height === undefined ? rest : { ...rest, heightPreConfig: height }
      return next as unknown as typeof snap
    })
    .postProcessSnapshot(snap => {
      const { blockState: _blockState, ...rest } = snap as unknown as Record<
        string,
        unknown
      >
      return rest as unknown as typeof snap
    })
}

export type LoraxDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LoraxDisplayModel = Instance<LoraxDisplayStateModel>
