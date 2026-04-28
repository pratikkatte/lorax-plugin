import React, { useState, type ReactNode } from 'react'

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

import type { IStateTreeNode } from 'mobx-state-tree'

/** Widget state; extends MST node with fields this component reads. */
type LoraxMetadataWidgetModel = IStateTreeNode & {
  trackLabel?: string
  snapshot?: unknown
  selectedDetail?: unknown
  detailsState?: unknown
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
  const [tab, setTab] = useState(0)
  const parsed = parseSnapshot(model.snapshot)
  const selectedDetail = parseSelectedDetail(model.selectedDetail)
  const detailsState = parseDetailsState(model.detailsState)

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
        onChange={(_e, v: number) => setTab(v)}
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
          label="Metadata"
          id="lorax-metadata-tab-2"
          aria-controls="lorax-metadata-tabpanel-2"
        />
        <Tab
          label="Selection"
          id="lorax-metadata-tab-3"
          aria-controls="lorax-metadata-tabpanel-3"
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
      <TabPanel value={tab} index={3}>
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
