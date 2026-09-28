'use client';

import { useState } from 'react';
import {
  useCustomFields,
  createCustomField,
  updateCustomField,
  deleteCustomField,
  type CustomField,
  type CustomFieldType,
} from '@/lib/hooks/use-custom-fields';
import { Loader2, Plus, Trash2, Edit2 } from 'lucide-react';
import { toast } from 'sonner';

const EMPTY_FORM = {
  fieldName: '',
  fieldType: 'text' as CustomFieldType,
  entityType: 'customer',
  required: false,
  description: '',
};

export default function CustomFieldsPage() {
  const { fields, isLoading, mutate } = useCustomFields();
  const [showModal, setShowModal] = useState(false);
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);

  async function handleSave() {
    try {
      if (!formData.fieldName || !formData.entityType) {
        toast.error('A mezőnév és az entitás típusa kötelező');
        return;
      }

      if (editingField) {
        await updateCustomField(editingField.id, {
          fieldName: formData.fieldName,
          description: formData.description,
          required: formData.required,
        });
        toast.success('Mező frissítve');
      } else {
        await createCustomField(formData);
        toast.success('Mező létrehozva');
      }

      setShowModal(false);
      setEditingField(null);
      setFormData(EMPTY_FORM);
      mutate();
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? (editingField ? 'Frissítés sikertelen' : 'Létrehozás sikertelen'));
    }
  }

  async function handleDelete(fieldId: string) {
    if (!confirm('Biztos törlöd ezt a mezőt?')) return;

    try {
      await deleteCustomField(fieldId);
      toast.success('Mező törölve');
      mutate();
    } catch (error) {
      toast.error('Törlés sikertelen');
    }
  }

  function handleEdit(field: CustomField) {
    setEditingField(field);
    setFormData({
      fieldName: field.fieldName,
      fieldType: field.fieldType,
      entityType: field.entityType,
      required: field.required,
      description: field.description ?? '',
    });
    setShowModal(true);
  }

  function resetForm() {
    setEditingField(null);
    setFormData(EMPTY_FORM);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Egyedi mezők</h1>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700"
        >
          <Plus className="w-4 h-4" />
          Mező hozzáadása
        </button>
      </div>

      <div className="grid gap-4">
        {fields.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            Még nincs egyedi mező. Hozz létre egyet az induláshoz.
          </div>
        ) : (
          <div className="space-y-2">
            {fields.map((field) => (
              <div
                key={field.id}
                className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition"
              >
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{field.fieldName}</h3>
                  <p className="text-sm text-gray-500">
                    {field.entityType} • {field.fieldType}
                    {field.required && ' • Kötelező'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(field)}
                    className="p-2 hover:bg-gray-200 rounded-lg text-gray-600"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(field.id)}
                    className="p-2 hover:bg-red-100 rounded-lg text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full">
            <div className="p-6 space-y-4">
              <h2 className="text-xl font-bold text-gray-900">
                {editingField ? 'Mező szerkesztése' : 'Új mező'}
              </h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mezőnév
                </label>
                <input
                  type="text"
                  value={formData.fieldName}
                  onChange={(e) => setFormData({ ...formData, fieldName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Típus
                </label>
                <select
                  value={formData.fieldType}
                  disabled={!!editingField}
                  onChange={(e) => setFormData({ ...formData, fieldType: e.target.value as CustomFieldType })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-100"
                >
                  <option value="text">Szöveg</option>
                  <option value="textarea">Hosszú szöveg</option>
                  <option value="number">Szám</option>
                  <option value="boolean">Igen/Nem</option>
                  <option value="date">Dátum</option>
                  <option value="select">Lenyíló lista</option>
                  <option value="multiselect">Több választás</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Entitás
                </label>
                <select
                  value={formData.entityType}
                  disabled={!!editingField}
                  onChange={(e) => setFormData({ ...formData, entityType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-100"
                >
                  <option value="customer">Ügyfél</option>
                  <option value="project">Projekt</option>
                  <option value="deal">Ügylet</option>
                  <option value="task">Feladat</option>
                  <option value="quote">Árajánlat</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="required"
                  checked={formData.required}
                  onChange={(e) => setFormData({ ...formData, required: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <label htmlFor="required" className="text-sm text-gray-700">
                  Kötelező
                </label>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
                >
                  Mégse
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700"
                >
                  {editingField ? 'Frissítés' : 'Létrehozás'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
