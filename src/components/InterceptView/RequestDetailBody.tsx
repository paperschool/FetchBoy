import { useState, useMemo, useEffect } from 'react'
import { MonacoEditorField } from '@/components/Editor/MonacoEditorField'
import { SaveContentButton } from '@/components/Editor/SaveContentButton'
import { isImageContentType, ImageViewer } from '@/components/ResponseViewer/ResponseViewer'
import type { InterceptRequest, BreakpointModifications } from '@/stores/interceptStore'

type BodyLanguage = 'json' | 'html' | 'xml' | 'plaintext'

interface RequestDetailBodyProps {
  selectedRequest: InterceptRequest
  editMode: boolean
  pendingMods: BreakpointModifications
  onModsChange?: (mods: Partial<BreakpointModifications>) => void
  editorFontSize: number
}

export function RequestDetailBody({
  selectedRequest,
  editMode,
  pendingMods,
  onModsChange,
  editorFontSize,
}: RequestDetailBodyProps): React.ReactElement {
  const [bodyLanguage, setBodyLanguage] = useState<BodyLanguage>('plaintext')

  const formattedBody = useMemo(() => {
    if (!selectedRequest.responseBody) return null
    try { return JSON.stringify(JSON.parse(selectedRequest.responseBody), null, 2) }
    catch { return null }
  }, [selectedRequest.responseBody])

  useEffect(() => {
    const ct = selectedRequest.contentType?.toLowerCase() ?? ''
    if (formattedBody || ct.includes('json')) setBodyLanguage('json')
    else if (ct.includes('html')) setBodyLanguage('html')
    else if (ct.includes('xml')) setBodyLanguage('xml')
    else setBodyLanguage('plaintext')
  }, [selectedRequest.id, formattedBody])

  if (selectedRequest.isPending && !editMode) {
    return (
      <div className="flex-1 flex items-center justify-center text-yellow-400/70 text-sm">
        <span className="animate-pulse">Awaiting response...</span>
      </div>
    )
  }

  if (isImageContentType(selectedRequest.contentType) && !editMode) {
    return (
      <div className="flex-1 min-h-0 p-2">
        <ImageViewer contentType={selectedRequest.contentType} body={selectedRequest.responseBody ?? ''} />
      </div>
    )
  }

  return (
    <div className="relative min-h-[220px] flex-1">
      <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
        <SaveContentButton
          content={editMode ? (pendingMods.responseBody ?? selectedRequest.responseBody ?? '') : (formattedBody ?? selectedRequest.responseBody ?? '')}
          language={bodyLanguage}
        />
        <select value={bodyLanguage} onChange={(e) => setBodyLanguage(e.target.value as BodyLanguage)}
          className="select-flat border-app-subtle bg-app-main text-app-primary h-8 rounded-md border pl-2 pr-7 text-xs"
          aria-label="Body language">
          <option value="json">JSON</option>
          <option value="html">HTML</option>
          <option value="xml">XML</option>
          <option value="plaintext">Raw</option>
        </select>
      </div>
      <MonacoEditorField
        testId="intercept-response-body-editor"
        path="intercept-response-body"
        language={bodyLanguage}
        value={editMode ? (pendingMods.responseBody ?? selectedRequest.responseBody ?? '') : (formattedBody ?? selectedRequest.responseBody ?? '')}
        fontSize={editorFontSize}
        height="100%"
        readOnly={!editMode}
        onChange={editMode ? (val) => onModsChange?.({ responseBody: val }) : undefined}
      />
    </div>
  )
}
