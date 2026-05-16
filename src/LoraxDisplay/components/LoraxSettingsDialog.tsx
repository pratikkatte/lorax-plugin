import React from 'react'
import {
  Box,
  Checkbox,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'

type Rgba = [number, number, number, number]

function rgbToHex(r: number, g: number, b: number) {
  return (
    '#' +
    [r, g, b]
      .map(x => {
        const h = Math.round(x).toString(16)
        return h.length === 1 ? `0${h}` : h
      })
      .join('')
  )
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!m) return [145, 194, 244]
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: Rgba
  onChange: (next: Rgba) => void
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
      <Typography variant="body2" sx={{ flex: 1 }}>
        {label}
      </Typography>
      <input
        type="color"
        value={rgbToHex(value[0], value[1], value[2])}
        onChange={e => {
          const [r, g, b] = hexToRgb(e.target.value)
          onChange([r, g, b, value[3]])
        }}
        style={{ width: 28, height: 28, padding: 0, cursor: 'pointer' }}
      />
    </Box>
  )
}

export interface LoraxSettingsDialogProps {
  open: boolean
  onClose: () => void
  polygonFillColor: Rgba
  setPolygonFillColor: (v: Rgba) => void
  timeScale: 'linear' | 'log'
  setTimeScale: (v: 'linear' | 'log') => void
  edgeColor: Rgba
  setEdgeColor: (v: Rgba) => void
  defaultTipColor: Rgba
  setDefaultTipColor: (v: Rgba) => void
  showCompareInsertion: boolean
  setShowCompareInsertion: (v: boolean) => void
  compareInsertionColor: Rgba
  setCompareInsertionColor: (v: Rgba) => void
  showCompareDeletion: boolean
  setShowCompareDeletion: (v: boolean) => void
  compareDeletionColor: Rgba
  setCompareDeletionColor: (v: Rgba) => void
  descendantsHighlightColor: Rgba
  setDescendantsHighlightColor: (v: Rgba) => void
}

export default function LoraxSettingsDialog(props: LoraxSettingsDialogProps) {
  const {
    open,
    onClose,
    polygonFillColor,
    setPolygonFillColor,
    timeScale,
    setTimeScale,
    edgeColor,
    setEdgeColor,
    defaultTipColor,
    setDefaultTipColor,
    showCompareInsertion,
    setShowCompareInsertion,
    compareInsertionColor,
    setCompareInsertionColor,
    showCompareDeletion,
    setShowCompareDeletion,
    compareDeletionColor,
    setCompareDeletionColor,
    descendantsHighlightColor,
    setDescendantsHighlightColor,
  } = props

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', pr: 1 }}>
        Settings
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{ ml: 'auto' }}
          size="small"
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="subtitle2" gutterBottom>
          Tree background
        </Typography>
        <ColorRow
          label="Fill"
          value={polygonFillColor}
          onChange={setPolygonFillColor}
        />
        <Typography variant="subtitle2" gutterBottom sx={{ mt: 1 }}>
          Time axis scale
        </Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={timeScale}
          onChange={(_, v: unknown) => {
            if (v === 'linear' || v === 'log') {
              setTimeScale(v)
            }
          }}
        >
          <ToggleButton value="linear">Linear</ToggleButton>
          <ToggleButton value="log">Log</ToggleButton>
        </ToggleButtonGroup>
        <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
          Tree edges
        </Typography>
        <ColorRow label="Edge" value={edgeColor} onChange={setEdgeColor} />
        <Typography variant="subtitle2" gutterBottom sx={{ mt: 1 }}>
          Tree tip default
        </Typography>
        <ColorRow
          label="Tip"
          value={defaultTipColor}
          onChange={setDefaultTipColor}
        />
        <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
          Compare topology
        </Typography>
        <FormControlLabel
          control={
            <Checkbox
              checked={showCompareInsertion}
              onChange={e => setShowCompareInsertion(e.target.checked)}
            />
          }
          label="Added edges"
        />
        <ColorRow
          label="Insertion color"
          value={compareInsertionColor}
          onChange={setCompareInsertionColor}
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={showCompareDeletion}
              onChange={e => setShowCompareDeletion(e.target.checked)}
            />
          }
          label="Removed edges"
        />
        <ColorRow
          label="Deletion color"
          value={compareDeletionColor}
          onChange={setCompareDeletionColor}
        />
        <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
          Edge hover
        </Typography>
        <ColorRow
          label="Highlight color"
          value={descendantsHighlightColor}
          onChange={setDescendantsHighlightColor}
        />
      </DialogContent>
    </Dialog>
  )
}
