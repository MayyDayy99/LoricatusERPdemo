import useSWR from 'swr';
import { apiClient } from '../api-client';

/**
 * Generikus (entity-független) tenant-szintű custom-field-ek — v2.14.
 * FONTOS: ez NEM ugyanaz mint a szoba-adatlap `project_category_custom_fields`
 * (lásd [[use-projects]] `useFieldLayout`). Az entity a backend-en camelCase-
 * ben van (TypeORM auto-map), ezért a hook is camelCase-t vár.
 */
export type CustomFieldType = 'text' | 'number' | 'boolean' | 'date' | 'select' | 'multiselect' | 'textarea';

export interface CustomField {
  id: string;
  fieldName: string;
  fieldType: CustomFieldType;
  entityType: string;
  description?: string;
  options?: Record<string, unknown>;
  required: boolean;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomFieldInput {
  fieldName: string;
  fieldType: CustomFieldType;
  entityType: string;
  description?: string;
  options?: Record<string, unknown>;
  required?: boolean;
  sortOrder?: number;
}

const fetcher = (url: string) => apiClient.get(url).then((r) => r.data);

export function useCustomFields() {
  const { data, error, isLoading, mutate } = useSWR<CustomField[]>('/custom-fields', fetcher);
  return { fields: data ?? [], error, isLoading, mutate };
}

export function useCustomFieldsByEntity(entityType: string | null) {
  const { data, error, isLoading, mutate } = useSWR<CustomField[]>(
    entityType ? `/custom-fields/by-entity/${entityType}` : null,
    fetcher,
  );
  return { fields: data ?? [], error, isLoading, mutate };
}

export async function createCustomField(input: CustomFieldInput): Promise<CustomField> {
  const res = await apiClient.post('/custom-fields', input);
  return res.data;
}

export async function updateCustomField(
  id: string,
  patch: Partial<Omit<CustomFieldInput, 'entityType' | 'fieldType'>>,
): Promise<CustomField> {
  const res = await apiClient.put(`/custom-fields/${id}`, patch);
  return res.data;
}

export async function deleteCustomField(id: string): Promise<void> {
  await apiClient.delete(`/custom-fields/${id}`);
}

export async function deactivateCustomField(id: string): Promise<CustomField> {
  const res = await apiClient.put(`/custom-fields/${id}/deactivate`);
  return res.data;
}
