import type { Collection, Folder, KeyValuePair, Request } from '@/lib/db';

export interface ImportWarning {
  field: string;
  message: string;
  severity: 'info' | 'warning';
}

export interface ImportedEnvironment {
  name: string;
  variables: KeyValuePair[];
}

export interface ImportResult {
  collection: Omit<Collection, 'created_at' | 'updated_at'>;
  folders: Omit<Folder, 'created_at' | 'updated_at'>[];
  requests: Omit<Request, 'created_at' | 'updated_at'>[];
  warnings: ImportWarning[];
  environments: ImportedEnvironment[];
}

export type ImportFormat = 'postman-v1' | 'postman-v2' | 'insomnia-v4';
