import React from 'react'

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Typography,
} from '@mui/material'

type JsonRecord = Record<string, unknown>

interface FileInfoDialogProps {
  open: boolean
  onClose: () => void
  snapshot: unknown
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function isEmptyObject(value: unknown) {
  return isRecord(value) && Object.keys(value).length === 0
}

function hasDisplayValue(value: unknown) {
  return (
    value !== null &&
    value !== undefined &&
    value !== '' &&
    !(Array.isArray(value) && value.length === 0) &&
    !isEmptyObject(value)
  )
}

function formatJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function formatCount(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toLocaleString()
  }
  return value === null || value === undefined ? '-' : String(value)
}

function parseSnapshotConfig(snapshot: unknown): JsonRecord | null {
  if (!isRecord(snapshot) || !isRecord(snapshot.config)) {
    return null
  }
  return snapshot.config
}

function getProvenanceRecords(provenance: unknown): JsonRecord[] {
  if (!isRecord(provenance) || !Array.isArray(provenance.records)) {
    return []
  }
  return provenance.records.filter(isRecord)
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  if (!hasDisplayValue(value)) {
    return null
  }

  return (
    <Box sx={{ borderTop: '1px solid', borderColor: 'divider', mt: 2, pt: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {title}
      </Typography>
      <Box
        component="pre"
        sx={{
          bgcolor: 'grey.50',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          color: 'text.secondary',
          fontSize: 11,
          lineHeight: 1.45,
          maxHeight: 240,
          overflow: 'auto',
          p: 1,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {formatJson(value)}
      </Box>
    </Box>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Typography variant="body2" sx={{ mb: 0.75 }}>
      <Box component="span" sx={{ color: 'text.secondary' }}>
        {label}:
      </Box>{' '}
      {value}
    </Typography>
  )
}

function TableCounts({ tableCounts }: { tableCounts: unknown }) {
  if (!isRecord(tableCounts)) {
    return null
  }

  return (
    <Box
      sx={{
        borderTop: '1px solid',
        borderColor: 'divider',
        display: 'grid',
        gap: 1,
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        mt: 2,
        pt: 2,
      }}
    >
      {Object.entries(tableCounts).map(([label, count]) => (
        <InfoRow key={label} label={label} value={formatCount(count)} />
      ))}
    </Box>
  )
}

function Provenance({ provenance }: { provenance: unknown }) {
  if (!isRecord(provenance)) {
    return null
  }

  const records = getProvenanceRecords(provenance)
  const latest = isRecord(provenance.latest) ? provenance.latest : null
  const latestSoftware = [latest?.software, latest?.software_version]
    .filter(Boolean)
    .join(' ')

  return (
    <Box sx={{ borderTop: '1px solid', borderColor: 'divider', mt: 2, pt: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Provenance
      </Typography>
      <InfoRow
        label="records"
        value={formatCount(provenance.count ?? records.length)}
      />
      {latest ? (
        <Box sx={{ mt: 1 }}>
          <InfoRow
            label="latest timestamp"
            value={String(latest.timestamp ?? '-')}
          />
          {latestSoftware ? (
            <InfoRow label="latest software" value={latestSoftware} />
          ) : null}
        </Box>
      ) : null}
      {records.length ? (
        <Box component="details" open sx={{ mt: 1.5 }}>
          <Box component="summary" sx={{ cursor: 'pointer', fontWeight: 500 }}>
            Full provenance records
          </Box>
          <Box sx={{ mt: 1.5 }}>
            {records.map((record, index) => (
              <Box key={String(record.id ?? index)} sx={{ mb: 2 }}>
                <Typography
                  variant="body2"
                  sx={{ color: 'text.secondary', fontWeight: 500 }}
                >
                  Record {String(record.id ?? index)}
                  {record.timestamp ? ` - ${String(record.timestamp)}` : ''}
                </Typography>
                <JsonBlock title="record" value={record.record} />
              </Box>
            ))}
          </Box>
        </Box>
      ) : null}
    </Box>
  )
}

export default function FileInfoDialog({
  open,
  onClose,
  snapshot,
}: FileInfoDialogProps) {
  const config = parseSnapshotConfig(snapshot)
  const tableCounts = config?.table_counts
  const topLevelMetadata = config?.top_level_metadata
  const provenance = config?.provenance

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>File Info</DialogTitle>
      <DialogContent dividers>
        {config ? (
          <Box>
            <InfoRow
              label="sequence length"
              value={`${formatCount(config.genome_length)} bp`}
            />
            <InfoRow
              label="Recombination Intervals"
              value={formatCount(config.intervals_count)}
            />
            {config.num_samples !== null && config.num_samples !== undefined ? (
              <InfoRow
                label="Samples"
                value={formatCount(config.num_samples)}
              />
            ) : null}
            {config.project ? (
              <InfoRow label="Project" value={String(config.project)} />
            ) : null}
            <TableCounts tableCounts={tableCounts} />
            <Provenance provenance={provenance} />
            <JsonBlock title="Top-level metadata" value={topLevelMetadata} />
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            File info is not available yet.
          </Typography>
        )}
      </DialogContent>
      <Divider />
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
