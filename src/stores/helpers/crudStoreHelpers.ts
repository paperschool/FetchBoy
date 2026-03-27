/**
 * Shared CRUD helpers for breakpoints and mappings stores.
 * Provides form↔entity serialization and save branching.
 */

/** Generic save: create or update based on form.id, then apply to state. */
export async function saveEntity<TEntity extends { id: string }, TForm extends { id: string | null }>(params: {
  form: TForm;
  dbCreate: (form: TForm) => Promise<TEntity>;
  dbUpdate: (id: string, changes: Record<string, unknown>) => Promise<void>;
  formToDbChanges: (form: TForm) => Record<string, unknown>;
  applyToState: (entity: TEntity, isNew: boolean) => void;
}): Promise<void> {
  const { form, dbCreate, dbUpdate, formToDbChanges, applyToState } = params;
  const changes = formToDbChanges(form);

  if (form.id === null) {
    const entity = await dbCreate(form);
    await dbUpdate(entity.id, changes);
    applyToState({ ...entity, ...changes } as TEntity, true);
  } else {
    await dbUpdate(form.id, changes);
    applyToState({ id: form.id, ...changes } as TEntity, false);
  }
}

/** Shared form→DB field mapping for breakpoints. */
export function breakpointFormToDb(form: {
  name: string;
  urlPattern: string;
  matchType: string;
  enabled: boolean;
  responseMappingEnabled: boolean;
  responseMappingBody: string;
  responseMappingContentType: string;
  statusCodeEnabled: boolean;
  statusCodeValue: number;
  customHeaders: unknown[];
  blockRequestEnabled: boolean;
  blockRequestStatusCode: number;
  blockRequestBody: string;
}): Record<string, unknown> {
  return {
    name: form.name,
    url_pattern: form.urlPattern,
    match_type: form.matchType,
    enabled: form.enabled,
    response_mapping_enabled: form.responseMappingEnabled,
    response_mapping_body: form.responseMappingBody,
    response_mapping_content_type: form.responseMappingContentType,
    status_code_enabled: form.statusCodeEnabled,
    status_code_value: form.statusCodeValue,
    custom_headers: form.customHeaders,
    block_request_enabled: form.blockRequestEnabled,
    block_request_status_code: form.blockRequestStatusCode,
    block_request_body: form.blockRequestBody,
  };
}

/** Shared form→DB field mapping for mappings. */
export function mappingFormToDb(form: {
  name: string;
  urlPattern: string;
  matchType: string;
  enabled: boolean;
  headersAdd: unknown[];
  headersRemove: unknown[];
  cookies: unknown[];
  responseBodyEnabled: boolean;
  responseBody: string;
  responseBodyContentType: string;
  responseBodyFilePath: string;
  urlRemapEnabled: boolean;
  urlRemapTarget: string;
}): Record<string, unknown> {
  return {
    name: form.name,
    url_pattern: form.urlPattern,
    match_type: form.matchType,
    enabled: form.enabled,
    headers_add: form.headersAdd,
    headers_remove: form.headersRemove,
    cookies: form.cookies,
    response_body_enabled: form.responseBodyEnabled,
    response_body: form.responseBody,
    response_body_content_type: form.responseBodyContentType,
    response_body_file_path: form.responseBodyFilePath,
    url_remap_enabled: form.urlRemapEnabled,
    url_remap_target: form.urlRemapTarget,
  };
}
