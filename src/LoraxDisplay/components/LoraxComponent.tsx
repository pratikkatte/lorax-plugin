import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import '@luma.gl/webgl'
import {
  getContainingTrack,
  getContainingView,
  getEnv,
  getSession,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import { observer } from 'mobx-react'
import { readConfObject } from '@jbrowse/core/configuration'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { LoraxDeckGL, LoraxProvider, useLorax } from '@lorax/core'
import {
  buildDetailsRequestForPick,
  type SelectionDetail,
} from '../detailsRequest'
import { LORAX_METADATA_WIDGET_ID, LoraxDisplayModel } from '../model'
import { metadataFeatureActions } from '../../LoraxMetadataWidget/metadataFeatureActions'
import type { MetadataFeature } from '../../LoraxMetadataWidget/metadataFeatureConfig'
import { metadataFeatureConfig } from '../../LoraxMetadataWidget/metadataFeatureConfig'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

function hasLoadFile(
  adapter: unknown,
): adapter is { loadFile: () => Promise<unknown> } {
  return Boolean(
    adapter &&
      typeof (adapter as { loadFile?: unknown }).loadFile === 'function',
  )
}

function resolveApiBaseFromConfig(adapterConfig: unknown) {
  const configured = adapterConfig
    ? (readConfObject(
        adapterConfig as Parameters<typeof readConfObject>[0],
        'apiBase',
      ) as string)
    : undefined
  if (configured) {
    return configured
  }

  const { protocol, hostname, port, origin } = window.location
  const isLocalhostHost =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0'
  if (isLocalhostHost && port !== '8080') {
    return `${protocol}//${hostname}:8080`
  }

  return origin
}

type LoadFileResult = {
  config?: {
    initial_position?: [number, number]
    project?: string
    sid?: string
  }
  /** Lorax session ID from adapter - used for session unification with LoraxProvider */
  loraxSid?: string
}

function sanitizeConfigForPersistence(config: LoadFileResult['config']) {
  if (!config || typeof config !== 'object') {
    return undefined
  }
  const {
    sid: _sid,
    intervals,
    mutations,
    metadata_schema,
    ...rest
  } = config as Record<string, unknown>
  return {
    ...rest,
    intervals_count: Array.isArray(intervals) ? intervals.length : undefined,
    mutations_count: Array.isArray(mutations) ? mutations.length : undefined,
    metadata_schema_keys:
      metadata_schema && typeof metadata_schema === 'object'
        ? Object.keys(metadata_schema as Record<string, unknown>).length
        : undefined,
  }
}

function serializeLoadSnapshotForDrawer(
  result: LoadFileResult | null,
): unknown {
  if (!result) {
    return null
  }
  try {
    return JSON.parse(
      JSON.stringify({
        config: sanitizeConfigForPersistence(result.config),
      }),
    )
  } catch {
    return null
  }
}

type OffsetPercent = {
  leftOffsetPercent: number
  rightOffsetPercent: number
  widthPercent: number
  isOffFlowLeft: boolean
  isOffFlowRight: boolean
  isOffFlow: boolean
}

type HoverTooltipRow = { k: string; v: string | number | null | undefined }
type HoverTooltipState = {
  kind: 'tip' | 'edge'
  title: string
  rows: HoverTooltipRow[]
  x: number
  y: number
}

type DetailsState = {
  selectedDetail: SelectionDetail
  data: unknown
  loading: boolean
  error: string | null
  treeIndex?: number
}

type MetadataWidgetModel = {
  id: string
  setSnapshot?: (snapshot: unknown) => void
  setSelectedDetail?: (detail: unknown) => void
  setDetailsState?: (detailsState: unknown) => void
  setFilterState?: (filterState: unknown) => void
  setFilterController?: (filterController: unknown) => void
  setActiveTab?: (activeTab: number) => void
}

type DeckPickInfo = { x?: number; y?: number; object?: unknown }
type DeckPickEvent = { srcEvent?: MouseEvent | PointerEvent | TouchEvent }
type DeckRef = {
  viewAdjustY?: () => boolean
  setGenomicCoords?: (coords: [number, number]) => void
}

const FILTER_TAB_INDEX = 2
const PRESET_FEATURE_PARAM = 'presetfeature'

/** Screen coords for `position: fixed` — deck `info.x/y` are canvas-relative, not client. */
function getClientCoordsForTooltip(
  info: DeckPickInfo,
  event: DeckPickEvent,
  trackRoot: HTMLElement | null,
): { x: number; y: number } | null {
  const src = event?.srcEvent
  // if (src && 'clientX' in src && 'clientY' in src) {
  //   const cx = src.clientX
  //   const cy = src.clientY
  //   if (Number.isFinite(cx) && Number.isFinite(cy)) {
  //     return { x: cx, y: cy }
  //   }
  // }
  const ix = info?.x
  const iy = info?.y
  if (ix && iy) {
    return { x: ix, y: iy }
  }
  return null
}

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? [
        Number.parseInt(result[1], 16),
        Number.parseInt(result[2], 16),
        Number.parseInt(result[3], 16),
      ]
    : [150, 150, 150]
}

function normalizeColor(color: unknown): number[] | null {
  if (Array.isArray(color)) {
    const r = Number(color[0])
    const g = Number(color[1])
    const b = Number(color[2])
    const a = color.length > 3 ? Number(color[3]) : 255
    if ([r, g, b, a].every(val => Number.isFinite(val))) {
      return [r, g, b, a]
    }
    return null
  }
  if (typeof color === 'string' && /^#?([a-fA-F0-9]{6})$/.test(color)) {
    const rgb = hexToRgb(color)
    return [rgb[0], rgb[1], rgb[2], 255]
  }
  return null
}

function getPresetFeatureIdFromURL() {
  if (typeof window === 'undefined') {
    return null
  }
  return new URLSearchParams(window.location.search).get(PRESET_FEATURE_PARAM)
}

function updatePresetInURL(featureId: string | null) {
  if (typeof window === 'undefined') {
    return
  }
  const next = new URLSearchParams(window.location.search)
  if (featureId) {
    next.set(PRESET_FEATURE_PARAM, featureId)
  } else {
    next.delete(PRESET_FEATURE_PARAM)
  }
  const search = next.toString()
  const url = `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`
  window.history.replaceState(window.history.state, '', url)
}

function loadedMetadataToObject(value: unknown): Record<string, unknown> {
  if (value instanceof Map) {
    return Object.fromEntries(value.entries())
  }
  return {}
}

function LoraxDeckContainer({
  deckRef,
  loadResult,
  height,
  viewConfig,
  intervalCoords,
  offsetPercent,
  treeColors,
  colorByTree,
  hoveredTreeIndex,
  highlightedMutationNode,
  highlightedMutationTreeIndex,
  onTipHover,
  onEdgeHover,
  onTreeLoadingChange,
  onVisibleTreesChange,
  onSelectionUpdate,
}: {
  deckRef: React.RefObject<DeckRef>
  loadResult: LoadFileResult | null
  height: number
  viewConfig: Record<string, any>
  intervalCoords: [number, number] | null
  offsetPercent: OffsetPercent
  treeColors: Record<string, string>
  colorByTree: boolean
  hoveredTreeIndex: number | null
  highlightedMutationNode: string | null
  highlightedMutationTreeIndex: string | number | null
  onTipHover: (tip: unknown, info: DeckPickInfo, event: DeckPickEvent) => void
  onEdgeHover: (edge: unknown, info: DeckPickInfo, event: DeckPickEvent) => void
  onTreeLoadingChange: (loading: boolean) => void
  onVisibleTreesChange: (trees: number[]) => void
  onSelectionUpdate: (
    detail: SelectionDetail,
    detailsState: DetailsState,
  ) => void
}) {
  const { handleConfigUpdate, isConnected, statusMessage, queryDetails } =
    useLorax()
  const detailsRequestRef = useRef(0)

  useEffect(() => {
    const config = loadResult?.config
    if (!config) {
      return
    }
    handleConfigUpdate(
      config,
      config.initial_position ?? null,
      config.project ?? null,
      config.sid ?? null,
    )
  }, [loadResult, handleConfigUpdate])
  const statusText =
    statusMessage && typeof statusMessage === 'object'
      ? String(
          (statusMessage as { message?: string }).message ??
            (statusMessage as { status?: string }).status ??
            '',
        )
      : ''

  const showConnectingOverlay = !isConnected

  const requestSelectionDetails = useCallback(
    async (
      detail: SelectionDetail,
      payload: Record<string, unknown>,
      treeIndex?: number,
    ) => {
      const requestId = detailsRequestRef.current + 1
      detailsRequestRef.current = requestId
      onSelectionUpdate(detail, {
        selectedDetail: detail,
        data: null,
        loading: true,
        error: null,
        treeIndex,
      })

      try {
        const data = await queryDetails(payload)
        if (detailsRequestRef.current !== requestId) {
          return
        }
        if (data && typeof data === 'object' && 'error' in data) {
          throw new Error(String((data as { error?: unknown }).error))
        }
        onSelectionUpdate(detail, {
          selectedDetail: detail,
          data,
          loading: false,
          error: null,
          treeIndex,
        })
      } catch (error) {
        if (detailsRequestRef.current !== requestId) {
          return
        }
        const message = error instanceof Error ? error.message : String(error)
        onSelectionUpdate(detail, {
          selectedDetail: detail,
          data: null,
          loading: false,
          error: message,
          treeIndex,
        })
      }
    },
    [onSelectionUpdate, queryDetails],
  )

  const onTipClick = useCallback(
    (tip: unknown, _info: DeckPickInfo, _event: DeckPickEvent) => {
      const request = buildDetailsRequestForPick('tip', tip)
      if (!request) return
      void requestSelectionDetails(
        request.detail,
        request.payload,
        request.treeIndex,
      )
    },
    [requestSelectionDetails],
  )

  const onEdgeClick = useCallback(
    (edge: unknown, _info: DeckPickInfo, _event: DeckPickEvent) => {
      const request = buildDetailsRequestForPick('edge', edge)
      if (!request) return
      void requestSelectionDetails(
        request.detail,
        request.payload,
        request.treeIndex,
      )
    },
    [requestSelectionDetails],
  )

  return (
    <div
      style={{
        height,
        // width: '100%',
        left: `${offsetPercent.leftOffsetPercent}%`,
        // right: `${offsetPercent.rightOffsetPercent}%`,
        marginRight: `${offsetPercent.rightOffsetPercent}%`,
        position: 'relative',
      }}
    >
      <LoraxDeckGL
        ref={deckRef}
        viewConfig={viewConfig}
        showPolygons
        treeLayersEnabled={true}
        externalGenomicCoords={intervalCoords}
        externalGenomicCoordsRequired
        externalGenomicCoordsSync
        colorEdgesByTree={colorByTree}
        treeEdgeColors={treeColors}
        hoveredTreeIndex={hoveredTreeIndex}
        highlightedMutationNode={highlightedMutationNode}
        highlightedMutationTreeIndex={highlightedMutationTreeIndex}
        onTreeLoadingChange={onTreeLoadingChange}
        onVisibleTreesChange={onVisibleTreesChange}
        polygonOptions={{ treeColors }}
        onTipHover={onTipHover}
        onTipClick={onTipClick}
        onEdgeHover={onEdgeHover}
        onEdgeClick={onEdgeClick}
      />
      {showConnectingOverlay ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          <div
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              background: 'rgba(17, 24, 39, 0.78)',
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              textTransform: 'lowercase',
            }}
          >
            {statusText
              ? `connecting backend - ${statusText}`
              : 'connecting backend'}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function LoraxMetadataWidgetBridge({
  session,
  model,
  loadResult,
  view,
  deckRef,
  metadataWidgetRef,
  visibleTrees,
  treeColors,
  colorByTree,
  hoveredTreeIndex,
  treeIsLoading,
  setTreeColors,
  setColorByTree,
  setHoveredTreeIndex,
  setHighlightedMutationNode,
  setHighlightedMutationTreeIndex,
  waitForTreeLoad,
}: {
  session: any
  model: LoraxDisplayModel
  loadResult: LoadFileResult | null
  view: LinearGenomeViewModel
  deckRef: React.RefObject<DeckRef>
  metadataWidgetRef: React.MutableRefObject<MetadataWidgetModel | null>
  visibleTrees: number[]
  treeColors: Record<string, string>
  colorByTree: boolean
  hoveredTreeIndex: number | null
  treeIsLoading: boolean
  setTreeColors: React.Dispatch<React.SetStateAction<Record<string, string>>>
  setColorByTree: React.Dispatch<React.SetStateAction<boolean>>
  setHoveredTreeIndex: React.Dispatch<React.SetStateAction<number | null>>
  setHighlightedMutationNode: React.Dispatch<
    React.SetStateAction<string | null>
  >
  setHighlightedMutationTreeIndex: React.Dispatch<
    React.SetStateAction<string | number | null>
  >
  waitForTreeLoad: () => Promise<void>
}) {
  const {
    tsconfig,
    searchTerm = '',
    setSearchTerm,
    searchTags = [],
    setSearchTags,
    selectedColorBy = null,
    setSelectedColorBy,
    coloryby = {},
    metadataColors = {},
    setMetadataColors,
    loadedMetadata,
    enabledValues = new Set(),
    setEnabledValues,
    highlightedMetadataValue = null,
    setHighlightedMetadataValue,
    displayLineagePaths = false,
    setDisplayLineagePaths,
  } = useLorax()

  const [activeFeatureId, setActiveFeatureId] = useState<string | null>(null)
  const [pendingFeature, setPendingFeature] = useState<MetadataFeature | null>(
    null,
  )
  const [pendingPreset, setPendingPreset] = useState<MetadataFeature | null>(
    null,
  )
  const lastPresetFeatureIdRef = useRef<string | null>(null)

  const matchedFeatures = useMemo(() => {
    const project = tsconfig?.project
    const filename = tsconfig?.filename
    if (!project || !filename) {
      return []
    }
    return metadataFeatureConfig.filter(
      feature => feature.project === project && feature.filename === filename,
    )
  }, [tsconfig?.project, tsconfig?.filename])

  const isMetadataReady = useCallback(
    (key?: string) => {
      if (!key) return false
      return loadedMetadata?.get?.(key) === 'pyarrow'
    },
    [loadedMetadata],
  )

  const applyFeatureColors = useCallback(
    (feature: MetadataFeature) => {
      const key = feature.metadata?.key
      const colorOverrides = feature.metadata?.colors
      if (!key || !colorOverrides || !setMetadataColors) {
        return
      }
      const normalized: Record<string, number[]> = {}
      Object.entries(colorOverrides).forEach(([value, color]) => {
        const nextColor = normalizeColor(color)
        if (nextColor) {
          normalized[String(value)] = nextColor
        }
      })
      if (Object.keys(normalized).length === 0) {
        return
      }
      setMetadataColors((prev: Record<string, Record<string, number[]>>) => ({
        ...(prev || {}),
        [key]: {
          ...(prev?.[key] || {}),
          ...normalized,
        },
      }))
    },
    [setMetadataColors],
  )

  useEffect(() => {
    if (!pendingFeature) return
    const key = pendingFeature.metadata?.key
    if (!key) {
      setPendingFeature(null)
      return
    }
    if (!isMetadataReady(key)) return
    applyFeatureColors(pendingFeature)
    setPendingFeature(null)
  }, [applyFeatureColors, isMetadataReady, pendingFeature])

  const navigateToCoords = useCallback(
    async (coords?: [number, number]) => {
      if (!Array.isArray(coords) || coords.length !== 2) return
      const start = Number(coords[0])
      const end = Number(coords[1])
      if (!Number.isFinite(start) || !Number.isFinite(end)) return

      const nextCoords: [number, number] = [start, end]
      const refName = view?.dynamicBlocks?.contentBlocks?.[0]?.refName
      if (refName && typeof view?.navTo === 'function') {
        view.navTo({ refName, start, end })
      }
      deckRef.current?.setGenomicCoords?.(nextCoords)
      await waitForTreeLoad()
    },
    [deckRef, view, waitForTreeLoad],
  )

  const applyPresetValues = useCallback(
    async (feature: MetadataFeature) => {
      const key = feature.metadata?.key
      const values = Array.isArray(feature.metadata?.values)
        ? feature.metadata.values.map(String)
        : []

      await navigateToCoords(feature.genomicCoords)

      const firstMutation = Array.isArray(feature.mutation)
        ? feature.mutation[0]
        : null
      if (firstMutation) {
        const nodeId =
          firstMutation.nodeId ?? firstMutation.nodeid ?? firstMutation.node_id
        if (nodeId !== null && nodeId !== undefined && nodeId !== '') {
          setHighlightedMutationNode(String(nodeId))
          const treeIndex =
            firstMutation.treeIndex ??
            firstMutation.treeindx ??
            firstMutation.tree_idx ??
            null
          setHighlightedMutationTreeIndex(
            treeIndex === '' ? null : (treeIndex as string | number | null),
          )
        }
      }

      setSearchTags?.(values)
      setEnabledValues?.(new Set(values))
      if (feature.displayLineage) {
        setDisplayLineagePaths?.(true)
      }
      if (feature.metadata?.colors) {
        if (isMetadataReady(key)) {
          applyFeatureColors(feature)
        } else {
          setPendingFeature(feature)
        }
      }
      if (Array.isArray(feature.actions)) {
        feature.actions.forEach(action => {
          const handler =
            metadataFeatureActions[
              action as keyof typeof metadataFeatureActions
            ]
          if (typeof handler === 'function') {
            handler({ deckRef })
          }
        })
      }
    },
    [
      applyFeatureColors,
      deckRef,
      isMetadataReady,
      navigateToCoords,
      setDisplayLineagePaths,
      setEnabledValues,
      setHighlightedMutationNode,
      setHighlightedMutationTreeIndex,
      setSearchTags,
    ],
  )

  const applyFeature = useCallback(
    (feature: MetadataFeature, options: { syncUrl?: boolean } = {}) => {
      if (!feature.id) return
      setActiveFeatureId(feature.id)
      if (options.syncUrl !== false) {
        updatePresetInURL(feature.id)
      }

      const key = feature.metadata?.key
      if (key && setSelectedColorBy && selectedColorBy !== key) {
        setSelectedColorBy(key)
        setPendingPreset(feature)
        return
      }
      void applyPresetValues(feature)
    },
    [applyPresetValues, selectedColorBy, setSelectedColorBy],
  )

  useEffect(() => {
    if (!pendingPreset) return
    const key = pendingPreset.metadata?.key
    if (key && selectedColorBy !== key) return
    void applyPresetValues(pendingPreset)
    setPendingPreset(null)
  }, [applyPresetValues, pendingPreset, selectedColorBy])

  const disableFeature = useCallback(() => {
    setActiveFeatureId(null)
    setPendingFeature(null)
    setPendingPreset(null)
    updatePresetInURL(null)
    setSearchTags?.([])
    if (selectedColorBy && metadataColors?.[selectedColorBy]) {
      setEnabledValues?.(new Set(Object.keys(metadataColors[selectedColorBy])))
    }
  }, [metadataColors, selectedColorBy, setEnabledValues, setSearchTags])

  const filterState = useMemo(
    () => ({
      tsconfig: {
        project: tsconfig?.project ?? null,
        filename: tsconfig?.filename ?? null,
        tree_info: Boolean(tsconfig?.tree_info),
      },
      searchTerm,
      searchTags,
      selectedColorBy,
      coloryby,
      metadataColors: metadataColors || {},
      loadedMetadata: loadedMetadataToObject(loadedMetadata),
      enabledValues: Array.from(enabledValues || []).map(String),
      highlightedMetadataValue,
      displayLineagePaths,
      visibleTrees,
      treeColors,
      colorByTree,
      hoveredTreeIndex,
      treeIsLoading,
      activeFeatureId,
    }),
    [
      activeFeatureId,
      colorByTree,
      coloryby,
      displayLineagePaths,
      enabledValues,
      highlightedMetadataValue,
      hoveredTreeIndex,
      loadedMetadata,
      metadataColors,
      searchTags,
      searchTerm,
      selectedColorBy,
      treeColors,
      treeIsLoading,
      tsconfig?.filename,
      tsconfig?.project,
      tsconfig?.tree_info,
      visibleTrees,
    ],
  )

  const controller = useMemo(
    () => ({
      setSearchTerm: (value: string) => setSearchTerm?.(value),
      setSearchTags: (values: string[]) => setSearchTags?.(values),
      addSearchTag: (value: string) => {
        if (!value) return
        setSearchTags?.((prev: string[]) =>
          prev.includes(value) ? prev : [...prev, value],
        )
      },
      removeSearchTag: (index: number) => {
        setSearchTags?.((prev: string[]) => prev.filter((_, i) => i !== index))
      },
      setSelectedColorBy: (key: string) => setSelectedColorBy?.(key),
      setEnabledValues: (values: string[]) =>
        setEnabledValues?.(new Set(values)),
      toggleEnabledValue: (value: string) => {
        setEnabledValues?.((prev: Set<string>) => {
          const next = new Set(prev)
          if (next.has(value)) {
            next.delete(value)
            setSearchTags?.((tags: string[]) =>
              tags.filter(tag => tag !== value),
            )
          } else {
            next.add(value)
          }
          return next
        })
      },
      setMetadataColor: (key: string, value: string, color: number[]) => {
        setMetadataColors?.(
          (prev: Record<string, Record<string, number[]>>) => ({
            ...(prev || {}),
            [key]: {
              ...(prev?.[key] || {}),
              [value]: color,
            },
          }),
        )
      },
      toggleHighlightedValue: (value: string) => {
        setHighlightedMetadataValue?.((prev: string | null) =>
          prev === value ? null : value,
        )
      },
      setDisplayLineagePaths: (value: boolean) =>
        setDisplayLineagePaths?.(value),
      setTreeColor: (treeIndex: number, color: string) => {
        setTreeColors(prev => ({ ...prev, [String(treeIndex)]: color }))
      },
      clearTreeColor: (treeIndex: number) => {
        setTreeColors(prev => {
          const next = { ...prev }
          delete next[String(treeIndex)]
          return next
        })
      },
      setHoveredTreeIndex,
      setColorByTree,
      applyPresetFeature: (feature: MetadataFeature) => applyFeature(feature),
      disablePresetFeature: () => disableFeature(),
    }),
    [
      applyFeature,
      disableFeature,
      setColorByTree,
      setDisplayLineagePaths,
      setEnabledValues,
      setHighlightedMetadataValue,
      setMetadataColors,
      setHoveredTreeIndex,
      setSearchTags,
      setSearchTerm,
      setSelectedColorBy,
      setTreeColors,
    ],
  )

  const ensureFilterWidget = useCallback(() => {
    if (!isSessionModelWithWidgets(session)) {
      return
    }
    const snapshot = serializeLoadSnapshotForDrawer(loadResult)
    let trackLabel = 'Lorax'
    try {
      const track = getContainingTrack(model)
      trackLabel =
        (readConfObject(track.configuration, 'name') as string) || trackLabel
    } catch {
      // display may not be mounted under a track yet
    }
    const existingWidget = session.widgets.get(LORAX_METADATA_WIDGET_ID) as
      | MetadataWidgetModel
      | undefined
    const widget =
      existingWidget ??
      (session.addWidget('LoraxMetadataWidget', LORAX_METADATA_WIDGET_ID, {
        trackLabel,
        snapshot,
        filterState,
        activeTab: FILTER_TAB_INDEX,
      }) as MetadataWidgetModel)
    widget.setSnapshot?.(snapshot)
    widget.setFilterState?.(filterState)
    widget.setFilterController?.(controller)
    widget.setActiveTab?.(FILTER_TAB_INDEX)
    metadataWidgetRef.current = widget
    session.showWidget(widget)
    model.setMetadataView(true)
  }, [controller, filterState, loadResult, metadataWidgetRef, model, session])

  useEffect(() => {
    const widget = session?.widgets?.get?.(LORAX_METADATA_WIDGET_ID) as
      | MetadataWidgetModel
      | undefined
    const existing = widget ?? metadataWidgetRef.current
    if (!existing) {
      return
    }
    existing.setFilterState?.(filterState)
    existing.setFilterController?.(controller)
    metadataWidgetRef.current = existing
  }, [controller, filterState, metadataWidgetRef, session])

  useEffect(() => {
    const currentId = getPresetFeatureIdFromURL()
    if (!currentId) {
      lastPresetFeatureIdRef.current = null
      return
    }
    if (lastPresetFeatureIdRef.current === currentId) return
    const feature = matchedFeatures.find(item => item.id === currentId)
    if (!feature) return
    lastPresetFeatureIdRef.current = currentId
    ensureFilterWidget()
    applyFeature(feature, { syncUrl: false })
  }, [applyFeature, ensureFilterWidget, matchedFeatures])

  return null
}

const LoraxComponent = observer(function LoraxComponent({
  model,
}: {
  model: LoraxDisplayModel
}) {
  const view = getContainingView(model) as LinearGenomeViewModel
  const { height } = model
  const adapterConfig = model.adapterConfig
  const session = getSession(model)
  const trackContainerRef = useRef<HTMLDivElement>(null)

  const [loadResult, setLoadResult] = useState<LoadFileResult | null>(null)
  const [loadError, setLoadError] = useState<Error | null>(null)
  const [trackHeight, setTrackHeight] = useState(height)
  const [hoverTooltip, setHoverTooltip] = useState<HoverTooltipState | null>(
    null,
  )
  const deckRef = useRef<DeckRef>(null)
  const [visibleTrees, setVisibleTrees] = useState<number[]>([])
  const [treeColors, setTreeColors] = useState<Record<string, string>>({})
  const [colorByTree, setColorByTree] = useState(false)
  const [hoveredTreeIndex, setHoveredTreeIndex] = useState<number | null>(null)
  const [treeIsLoading, setTreeIsLoading] = useState(false)
  const treeIsLoadingRef = useRef(false)
  const presetLoadResolversRef = useRef<Array<() => void>>([])
  const presetLoadTimeoutRef = useRef<number | null>(null)
  const [highlightedMutationNode, setHighlightedMutationNode] = useState<
    string | null
  >(null)
  const [highlightedMutationTreeIndex, setHighlightedMutationTreeIndex] =
    useState<string | number | null>(null)

  const clearHoverTooltip = useCallback(() => setHoverTooltip(null), [])
  const metadataWidgetRef = useRef<MetadataWidgetModel | null>(null)

  const handleTreeLoadingChange = useCallback((loading: boolean) => {
    setTreeIsLoading(loading)
    treeIsLoadingRef.current = loading
    if (!loading) {
      if (presetLoadTimeoutRef.current !== null) {
        window.clearTimeout(presetLoadTimeoutRef.current)
        presetLoadTimeoutRef.current = null
      }
      presetLoadResolversRef.current.splice(0).forEach(resolve => resolve())
    }
  }, [])

  const waitForTreeLoad = useCallback(() => {
    return new Promise<void>(resolve => {
      if (presetLoadTimeoutRef.current !== null) {
        window.clearTimeout(presetLoadTimeoutRef.current)
      }
      presetLoadTimeoutRef.current = window.setTimeout(() => {
        presetLoadTimeoutRef.current = null
        presetLoadResolversRef.current.splice(0).forEach(done => done())
        resolve()
      }, 1500)
      if (!treeIsLoadingRef.current) {
        window.setTimeout(() => {
          if (!treeIsLoadingRef.current) {
            if (presetLoadTimeoutRef.current !== null) {
              window.clearTimeout(presetLoadTimeoutRef.current)
              presetLoadTimeoutRef.current = null
            }
            resolve()
            return
          }
          presetLoadResolversRef.current.push(resolve)
        }, 0)
        return
      }
      presetLoadResolversRef.current.push(resolve)
    })
  }, [])

  useEffect(
    () => () => {
      if (presetLoadTimeoutRef.current !== null) {
        window.clearTimeout(presetLoadTimeoutRef.current)
      }
      presetLoadResolversRef.current.splice(0).forEach(resolve => resolve())
    },
    [],
  )

  const setTooltipFromEvent = useCallback(
    (
      base: Omit<HoverTooltipState, 'x' | 'y'>,
      info: DeckPickInfo,
      event: DeckPickEvent,
    ) => {
      const xy = getClientCoordsForTooltip(
        info,
        event,
        trackContainerRef.current,
      )
      if (!xy) return
      setHoverTooltip({ ...base, x: xy.x, y: xy.y })
    },
    [],
  )

  const onTipHover = useCallback(
    (tip: unknown, info: DeckPickInfo, event: DeckPickEvent) => {
      if (!tip) {
        clearHoverTooltip()
        return
      }
      const t = tip as { tree_idx?: number; node_id?: number }
      setTooltipFromEvent(
        {
          kind: 'tip',
          title: 'Tip',
          rows: [
            { k: 'Tree', v: t.tree_idx },
            { k: 'Node ID', v: t.node_id },
          ],
        },
        info,
        event,
      )
    },
    [clearHoverTooltip, setTooltipFromEvent],
  )

  const onEdgeHover = useCallback(
    (edge: unknown, info: DeckPickInfo, event: DeckPickEvent) => {
      if (!edge) {
        clearHoverTooltip()
        return
      }
      const e = edge as {
        tree_idx?: number
        parent_id?: number
        child_id?: number
      }
      setTooltipFromEvent(
        {
          kind: 'edge',
          title: 'Edge',
          rows: [
            { k: 'Tree', v: e.tree_idx },
            { k: 'Parent', v: e.parent_id },
            { k: 'Child', v: e.child_id },
          ],
        },
        info,
        event,
      )
    },
    [clearHoverTooltip, setTooltipFromEvent],
  )

  const showMetadataWidgetForSelection = useCallback(
    (detail: SelectionDetail, detailsState: DetailsState) => {
      if (!isSessionModelWithWidgets(session)) {
        return
      }
      const snapshot = serializeLoadSnapshotForDrawer(loadResult)
      let trackLabel = 'Lorax'
      try {
        const track = getContainingTrack(model)
        trackLabel =
          (readConfObject(track.configuration, 'name') as string) || trackLabel
      } catch {
        // display may not be mounted under a track yet
      }
      const existingWidget = session.widgets.get(LORAX_METADATA_WIDGET_ID) as
        | MetadataWidgetModel
        | undefined
      const existing = metadataWidgetRef.current ?? existingWidget
      if (existing && existingWidget) {
        existing.setSnapshot?.(snapshot)
        existing.setSelectedDetail?.(detail)
        existing.setDetailsState?.(detailsState)
        metadataWidgetRef.current = existing
        session.showWidget(existingWidget)
      } else {
        const widget = session.addWidget(
          'LoraxMetadataWidget',
          LORAX_METADATA_WIDGET_ID,
          {
            trackLabel,
            snapshot,
            selectedDetail: detail,
            detailsState,
          },
        ) as MetadataWidgetModel
        metadataWidgetRef.current = widget
        session.showWidget(widget)
      }
      model.setMetadataView(true)
    },
    [session, loadResult, model],
  )

  const { offsetPx, width } = view as unknown as {
    offsetPx: number
    width: number
  }

  const bpToPx = useMemo(() => {
    const blocks = view?.dynamicBlocks?.contentBlocks
    return view?.bpToPx?.({
      refName: blocks?.[0]?.refName ?? '',
      coord: blocks?.[0]?.start ?? 0,
    })
  }, [view, offsetPx, width])

  const lastbpToPx = useMemo(() => {
    const blocks = view?.dynamicBlocks?.contentBlocks
    return view?.bpToPx?.({
      refName: blocks?.[blocks.length - 1]?.refName ?? '',
      coord: blocks?.[blocks.length - 1]?.end ?? 0,
    })
  }, [view, offsetPx, width])

  const offsetPercent = useMemo(() => {
    const bpToPxOffset = bpToPx?.offsetPx
    const lastbpToPxOffset = lastbpToPx?.offsetPx
    const screenPos = bpToPxOffset ? bpToPxOffset - offsetPx : 0
    const screenPosLeft = bpToPxOffset ? bpToPxOffset - offsetPx : 0
    const screenPosRight = lastbpToPxOffset ? lastbpToPxOffset - offsetPx : 0

    let leftOffsetPercent = 0
    let rightOffsetPercent = 0
    let widthPercent = 0
    let isOffFlowLeft = false
    let isOffFlowRight = false

    if (
      typeof offsetPx === 'number' &&
      typeof width === 'number' &&
      width > 0
    ) {
      isOffFlowLeft = screenPosLeft < 0
      isOffFlowRight = screenPosRight > 0

      if (offsetPx < 0) {
        leftOffsetPercent = (Math.abs(offsetPx) / width) * 100
      }
      if (isOffFlowRight) {
        const overflowPx = width - screenPosRight
        rightOffsetPercent = (overflowPx / width) * 100
      }
    }

    const isOffFlow = isOffFlowLeft || isOffFlowRight

    return {
      leftOffsetPercent,
      rightOffsetPercent,
      widthPercent,
      isOffFlowLeft,
      isOffFlowRight,
      isOffFlow,
    }
  }, [offsetPx, width, bpToPx])

  useEffect(() => {
    if (!adapterConfig) {
      console.log('[LoraxPlugin] adapter config not available')
      model.setLoadResultSnapshot(null)
      return
    }

    let cancelled = false

    const run = async () => {
      try {
        const { pluginManager } = getEnv(model)
        const { dataAdapter } = await getAdapter(
          pluginManager,
          session?.id || 'default',
          adapterConfig,
        )

        if (!hasLoadFile(dataAdapter)) {
          console.warn('[LoraxPlugin] adapter does not implement loadFile')
          model.setLoadResultSnapshot(null)
          return
        }

        const result = (await dataAdapter.loadFile()) as LoadFileResult
        if (cancelled) {
          return
        }
        setLoadResult(result)
        setLoadError(null)
        model.setLoadResultSnapshot(serializeLoadSnapshotForDrawer(result))
        console.log('[LoraxPlugin] load_file result', {
          hasConfig: !!result?.config,
          loraxSid: result?.loraxSid,
          intervalsCount: (result?.config as { intervals?: unknown[] })
            ?.intervals?.length,
        })
      } catch (error) {
        if (cancelled) {
          return
        }
        const err = error instanceof Error ? error : new Error(String(error))
        setLoadError(err)
        model.setLoadResultSnapshot(null)
        console.error('[LoraxPlugin] load_file error', err)
      }
    }

    run()

    return () => {
      cancelled = true
    }
  }, [adapterConfig, model])

  const apiBase = useMemo(() => {
    return resolveApiBaseFromConfig(adapterConfig)
  }, [adapterConfig])

  const isProd = useMemo(() => {
    if (!adapterConfig) return false
    return Boolean(readConfObject(adapterConfig, 'isProd'))
  }, [adapterConfig])

  const viewConfig = useMemo(
    () => ({
      ortho: { enabled: true, x: '0%', y: '5%', width: '100%', height: '95%' },
      genomeInfo: {
        enabled: true,
        x: '0%',
        y: '3%',
        width: '100%',
        height: '2%',
      },
      genomePositions: { enabled: false },

      treeTime: {
        enabled: true,
        x: '0.5%',
        y: '5%',
        width: '4%',
        height: '95%',
      },
    }),
    [],
  )

  const intervalCoords = useMemo(() => {
    const blocks = view?.dynamicBlocks?.contentBlocks
    if (!blocks || blocks.length === 0) return null
    let minStart = Infinity
    let maxEnd = -Infinity
    for (const block of blocks) {
      const start = Math.floor(block.start ?? 0)
      const end = Math.ceil(block.end ?? 0)
      if (start < minStart) minStart = start
      if (end > maxEnd) maxEnd = end
    }
    if (
      !Number.isFinite(minStart) ||
      !Number.isFinite(maxEnd) ||
      minStart >= maxEnd
    ) {
      return null
    }
    return [minStart, maxEnd] as [number, number]
  }, [view?.dynamicBlocks?.contentBlocks])

  useEffect(() => {
    if (!view?.dynamicBlocks?.contentBlocks) return
    console.log('[LoraxPlugin] dynamic blocks', {
      blocks: view.dynamicBlocks.contentBlocks.map(block => ({
        refName: block.refName,
        start: block.start,
        end: block.end,
      })),
      intervalCoords,
    })
  }, [view?.dynamicBlocks?.contentBlocks, intervalCoords])

  useEffect(() => {
    const element = trackContainerRef.current
    if (!element) {
      setTrackHeight(height)
      return
    }

    const updateTrackHeight = (nextHeight: number) => {
      setTrackHeight(nextHeight > 0 ? nextHeight : height)
    }

    updateTrackHeight(element.getBoundingClientRect().height)

    if (typeof ResizeObserver === 'undefined') {
      return
    }

    const resizeObserver = new ResizeObserver(entries => {
      updateTrackHeight(entries[0]?.contentRect.height ?? 0)
    })
    resizeObserver.observe(element)

    return () => {
      resizeObserver.disconnect()
    }
  }, [height])

  if (!view) {
    return null
  }

  if (loadError) {
    console.error('[LoraxPlugin] load_file error', loadError)
  }

  return (
    <div
      ref={trackContainerRef}
      style={{ height: '100%', position: 'relative' }}
      onMouseLeave={clearHoverTooltip}
    >
      <LoraxProvider
        apiBase={apiBase}
        isProd={isProd}
        enableConfig
        enableMetadataFilter
        rpcManager={session?.rpcManager}
        rpcSessionId={session?.id || 'default'}
        urlSyncEnabled={false}
        disableInlineWorkers
        sessionOverride={loadResult?.loraxSid}
      >
        <LoraxMetadataWidgetBridge
          session={session}
          model={model}
          loadResult={loadResult}
          view={view}
          deckRef={deckRef}
          metadataWidgetRef={metadataWidgetRef}
          visibleTrees={visibleTrees}
          treeColors={treeColors}
          colorByTree={colorByTree}
          hoveredTreeIndex={hoveredTreeIndex}
          treeIsLoading={treeIsLoading}
          setTreeColors={setTreeColors}
          setColorByTree={setColorByTree}
          setHoveredTreeIndex={setHoveredTreeIndex}
          setHighlightedMutationNode={setHighlightedMutationNode}
          setHighlightedMutationTreeIndex={setHighlightedMutationTreeIndex}
          waitForTreeLoad={waitForTreeLoad}
        />
        <LoraxDeckContainer
          deckRef={deckRef}
          loadResult={loadResult}
          height={trackHeight}
          viewConfig={viewConfig}
          intervalCoords={intervalCoords}
          offsetPercent={offsetPercent}
          treeColors={treeColors}
          colorByTree={colorByTree}
          hoveredTreeIndex={hoveredTreeIndex}
          highlightedMutationNode={highlightedMutationNode}
          highlightedMutationTreeIndex={highlightedMutationTreeIndex}
          onTreeLoadingChange={handleTreeLoadingChange}
          onVisibleTreesChange={trees => setVisibleTrees(trees || [])}
          onTipHover={onTipHover}
          onEdgeHover={onEdgeHover}
          onSelectionUpdate={showMetadataWidgetForSelection}
        />
      </LoraxProvider>
      {hoverTooltip &&
        Number.isFinite(hoverTooltip.x) &&
        Number.isFinite(hoverTooltip.y) && (
          <div
            style={{
              position: 'fixed',
              left: hoverTooltip.x + 12,
              top: hoverTooltip.y + 12,
              zIndex: 99999,
              pointerEvents: 'none',
              backgroundColor: '#fff',
              boxShadow:
                '0 4px 20px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)',
              borderRadius: 10,
              minWidth: 180,
              maxWidth: 320,
              border: '1px solid rgba(0,0,0,0.08)',
              overflow: 'hidden',
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}
          >
            <div
              style={{ padding: '10px 12px', fontSize: 13, color: '#374151' }}
            >
              {hoverTooltip.title && (
                <div
                  style={{ fontWeight: 700, color: '#111827', marginBottom: 6 }}
                >
                  {hoverTooltip.title}
                </div>
              )}
              {Array.isArray(hoverTooltip.rows) &&
                hoverTooltip.rows.map(row => (
                  <div
                    key={row.k}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '3px 0',
                      borderBottom: '1px solid #f3f4f6',
                    }}
                  >
                    <span style={{ color: '#6b7280', fontWeight: 500 }}>
                      {row.k}
                    </span>
                    <span
                      style={{
                        fontWeight: 600,
                        color: '#111827',
                        maxWidth: 180,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {String(row.v)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
    </div>
  )
})

export default LoraxComponent
