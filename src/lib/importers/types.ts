import type { Collection, Folder, Request } from '@/lib/db';

export interface ImportWarning {
  field: string;
  message: string;
  severity: 'info' | 'warning';
}

export interface ImportResult {
  collection: Omit<Collection, 'created_at' | 'updated_at'>;
  folders: Omit<Folder, 'created_at' | 'updated_at'>[];
  requests: Omit<Request, 'created_at' | 'updated_at'>[];
  warnings: ImportWarning[];
}

export type VendorType = 'postman' | 'insomnia';
