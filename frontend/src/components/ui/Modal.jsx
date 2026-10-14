import { useState, useEffect, useId } from 'react'
import { X } from 'lucide-react'
import Button from './Button'
import Input from './Input'

/**
 * Modal dialog with a generated, accessible form.
 *
 * Field definition:
 *   { name, label, type?, options?, required?, placeholder?, colSpan?, rows?, step? }
 *
 * Supported types: text, email, tel, number, date, time, textarea, select, checkbox
 *
 * @param {Function} [props.onFieldChange] optional (name, value, values) => patch.
 *   Called after every change; the returned object is merged into the form
 *   values, so a page can auto-fill dependent fields (e.g. a course filling
 *   its group defaults) without owning the form state.
 */
export default function Modal({
  title,
  onClose,
  fields,
  initialValues = {},
  onSubmit,
  saving = false,
  error = null,
  onFieldChange = null
}) {
  const formId = useId()

  const [values, setValues] = useState(() => {
    const initial = {}
    for (const field of fields) {
      initial[field.name] = initialValues[field.name] ?? field.defaultValue ?? ''
    }
    return initial
  })

  const [errors, setErrors] = useState({})

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleChange = (name, value) => {
    setValues((prev) => {
      const next = { ...prev, [name]: value }
      if (onFieldChange) {
        const patch = onFieldChange(name, value, next) || {}
        return { ...next, ...patch }
      }
      return next
    })
    setErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  const validate = () => {
    const nextErrors = {}
    for (const field of fields) {
      const value = values[field.name]
      if (field.required && (value === '' || value === null || value === undefined)) {
        nextErrors[field.name] = 'Ce champ est requis'
      }
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validate()) return
    onSubmit(values)
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fields.map((field) => {
              const fieldId = `${formId}-${field.name}`
              const errorId = `${fieldId}-error`

              if (field.type === 'textarea') {
                return (
                  <div key={field.name} className={field.colSpan === 2 ? 'sm:col-span-2' : ''}>
                    <label htmlFor={fieldId} className="label">
                      {field.label}
                    </label>
                    <textarea
                      id={fieldId}
                      className="input"
                      rows={field.rows || 3}
                      placeholder={field.placeholder}
                      value={values[field.name] ?? ''}
                      onChange={(e) => handleChange(field.name, e.target.value)}
                    />
                    {errors[field.name] && (
                      <p id={errorId} className="mt-1 text-sm text-red-600">
                        {errors[field.name]}
                      </p>
                    )}
                  </div>
                )
              }

              if (field.type === 'select') {
                return (
                  <div key={field.name} className={field.colSpan === 2 ? 'sm:col-span-2' : ''}>
                    <label htmlFor={fieldId} className="label">
                      {field.label}
                    </label>
                    <select
                      id={fieldId}
                      className="input"
                      value={values[field.name] ?? ''}
                      onChange={(e) => handleChange(field.name, e.target.value)}
                    >
                      <option value="">{field.placeholder || 'Sélectionner...'}</option>
                      {field.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    {errors[field.name] && (
                      <p id={errorId} className="mt-1 text-sm text-red-600">
                        {errors[field.name]}
                      </p>
                    )}
                  </div>
                )
              }

              if (field.type === 'checkbox') {
                return (
                  <div key={field.name} className={field.colSpan === 2 ? 'sm:col-span-2' : ''}>
                    <label className="flex items-center gap-2 pt-6">
                      <input
                        id={fieldId}
                        type="checkbox"
                        checked={Boolean(values[field.name])}
                        onChange={(e) => handleChange(field.name, e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700">{field.label}</span>
                    </label>
                  </div>
                )
              }

              return (
                <div key={field.name} className={field.colSpan === 2 ? 'sm:col-span-2' : ''}>
                  <Input
                    id={fieldId}
                    label={field.label}
                    type={field.type || 'text'}
                    placeholder={field.placeholder}
                    step={field.step}
                    value={values[field.name] ?? ''}
                    onChange={(e) => handleChange(field.name, e.target.value)}
                    error={errors[field.name]}
                  />
                </div>
              )
            })}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" loading={saving}>
              Enregistrer
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}