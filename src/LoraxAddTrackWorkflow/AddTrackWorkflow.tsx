import React, { useMemo, useState } from 'react'
import { storeBlobLocation } from '@jbrowse/core/util/tracks'
import {
  getSession,
  isElectron,
  isSessionModelWithWidgets,
  isSessionWithAddTracks,
} from '@jbrowse/core/util'
import { Button, Paper, TextField, Typography } from '@mui/material'
import { observer } from 'mobx-react'

function makeFileLocation(file: File) {
  return isElectron
    ? {
        localPath: window.require('electron').webUtils.getPathForFile(file),
        locationType: 'LocalPathLocation',
      }
    : storeBlobLocation({ blob: file })
}

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, '_').toLowerCase()
}

function isSupportedLoraxFile(name: string) {
  return /\.(trees|tree|tsz|csv)(\.gz)?$/i.test(name)
}

type WorkflowModel = {
  assembly: string
  view?: { showTrack?: (trackId: string) => void }
  apiBase?: string
  setApiBase?: (value: string) => void
  clearData: () => void
}

const LoraxAddTrackWorkflow = observer(function LoraxAddTrackWorkflow({
  model,
}: {
  model: WorkflowModel
}) {
  const session = getSession(model)
  const [selectedFile, setSelectedFile] = useState<File | undefined>()
  const [urlValue, setUrlValue] = useState('')
  const [trackName, setTrackName] = useState(`Lorax_${Date.now()}`)
  const [apiBase, setApiBase] = useState(
    model.apiBase || 'http://localhost:8080',
  )
  const [error, setError] = useState('')

  const selectedSourceName = selectedFile?.name || urlValue
  const extensionValid = useMemo(
    () =>
      selectedSourceName
        ? isSupportedLoraxFile(selectedSourceName)
        : true,
    [selectedSourceName],
  )

  const canSubmit = Boolean(
    model.assembly &&
      selectedSourceName &&
      extensionValid &&
      trackName.trim(),
  )

  const submit = () => {
    try {
      if (!isSessionWithAddTracks(session)) {
        throw new Error("Can't add tracks to this session")
      }

      const fileLocation = selectedFile
        ? makeFileLocation(selectedFile)
        : ({
            uri: urlValue.trim(),
            locationType: 'UriLocation',
          } as const)

      const finalTrackName = trackName.trim()
      const trackId = [
        `${normalizeName(finalTrackName)}-${Date.now()}`,
        session.adminMode ? '' : '-sessionTrack',
      ].join('')

      session.addTrackConf({
        type: 'LoraxTrack',
        trackId,
        name: finalTrackName,
        assemblyNames: [model.assembly],
        adapter: {
          type: 'LoraxAdapter',
          apiBase: apiBase.trim() || 'http://localhost:8080',
          fileLocation,
          useUpload: true,
        },
      })
      model.view?.showTrack?.(trackId)
      model.clearData()
      if (isSessionModelWithWidgets(session)) {
        session.hideWidget(model)
      }
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e)
      setError(err)
      session.notifyError(err, e)
    }
  }

  return (
    <Paper style={{ padding: 16 }}>
      <Typography variant="body2" style={{ marginBottom: 12 }}>
        Upload or link a `.trees`, `.tree`, `.tsz`, or `.csv` file.
      </Typography>
      <Button variant="outlined" component="label" style={{ marginBottom: 12 }}>
        Choose local file
        <input
          type="file"
          hidden
          accept=".trees,.tree,.tsz,.csv,.gz"
          onChange={({ target }) => {
            const file = target.files?.[0]
            setSelectedFile(file)
            if (file) {
              setUrlValue('')
              if (!trackName.trim() || trackName.startsWith('Lorax_')) {
                setTrackName(file.name)
              }
            }
          }}
        />
      </Button>
      <TextField
        fullWidth
        label="Or file URL"
        placeholder="https://example.org/sample.trees"
        value={urlValue}
        onChange={event => {
          setUrlValue(event.target.value)
          if (event.target.value.trim()) {
            setSelectedFile(undefined)
          }
        }}
        style={{ marginBottom: 12 }}
      />
      <TextField
        fullWidth
        label="Track name"
        value={trackName}
        onChange={event => {
          setTrackName(event.target.value)
        }}
        style={{ marginBottom: 12 }}
      />
      <TextField
        fullWidth
        label="Lorax API base"
        placeholder="http://localhost:8080"
        value={apiBase}
        onChange={event => {
          setApiBase(event.target.value)
          model.setApiBase?.(event.target.value)
        }}
        style={{ marginBottom: 12 }}
      />
      {selectedSourceName ? (
        <Typography
          variant="caption"
          color={extensionValid ? 'textSecondary' : 'error'}
          style={{ display: 'block', marginBottom: 8 }}
        >
          {extensionValid
            ? `Selected source: ${selectedSourceName}`
            : 'Unsupported extension. Use .trees, .tree, .tsz, .csv (optionally .gz).'}
        </Typography>
      ) : null}
      {error ? (
        <Typography variant="caption" color="error" style={{ display: 'block', marginBottom: 8 }}>
          {error}
        </Typography>
      ) : null}
      <Button variant="contained" disabled={!canSubmit} onClick={submit}>
        Add Lorax track
      </Button>
    </Paper>
  )
})

export default LoraxAddTrackWorkflow
