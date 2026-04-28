import React, { useEffect, useMemo, useState, type ReactNode } from 'react'

import SimpleField from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/SimpleField'
import { makeStyles } from 'tss-react/mui'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Divider,
  Paper,
  Tab,
  Tabs,
  Typography,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { observer } from 'mobx-react'

import {
  metadataFeatureConfig,
  type MetadataFeature,
} from '../metadataFeatureConfig'
import type { IStateTreeNode } from 'mobx-state-tree'

/** Widget state; extends MST node with fields this component reads. */
type LoraxMetadataWidgetModel = IStateTreeNode & {
  trackLabel?: string
  snapshot?: unknown
  selectedDetail?: unknown
  detailsState?: unknown
  filterState?: unknown
  filterController?: FilterController | null
  activeTab?: number
  setActiveTab?: (activeTab: number) => void
}

interface ParsedSnapshot {
  config?: Record<string, unknown>
}

interface ParsedSelectedDetail {
  kind?: string
  title?: string
  rows?: { k?: string; v?: unknown }[]
  raw?: unknown
}

interface ParsedDetailsState {
  selectedDetail?: ParsedSelectedDetail
  data?: Record<string, unknown> | null
  loading?: boolean
  error?: string | null
  treeIndex?: number
}

interface ParsedFilterState {
  tsconfig?: {
    project?: string | null
    filename?: string | null
    tree_info?: boolean
  }
  searchTerm: string
  searchTags: string[]
  selectedColorBy: string | null
  coloryby: Record<string, string>
  metadataColors: Record<string, Record<string, number[]>>
  loadedMetadata: Record<string, unknown>
  enabledValues: string[]
  highlightedMetadataValue: string | null
  displayLineagePaths: boolean
  visibleTrees: number[]
  treeColors: Record<string, string>
  colorByTree: boolean
  hoveredTreeIndex: number | null
  activeFeatureId: string | null
}

interface FilterController {
  setSearchTerm?: (value: string) => void
  setSearchTags?: (values: string[]) => void
  addSearchTag?: (value: string) => void
  removeSearchTag?: (index: number) => void
  setSelectedColorBy?: (key: string) => void
  setEnabledValues?: (values: string[]) => void
  toggleEnabledValue?: (value: string) => void
  setMetadataColor?: (key: string, value: string, color: number[]) => void
  toggleHighlightedValue?: (value: string) => void
  setDisplayLineagePaths?: (value: boolean) => void
  setTreeColor?: (treeIndex: number, color: string) => void
  clearTreeColor?: (treeIndex: number) => void
  setHoveredTreeIndex?: (treeIndex: number | null) => void
  setColorByTree?: (value: boolean) => void
  applyPresetFeature?: (feature: MetadataFeature) => void
  disablePresetFeature?: (feature: MetadataFeature) => void
}

const ITEMS_PER_PAGE = 100

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function parseSnapshot(raw: unknown): ParsedSnapshot | null {
  if (raw === null || raw === undefined) {
    return null
  }
  if (typeof raw !== 'object') {
    return null
  }
  const obj = raw as Record<string, unknown>
  const config = obj.config
  const configObj =
    config && typeof config === 'object' && !Array.isArray(config)
      ? (config as Record<string, unknown>)
      : undefined
  return { config: configObj }
}

function parseSelectedDetail(raw: unknown): ParsedSelectedDetail | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }
  return raw as ParsedSelectedDetail
}

function parseDetailsState(raw: unknown): ParsedDetailsState | null {
  if (!isRecord(raw)) {
    return null
  }
  const data = isRecord(raw.data) ? raw.data : null
  const selectedDetail = parseSelectedDetail(raw.selectedDetail)
  return {
    selectedDetail: selectedDetail ?? undefined,
    data,
    loading: raw.loading === true,
    error: typeof raw.error === 'string' ? raw.error : null,
    treeIndex: typeof raw.treeIndex === 'number' ? raw.treeIndex : undefined,
  }
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : []
}

function parseFilterState(raw: unknown): ParsedFilterState {
  const obj = isRecord(raw) ? raw : {}
  const tsconfig = isRecord(obj.tsconfig) ? obj.tsconfig : {}
  return {
    tsconfig: {
      project: typeof tsconfig.project === 'string' ? tsconfig.project : null,
      filename:
        typeof tsconfig.filename === 'string' ? tsconfig.filename : null,
      tree_info: tsconfig.tree_info === true,
    },
    searchTerm: typeof obj.searchTerm === 'string' ? obj.searchTerm : '',
    searchTags: asStringArray(obj.searchTags),
    selectedColorBy:
      typeof obj.selectedColorBy === 'string' ? obj.selectedColorBy : null,
    coloryby: isRecord(obj.coloryby)
      ? Object.fromEntries(
          Object.entries(obj.coloryby).map(([key, value]) => [
            key,
            String(value),
          ]),
        )
      : {},
    metadataColors: isRecord(obj.metadataColors)
      ? (obj.metadataColors as Record<string, Record<string, number[]>>)
      : {},
    loadedMetadata: isRecord(obj.loadedMetadata) ? obj.loadedMetadata : {},
    enabledValues: asStringArray(obj.enabledValues),
    highlightedMetadataValue:
      typeof obj.highlightedMetadataValue === 'string'
        ? obj.highlightedMetadataValue
        : null,
    displayLineagePaths: obj.displayLineagePaths === true,
    visibleTrees: Array.isArray(obj.visibleTrees)
      ? obj.visibleTrees.map(Number).filter(Number.isFinite)
      : [],
    treeColors: isRecord(obj.treeColors)
      ? Object.fromEntries(
          Object.entries(obj.treeColors).map(([key, value]) => [
            key,
            String(value),
          ]),
        )
      : {},
    colorByTree: obj.colorByTree === true,
    hoveredTreeIndex:
      typeof obj.hoveredTreeIndex === 'number' ? obj.hoveredTreeIndex : null,
    activeFeatureId:
      typeof obj.activeFeatureId === 'string' ? obj.activeFeatureId : null,
  }
}

function rgbaToHex(rgba: unknown) {
  if (!Array.isArray(rgba)) return '#969696'
  const [r, g, b] = rgba.map(Number)
  return `#${[r, g, b]
    .map(x =>
      Number.isFinite(x)
        ? Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0')
        : '96',
    )
    .join('')}`
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

function formatScalar(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined
  }
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value)
  }
  if (Array.isArray(value)) {
    return value
      .map(v => (typeof v === 'object' ? JSON.stringify(v) : String(v)))
      .join(', ')
  }
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function formatIntervalsSummary(
  config: Record<string, unknown>,
): string | undefined {
  const persistedCount = config.intervals_count
  if (typeof persistedCount === 'number' && persistedCount > 0) {
    return `${persistedCount} interval(s)`
  }
  const iv = config.intervals
  if (!Array.isArray(iv) || iv.length === 0) {
    return undefined
  }
  const first = iv[0]
  const last = iv[iv.length - 1]
  if (
    Array.isArray(first) &&
    first.length >= 2 &&
    Array.isArray(last) &&
    last.length >= 2
  ) {
    return `${iv.length} window(s); first [${first[0]}, ${first[1]}]`
  }
  return `${iv.length} interval(s)`
}

function getMutationsList(
  config: Record<string, unknown>,
): Record<string, unknown>[] {
  const m = config.mutations
  if (!Array.isArray(m)) {
    return []
  }
  return m.filter(
    (x): x is Record<string, unknown> => x !== null && typeof x === 'object',
  )
}

function formatMutationRow(m: Record<string, unknown>): string {
  const derived = m.derived_state ?? m.derivedState
  const inherited = m.inherited_state ?? m.inheritedState
  const pos = m.position
  const left = inherited != null ? String(inherited) : '?'
  const right = derived != null ? String(derived) : '?'
  const posStr = pos != null ? ` (Pos: ${formatScalar(pos) ?? '?'})` : ''
  return `${left} → ${right}${posStr}`
}

function getMutationSummary(
  config: Record<string, unknown>,
): string | undefined {
  const count = config.mutations_count
  if (typeof count === 'number') {
    return `${count} mutation(s) loaded`
  }
  return undefined
}

function formatLabel(key: string) {
  return key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')
}

function formatPosition(value: unknown) {
  const numeric = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numeric)
    ? String(Math.round(numeric))
    : formatScalar(value) ?? '—'
}

function formatInterval(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(item => formatScalar(item) ?? '—').join(', ')
  }
  return formatScalar(value)
}

function getRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null
}

function getRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter(isRecord)
}

const useStyles = makeStyles()(theme => ({
  paper: {
    margin: theme.spacing(2),
    padding: theme.spacing(2),
    paddingTop: theme.spacing(1),
  },
  trackTitle: {
    marginBottom: theme.spacing(1),
  },
  tabPanel: {
    paddingTop: theme.spacing(2),
  },
  sectionHeader: {
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(0.5),
    letterSpacing: 0.08 * 16,
  },
  pre: {
    marginTop: theme.spacing(1),
    padding: theme.spacing(2),
    overflow: 'auto',
    maxHeight: '55vh',
    fontFamily: 'monospace',
    fontSize: theme.typography.body2.fontSize,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    color: theme.palette.text.secondary,
    backgroundColor: theme.palette.action.hover,
    borderRadius: theme.shape.borderRadius,
  },
  accordionDetails: {
    padding: theme.spacing(1),
  },
  filterBox: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(1),
    marginBottom: theme.spacing(1.5),
  },
  filterRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  filterInput: {
    minHeight: 32,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(0.5, 1),
    font: 'inherit',
  },
  valueList: {
    maxHeight: 260,
    overflow: 'auto',
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
  },
  valueRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(0.5, 1),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  tag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    margin: theme.spacing(0, 0.5, 0.5, 0),
    padding: theme.spacing(0.25, 0.75),
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.palette.action.hover,
    fontSize: theme.typography.caption.fontSize,
  },
  linkButton: {
    border: 0,
    background: 'transparent',
    color: theme.palette.primary.main,
    cursor: 'pointer',
    font: 'inherit',
    padding: theme.spacing(0.25, 0.5),
  },
}))

function DetailSection(props: { title: string; children: ReactNode }) {
  const { title, children } = props
  const { classes } = useStyles()
  return (
    <Box sx={{ mb: 2 }}>
      <Typography
        variant="overline"
        component="h2"
        className={classes.sectionHeader}
      >
        {title}
      </Typography>
      <Divider sx={{ mb: 1 }} />
      {children}
    </Box>
  )
}

function MetadataRows({ metadata }: { metadata: unknown }) {
  if (!isRecord(metadata)) {
    return null
  }
  return (
    <>
      {Object.entries(metadata).map(([key, value]) => {
        if (value === null || value === undefined || value === '') {
          return null
        }
        return (
          <SimpleField
            key={key}
            name={formatLabel(key)}
            value={formatScalar(value) ?? '—'}
          />
        )
      })}
    </>
  )
}

function DetailsContent({
  detailsState,
  selectedDetail,
}: {
  detailsState: ParsedDetailsState | null
  selectedDetail: ParsedSelectedDetail | null
}) {
  if (detailsState?.loading) {
    return (
      <Box
        className="lorax-details-loading"
        sx={{ py: 3, textAlign: 'center' }}
      >
        <Typography color="text.secondary">Fetching details...</Typography>
      </Box>
    )
  }

  if (detailsState?.error) {
    return (
      <Box sx={{ py: 2 }}>
        <Typography color="error">
          Error fetching details: {detailsState.error}
        </Typography>
      </Box>
    )
  }

  const data = detailsState?.data ?? null
  const tree = getRecord(data?.tree)
  const node = getRecord(data?.node)
  const individual = getRecord(data?.individual)
  const population = getRecord(data?.population)
  const nodeMutations = getRecordArray(data?.mutations)
  const nodeEdges = getRecord(data?.edges)
  const treeMutations = getRecordArray(tree?.mutations)
  const activeSelection = detailsState?.selectedDetail ?? selectedDetail
  const hasDetails =
    Boolean(tree) ||
    Boolean(node) ||
    Boolean(individual) ||
    Boolean(population) ||
    nodeMutations.length > 0 ||
    Boolean(nodeEdges)

  if (!activeSelection && !hasDetails) {
    return (
      <Box sx={{ py: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">
          Select an element to view details
        </Typography>
      </Box>
    )
  }

  if (!hasDetails) {
    return (
      <Box sx={{ py: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">
          No details available for selected item.
        </Typography>
      </Box>
    )
  }

  const asChild = getRecordArray(nodeEdges?.as_child)
  const asParent = getRecordArray(nodeEdges?.as_parent)

  return (
    <>
      {tree ? (
        <DetailSection title="Tree Details">
          <SimpleField
            name="Interval"
            value={formatInterval(tree.interval) ?? '—'}
          />
          <SimpleField
            name="Number of Roots"
            value={formatScalar(tree.num_roots) ?? '—'}
          />
          <SimpleField
            name="Number of Nodes"
            value={formatScalar(tree.num_nodes) ?? '—'}
          />
          {treeMutations.length > 0 ? (
            <Box sx={{ mt: 1 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontWeight: 700 }}
              >
                Mutations ({treeMutations.length})
              </Typography>
              {treeMutations.map((mutation, index) => {
                const id =
                  mutation.id != null ? String(mutation.id) : String(index)
                const inherited = formatScalar(mutation.inherited_state) ?? '?'
                const derived = formatScalar(mutation.derived_state) ?? '?'
                return (
                  <SimpleField
                    key={`tree-mut-${id}-${index}`}
                    name={`Mut ${id}`}
                    value={`${inherited} → ${derived} (Pos: ${formatPosition(mutation.position)})`}
                  />
                )
              })}
            </Box>
          ) : null}
        </DetailSection>
      ) : null}

      {node ? (
        <DetailSection title="Node Details">
          <SimpleField name="ID" value={formatScalar(node.id) ?? '—'} />
          <SimpleField name="Time" value={formatScalar(node.time) ?? '—'} />
          {node.individual !== -1 && node.individual !== undefined ? (
            <SimpleField
              name="Individual"
              value={formatScalar(node.individual) ?? '—'}
            />
          ) : null}
          {isRecord(node.metadata) && node.metadata.name ? (
            <SimpleField
              name="Name"
              value={formatScalar(node.metadata.name) ?? '—'}
            />
          ) : null}
        </DetailSection>
      ) : null}

      {individual ? (
        <DetailSection title="Individual Details">
          <SimpleField name="ID" value={formatScalar(individual.id) ?? '—'} />
          {individual.flags !== undefined ? (
            <SimpleField
              name="Flags"
              value={formatScalar(individual.flags) ?? '—'}
            />
          ) : null}
          {Array.isArray(individual.location) &&
          individual.location.length > 0 ? (
            <SimpleField
              name="Location"
              value={formatScalar(individual.location) ?? '—'}
            />
          ) : null}
          {Array.isArray(individual.parents) &&
          individual.parents.length > 0 ? (
            <SimpleField
              name="Parents"
              value={formatScalar(individual.parents) ?? '—'}
            />
          ) : null}
          <MetadataRows metadata={individual.metadata} />
          {individual.nodes !== undefined ? (
            <SimpleField
              name="Nodes"
              value={formatScalar(individual.nodes) ?? '—'}
            />
          ) : null}
        </DetailSection>
      ) : null}

      {population ? (
        <DetailSection title="Population">
          <SimpleField name="ID" value={formatScalar(population.id) ?? '—'} />
          <MetadataRows metadata={population.metadata} />
        </DetailSection>
      ) : null}

      {nodeMutations.length > 0 ? (
        <DetailSection title={`Mutations on Node (${nodeMutations.length})`}>
          {nodeMutations.map((mutation, index) => {
            const id = mutation.id != null ? String(mutation.id) : String(index)
            return (
              <Box key={`node-mut-${id}-${index}`} sx={{ mb: 1 }}>
                <SimpleField
                  name="Position"
                  value={formatPosition(mutation.position)}
                />
                <SimpleField
                  name="Change"
                  value={`${formatScalar(mutation.ancestral_state) ?? '?'} → ${formatScalar(mutation.derived_state) ?? '?'}`}
                />
                {mutation.time !== null && mutation.time !== undefined ? (
                  <SimpleField
                    name="Time"
                    value={formatScalar(mutation.time) ?? '—'}
                  />
                ) : null}
              </Box>
            )
          })}
        </DetailSection>
      ) : null}

      {asChild.length > 0 || asParent.length > 0 ? (
        <DetailSection title="Edges">
          {asChild.length > 0 ? (
            <Box sx={{ mb: 1 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontWeight: 700 }}
              >
                Parent edges (node as child):
              </Typography>
              {asChild.map((edge, index) => (
                <Typography
                  key={`child-edge-${formatScalar(edge.id) ?? String(index)}`}
                  variant="body2"
                >
                  Parent: {formatScalar(edge.parent) ?? '—'}, Span: [
                  {formatPosition(edge.left)}-{formatPosition(edge.right)})
                </Typography>
              ))}
            </Box>
          ) : null}
          {asParent.length > 0 ? (
            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontWeight: 700 }}
              >
                Child edges (node as parent):
              </Typography>
              {asParent.map((edge, index) => (
                <Typography
                  key={`parent-edge-${formatScalar(edge.id) ?? String(index)}`}
                  variant="body2"
                >
                  Child: {formatScalar(edge.child) ?? '—'}, Span: [
                  {formatPosition(edge.left)}-{formatPosition(edge.right)})
                </Typography>
              ))}
            </Box>
          ) : null}
        </DetailSection>
      ) : null}
    </>
  )
}

function FilterContent({
  filterState,
  controller,
}: {
  filterState: ParsedFilterState
  controller?: FilterController | null
}) {
  const { classes } = useStyles()
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE)
  const [isTreesExpanded, setIsTreesExpanded] = useState(true)

  const selectedColorBy = filterState.selectedColorBy
  const valueToColor = useMemo(
    () =>
      selectedColorBy && filterState.metadataColors?.[selectedColorBy]
        ? filterState.metadataColors[selectedColorBy]
        : {},
    [filterState.metadataColors, selectedColorBy],
  )
  const enabledSet = useMemo(
    () => new Set(filterState.enabledValues),
    [filterState.enabledValues],
  )
  const allValues = useMemo(() => {
    const values = Object.entries(valueToColor)
    const term = filterState.searchTerm.trim().toLowerCase()
    return term
      ? values.filter(([value]) => value.toLowerCase().includes(term))
      : values
  }, [filterState.searchTerm, valueToColor])
  const displayValues = allValues.slice(0, visibleCount)
  const hasMore = visibleCount < allValues.length
  const matchedFeatures = useMemo(() => {
    const project = filterState.tsconfig?.project
    const filename = filterState.tsconfig?.filename
    if (!project || !filename) {
      return []
    }
    return metadataFeatureConfig.filter(
      feature => feature.project === project && feature.filename === filename,
    )
  }, [filterState.tsconfig?.filename, filterState.tsconfig?.project])
  const isCsvFile = Boolean(filterState.tsconfig?.tree_info)

  return (
    <Box>
      <Box className={classes.filterBox}>
        <Box className={classes.filterRow}>
          <Typography variant="button">Search</Typography>
          <label style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <span>Display lineages</span>
            <input
              type="checkbox"
              checked={filterState.displayLineagePaths}
              onChange={event =>
                controller?.setDisplayLineagePaths?.(event.target.checked)
              }
            />
          </label>
        </Box>
        <Box className={classes.filterRow}>
          <input
            type="checkbox"
            aria-label="Enable all metadata values"
            checked={filterState.enabledValues.length > 0}
            onChange={event => {
              controller?.setEnabledValues?.(
                event.target.checked ? Object.keys(valueToColor) : [],
              )
            }}
          />
          <select
            className={classes.filterInput}
            aria-label="Metadata key"
            value={selectedColorBy ?? ''}
            onChange={event => {
              controller?.setSelectedColorBy?.(event.target.value)
              controller?.setSearchTerm?.('')
              controller?.setSearchTags?.([])
              setVisibleCount(ITEMS_PER_PAGE)
            }}
          >
            {Object.keys(filterState.coloryby).length === 0 ? (
              <option value="">No metadata available</option>
            ) : (
              Object.entries(filterState.coloryby).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))
            )}
          </select>
          <input
            className={classes.filterInput}
            aria-label="Search metadata values"
            placeholder="Search..."
            style={{ flex: 1, minWidth: 0 }}
            value={filterState.searchTerm}
            onChange={event => controller?.setSearchTerm?.(event.target.value)}
            onKeyDown={event => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              const term = filterState.searchTerm.trim()
              if (term) {
                controller?.addSearchTag?.(term)
                controller?.setSearchTerm?.('')
              }
            }}
          />
        </Box>

        {filterState.searchTags.length > 0 ? (
          <Box sx={{ mb: 1 }}>
            {filterState.searchTags.map((tag, index) => {
              const tagColor = selectedColorBy ? valueToColor[tag] : null
              return (
                <span
                  key={`${tag}-${index}`}
                  className={classes.tag}
                  style={
                    tagColor
                      ? {
                          backgroundColor: `rgba(${tagColor[0]}, ${tagColor[1]}, ${tagColor[2]}, 0.25)`,
                        }
                      : undefined
                  }
                >
                  <span>{tag}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${tag}`}
                    className={classes.linkButton}
                    onClick={() => controller?.removeSearchTag?.(index)}
                  >
                    x
                  </button>
                </span>
              )
            })}
          </Box>
        ) : null}

        {matchedFeatures.length > 0 ? (
          <Box className={classes.filterBox}>
            <Typography variant="caption" color="text.secondary">
              Feature presets
            </Typography>
            {matchedFeatures.map(feature => {
              const isActive = filterState.activeFeatureId === feature.id
              return (
                <Box key={feature.id} sx={{ mt: 1 }}>
                  <Box className={classes.filterRow} sx={{ mb: 0.25 }}>
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      {feature.label ?? feature.id}
                    </Typography>
                    <button
                      type="button"
                      title={isActive ? 'Disable preset' : 'Enable preset'}
                      className={classes.linkButton}
                      onClick={() => {
                        if (isActive) {
                          controller?.disablePresetFeature?.(feature)
                        } else {
                          controller?.applyPresetFeature?.(feature)
                        }
                      }}
                    >
                      {isActive ? 'Disable' : 'Enable'}
                    </button>
                  </Box>
                  {feature.description ? (
                    <Typography variant="caption" color="text.secondary">
                      {feature.description}
                    </Typography>
                  ) : null}
                </Box>
              )
            })}
          </Box>
        ) : null}

        <Box className={classes.valueList}>
          {displayValues.length > 0 ? (
            <>
              {displayValues.map(([value, color]) => {
                const isEnabled = enabledSet.has(value)
                const isHighlighted =
                  filterState.highlightedMetadataValue === value
                return (
                  <Box
                    key={value}
                    className={classes.valueRow}
                    sx={{
                      opacity: isEnabled ? 1 : 0.45,
                      backgroundColor: isHighlighted
                        ? 'rgba(250, 204, 21, 0.2)'
                        : undefined,
                    }}
                  >
                    <input
                      type="color"
                      aria-label={`Color for ${value}`}
                      value={rgbaToHex(color)}
                      onChange={event => {
                        if (!selectedColorBy) return
                        const rgb = hexToRgb(event.target.value)
                        controller?.setMetadataColor?.(selectedColorBy, value, [
                          ...rgb,
                          255,
                        ])
                      }}
                    />
                    <button
                      type="button"
                      className={classes.linkButton}
                      style={{ flex: 1, textAlign: 'left', color: 'inherit' }}
                      onClick={() =>
                        controller?.toggleHighlightedValue?.(value)
                      }
                      onDoubleClick={() => controller?.addSearchTag?.(value)}
                    >
                      {value}
                    </button>
                    <button
                      type="button"
                      className={classes.linkButton}
                      onClick={() => controller?.addSearchTag?.(value)}
                      disabled={!isEnabled}
                    >
                      Search
                    </button>
                    <button
                      type="button"
                      className={classes.linkButton}
                      onClick={() => controller?.toggleEnabledValue?.(value)}
                    >
                      {isEnabled ? 'Remove' : 'Add'}
                    </button>
                  </Box>
                )
              })}
              {hasMore ? (
                <Box className={classes.valueRow}>
                  <Typography variant="caption" sx={{ flex: 1 }}>
                    Showing {displayValues.length} of {allValues.length}
                  </Typography>
                  <button
                    type="button"
                    className={classes.linkButton}
                    onClick={() =>
                      setVisibleCount(prev => prev + ITEMS_PER_PAGE)
                    }
                  >
                    Load more
                  </button>
                </Box>
              ) : null}
            </>
          ) : selectedColorBy ? (
            <Typography sx={{ p: 1 }} color="text.secondary">
              No values found
            </Typography>
          ) : (
            <Typography sx={{ p: 1 }} color="text.secondary">
              No metadata available
            </Typography>
          )}
        </Box>
      </Box>

      <Box className={classes.filterBox}>
        <Box className={classes.filterRow}>
          <button
            type="button"
            className={classes.linkButton}
            onClick={() => setIsTreesExpanded(prev => !prev)}
          >
            {isTreesExpanded ? 'Hide' : 'Show'}
          </button>
          <Typography variant="button" sx={{ flex: 1 }}>
            Trees{' '}
            {filterState.visibleTrees.length > 0
              ? `(${filterState.visibleTrees.length})`
              : ''}
          </Typography>
          {isCsvFile ? (
            <label style={{ display: 'flex', gap: 6 }}>
              <span>Color by tree</span>
              <input
                type="checkbox"
                checked={filterState.colorByTree}
                onChange={event =>
                  controller?.setColorByTree?.(event.target.checked)
                }
              />
            </label>
          ) : null}
        </Box>
        {isTreesExpanded ? (
          <Box className={classes.valueList}>
            {filterState.visibleTrees.length > 0 ? (
              filterState.visibleTrees.map(treeIndex => {
                const isHovered = filterState.hoveredTreeIndex === treeIndex
                const key = String(treeIndex)
                return (
                  <Box
                    key={key}
                    className={classes.valueRow}
                    sx={{
                      backgroundColor: isHovered
                        ? 'rgba(59, 130, 246, 0.15)'
                        : undefined,
                    }}
                    onMouseEnter={() =>
                      controller?.setHoveredTreeIndex?.(treeIndex)
                    }
                    onMouseLeave={() => controller?.setHoveredTreeIndex?.(null)}
                  >
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      Tree {treeIndex}
                    </Typography>
                    <input
                      type="color"
                      aria-label={`Tree ${treeIndex} color`}
                      value={filterState.treeColors[key] ?? '#91C2F4'}
                      onChange={event =>
                        controller?.setTreeColor?.(
                          treeIndex,
                          event.target.value,
                        )
                      }
                    />
                    {filterState.treeColors[key] ? (
                      <button
                        type="button"
                        className={classes.linkButton}
                        onClick={() => controller?.clearTreeColor?.(treeIndex)}
                      >
                        Clear
                      </button>
                    ) : null}
                  </Box>
                )
              })
            ) : (
              <Typography sx={{ p: 1 }} color="text.secondary">
                No visible trees
              </Typography>
            )}
          </Box>
        ) : null}
      </Box>
    </Box>
  )
}

function TabPanel(props: {
  children: ReactNode
  value: number
  index: number
}) {
  const { children, value, index } = props
  if (value !== index) {
    return null
  }
  return (
    <div
      role="tabpanel"
      id={`lorax-metadata-tabpanel-${index}`}
      aria-labelledby={`lorax-metadata-tab-${index}`}
    >
      {children}
    </div>
  )
}

const LoraxMetadataWidget = observer(function LoraxMetadataWidget({
  model,
}: {
  model: LoraxMetadataWidgetModel
}) {
  const { classes } = useStyles()
  const [tab, setTab] = useState(
    typeof model.activeTab === 'number' ? model.activeTab : 0,
  )
  const parsed = parseSnapshot(model.snapshot)
  const selectedDetail = parseSelectedDetail(model.selectedDetail)
  const detailsState = parseDetailsState(model.detailsState)
  const filterState = parseFilterState(model.filterState)

  useEffect(() => {
    if (typeof model.activeTab === 'number' && model.activeTab !== tab) {
      setTab(model.activeTab)
    }
  }, [model.activeTab, tab])

  const { config = {} } = parsed ?? {}

  const genomeLen = formatScalar(config.genome_length)
  const project = formatScalar(config.project)
  const initialPos = formatScalar(config.initial_position)
  const intervalsSummary = formatIntervalsSummary(config)
  const mutations = getMutationsList(config)
  const mutationSummary = getMutationSummary(config)
  const metadataSchema = config.metadata_schema
  const metadataSchemaKeys =
    typeof config.metadata_schema_keys === 'number'
      ? `${config.metadata_schema_keys} key(s)`
      : undefined

  return (
    <Paper className={classes.paper} data-testid="lorax-metadata-widget">
      <Tabs
        value={tab}
        onChange={(_e, v: number) => {
          setTab(v)
          model.setActiveTab?.(v)
        }}
        textColor="primary"
        indicatorColor="primary"
        variant="fullWidth"
        aria-label="Lorax metadata sections"
      >
        <Tab
          label="Details"
          id="lorax-metadata-tab-0"
          aria-controls="lorax-metadata-tabpanel-0"
        />
        <Tab
          label="Mutations"
          id="lorax-metadata-tab-1"
          aria-controls="lorax-metadata-tabpanel-1"
        />
        <Tab
          label="Filter"
          id="lorax-metadata-tab-2"
          aria-controls="lorax-metadata-tabpanel-2"
        />
        <Tab
          label="Metadata"
          id="lorax-metadata-tab-3"
          aria-controls="lorax-metadata-tabpanel-3"
        />
        <Tab
          label="Selection"
          id="lorax-metadata-tab-4"
          aria-controls="lorax-metadata-tabpanel-4"
        />
      </Tabs>

      <TabPanel value={tab} index={0}>
        <div className={classes.tabPanel}>
          <DetailsContent
            detailsState={detailsState}
            selectedDetail={selectedDetail}
          />
        </div>
      </TabPanel>

      <TabPanel value={tab} index={1}>
        <div className={classes.tabPanel}>
          {mutations.length === 0 ? (
            <Typography color="text.secondary">
              No mutations in this load payload.
            </Typography>
          ) : (
            <>
              <Typography
                variant="overline"
                component="h2"
                className={classes.sectionHeader}
              >
                Mutations ({mutations.length})
              </Typography>
              <Divider sx={{ mb: 1 }} />
              {mutations.map((m, i) => {
                const id = m.id != null ? String(m.id) : String(i)
                return (
                  <SimpleField
                    key={`mut-${id}-${i}`}
                    name={`Mut ${id}`}
                    value={formatMutationRow(m)}
                  />
                )
              })}
            </>
          )}
        </div>
      </TabPanel>

      <TabPanel value={tab} index={2}>
        <div className={classes.tabPanel}>
          <FilterContent
            filterState={filterState}
            controller={model.filterController}
          />
        </div>
      </TabPanel>

      <TabPanel value={tab} index={3}>
        <div className={classes.tabPanel}>
          {[
            project,
            genomeLen,
            initialPos,
            intervalsSummary,
            mutationSummary,
            metadataSchemaKeys,
          ].some(Boolean) ? (
            <Box sx={{ mb: 2 }}>
              <Typography
                variant="overline"
                component="h2"
                className={classes.sectionHeader}
              >
                Tree / load details
              </Typography>
              <Divider sx={{ mb: 1 }} />
              {project ? <SimpleField name="Project" value={project} /> : null}
              {genomeLen ? (
                <SimpleField name="Genome length" value={genomeLen} />
              ) : null}
              {initialPos ? (
                <SimpleField name="Initial position" value={initialPos} />
              ) : null}
              {intervalsSummary ? (
                <SimpleField name="Intervals" value={intervalsSummary} />
              ) : null}
              {mutationSummary ? (
                <SimpleField name="Mutations" value={mutationSummary} />
              ) : null}
              {metadataSchemaKeys ? (
                <SimpleField
                  name="Metadata schema keys"
                  value={metadataSchemaKeys}
                />
              ) : null}
            </Box>
          ) : null}
          {metadataSchema !== undefined && metadataSchema !== null ? (
            <>
              <Typography
                variant="overline"
                component="h2"
                className={classes.sectionHeader}
              >
                Metadata schema
              </Typography>
              <Divider sx={{ mb: 1 }} />
              <Box
                className={classes.pre}
                component="pre"
                aria-label="Metadata schema JSON"
              >
                {JSON.stringify(metadataSchema, null, 2)}
              </Box>
            </>
          ) : (
            <Typography color="text.secondary" sx={{ mb: 1 }}>
              No metadata_schema field in this load payload.
            </Typography>
          )}
          <Accordion defaultExpanded={metadataSchema == null} sx={{ mt: 1 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="button">Full snapshot</Typography>
            </AccordionSummary>
            <AccordionDetails className={classes.accordionDetails}>
              <Box
                className={classes.pre}
                component="pre"
                aria-label="Full Lorax load snapshot"
              >
                {JSON.stringify(parsed ?? {}, null, 2)}
              </Box>
            </AccordionDetails>
          </Accordion>
        </div>
      </TabPanel>
      <TabPanel value={tab} index={4}>
        <div className={classes.tabPanel}>
          {!selectedDetail ? (
            <Typography color="text.secondary">
              No selected tip/edge yet. Click a tip or edge in the Lorax view.
            </Typography>
          ) : (
            <>
              <Typography
                variant="overline"
                component="h2"
                className={classes.sectionHeader}
              >
                {selectedDetail.title ?? 'Selected item'}
              </Typography>
              <Divider sx={{ mb: 1 }} />
              {Array.isArray(selectedDetail.rows) ? (
                selectedDetail.rows.map((row, i) => (
                  <SimpleField
                    key={`${row.k ?? 'row'}-${i}`}
                    name={String(row.k ?? `Field ${i + 1}`)}
                    value={formatScalar(row.v) ?? '—'}
                  />
                ))
              ) : (
                <Typography color="text.secondary" sx={{ mb: 1 }}>
                  No structured fields available for this selection.
                </Typography>
              )}
              <Accordion defaultExpanded={false} sx={{ mt: 2 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="button">
                    Selected payload (JSON)
                  </Typography>
                </AccordionSummary>
                <AccordionDetails className={classes.accordionDetails}>
                  <Box
                    className={classes.pre}
                    component="pre"
                    aria-label="Selected Lorax payload JSON"
                  >
                    {JSON.stringify(
                      selectedDetail.raw ?? selectedDetail,
                      null,
                      2,
                    )}
                  </Box>
                </AccordionDetails>
              </Accordion>
            </>
          )}
        </div>
      </TabPanel>
    </Paper>
  )
})

export default LoraxMetadataWidget
