import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, Search, Pencil, Trash2, RefreshCw } from 'lucide-react'
import Card from './ui/Card'
import Button from './ui/Button'
import Badge from './ui/Badge'
import Input from './ui/Input'
import Spinner from './ui/Spinner'
import EmptyState from './ui/EmptyState'
import ErrorState from './ui/ErrorState'
import ConfirmDialog from './ui/ConfirmDialog'
import Modal from './ui/Modal'

/**
 * Generic CRUD page.
 *
 * Each module supplies its own data-fetching and formatting so this component
 * only owns list rendering, search, pagination and the form modal.
 *
 * @param {object} props
 * @param {string} props.title page heading
 * @param {string} [props.subtitle] secondary text under the heading
 * @param {Function} props.fetchData async ({ page, limit, search }) => { data, pagination }
 * @param {Function} props.onCreate async (values) => void
 * @param {Function} props.onUpdate async (id, values) => void
 * @param {Function} props.onDelete async (id) => void
 * @param {Array} props.columns column definitions
 * @param {Array} props.fields form field definitions
 * @param {Function} [props.renderRow] optional custom row renderer
 * @param {Function} [props.canCreate] permission check for the create action
 * @param {Function} [props.canEdit] permission check for editing, called with the row
 * @param {Function} [props.canDelete] permission check for deleting, called with the row
 * @param {Function} [props.rowActions] optional extra buttons per row, called with the row
 * @param {string} [props.createLabel] label of the create button
 * @param {React.ReactNode} [props.headerActions] extra buttons next to the create button
 * @param {string} [props.searchPlaceholder] search input placeholder
 * @param {string} [props.initialSearch] prefilled search (e.g. from a deep link)
 * @param {React.ComponentType} [props.emptyIcon] icon for the empty state
 * @param {Function} [props.formFieldChange] optional (name, value, values) => patch,
 *   forwarded to the form modal to auto-fill dependent fields
 */
export default function CrudPage({
  title,
  subtitle,
  fetchData,
  onCreate,
  onUpdate,
  onDelete,
  columns,
  fields,
  renderRow,
  canCreate = () => true,
  canEdit = () => true,
  canDelete = () => true,
  rowActions = null,
  createLabel = 'Créer',
  headerActions = null,
  searchPlaceholder = 'Rechercher...',
  initialSearch = '',
  emptyIcon,
  formFieldChange = null
}) {
  const [items, setItems] = useState([])
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 })
  const [search, setSearch] = useState(initialSearch)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [deleteError, setDeleteError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchData({ page, limit: pagination.limit, search })
      const data = Array.isArray(result) ? result : result?.data || []
      setItems(data)
      if (!Array.isArray(result) && result?.pagination) {
        setPagination(result.pagination)
      } else {
        setPagination((p) => ({ ...p, total: data.length }))
      }
    } catch (err) {
      setError(err.message || 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [fetchData, page, pagination.limit, search])

  useEffect(() => {
    load()
  }, [load])

  // Debounce search so we do not fire a request per keystroke
  useEffect(() => {
    const timer = setTimeout(() => setPage(1), 250)
    return () => clearTimeout(timer)
  }, [search])

  const openCreate = () => {
    setEditing(null)
    setSubmitError(null)
    setShowForm(true)
  }

  const openEdit = (item) => {
    setEditing(item)
    setSubmitError(null)
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditing(null)
    setSubmitError(null)
  }

  const handleSubmit = async (values) => {
    setSaving(true)
    setSubmitError(null)
    try {
      if (editing) {
        await onUpdate(editing.id, values)
      } else {
        await onCreate(values)
      }
      closeForm()
      await load()
    } catch (err) {
      // Visible dans la modale au lieu d'un échec silencieux.
      setSubmitError(err.response?.data?.error?.message || err.message || 'Enregistrement impossible')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (item) => {
    setDeleteError(null)
    try {
      await onDelete(item.id)
      setDeleting(null)
      await load()
    } catch (err) {
      // L'erreur reste visible au lieu d'un échec silencieux.
      setDeleteError(err.response?.data?.error?.message || err.message || 'Suppression impossible')
    }
  }

  const initialValues = useMemo(() => {
    if (!editing) return {}
    const values = {}
    for (const field of fields) {
      values[field.name] = editing[field.name] ?? ''
    }
    return values
  }, [editing, fields])

  const totalPages = pagination.totalPages || 0

  // canEdit/canDelete receive the row, so a page can hide the action on rows the
  // API would refuse to change anyway (e.g. a paid invoice).
  const rowCanEdit = (item) => canEdit(item)
  const rowCanDelete = (item) => canDelete(item)
  const hasRowActions = typeof rowActions === 'function'
  const anyRowEditable = items.some((item) => rowCanEdit(item) || rowCanDelete(item))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {subtitle && <p className="text-gray-600">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={load} aria-label="Rafraichir">
            <RefreshCw className="w-4 h-4" />
          </Button>
          {headerActions}
          {canCreate() && (
            <Button onClick={openCreate}>
              <Plus className="w-5 h-5" />
              {createLabel}
            </Button>
          )}
        </div>
      </div>

      <Card>
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              aria-label={searchPlaceholder}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={emptyIcon}
            title="Aucun résultat"
            description={search ? 'Aucun élément ne correspond à votre recherche.' : 'Aucun élément pour le moment.'}
            action={
              canCreate() && !search ? (
                <Button onClick={openCreate}>
                  <Plus className="w-5 h-5" />
                  {createLabel}
                </Button>
              ) : null
            }
          />
        ) : (
          <div className="overflow-x-auto">
            {renderRow ? (
              renderRow({
                items,
                columns,
                onEdit: anyRowEditable ? openEdit : null,
                onDelete: anyRowEditable
                  ? (item) => {
                      setDeleteError(null)
                      setDeleting(item)
                    }
                  : null
              })
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    {columns.map((col) => (
                      <th key={col.key} className="text-left py-3 px-4 font-medium text-gray-600">
                        {col.label}
                      </th>
                    ))}
                    {(anyRowEditable || hasRowActions) && (
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                      {columns.map((col) => (
                        <td key={col.key} className="py-3 px-4">
                          {col.render ? col.render(item) : (item[col.key] ?? '-')}
                        </td>
                      ))}
                      {(rowCanEdit(item) || rowCanDelete(item) || hasRowActions) && (
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {rowCanEdit(item) && (
                              <button
                                onClick={() => openEdit(item)}
                                aria-label={`Modifier ${item.id}`}
                                className="p-2 text-gray-400 hover:text-primary-600 transition-colors"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                            )}
                            {rowCanDelete(item) && (
                              <button
                                onClick={() => {
                                  setDeleteError(null)
                                  setDeleting(item)
                                }}
                                aria-label={`Supprimer ${item.id}`}
                                className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                            {hasRowActions && rowActions(item)}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Page {pagination.page} sur {totalPages} ({pagination.total} éléments)
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Précédent
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Suivant
              </Button>
            </div>
          </div>
        )}
      </Card>

      {showForm && (
        <Modal
          title={editing ? 'Modifier' : createLabel}
          onClose={closeForm}
          fields={fields}
          initialValues={initialValues}
          onSubmit={handleSubmit}
          saving={saving}
          error={submitError}
          onFieldChange={formFieldChange}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(deleting)}
        title="Supprimer cet élément ?"
        message="Cette action est irréversible."
        confirmText="Supprimer"
        onConfirm={() => deleting && handleDelete(deleting)}
        onCancel={() => {
          setDeleting(null)
          setDeleteError(null)
        }}
      />

      {deleteError && (
        <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {deleteError}
        </div>
      )}
    </div>
  )
}

export { Badge }