import { useState } from 'react'
import { Globe, Plus, Search, Pencil, Power, Trash2 } from 'lucide-react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Input from '../components/ui/Input'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { countLevelsForLanguage } from '../data/demoAdministration'
import { useDemoStore } from '../data/demoStore'

let nextId = 100

/**
 * Page Langues — DÉMO.
 * Données 100 % locales (voir `src/data/demoAdministration.js`).
 * Pour brancher le backend : remplacer les setState par les appels
 * `GET/POST/PUT/DELETE /languages` (même forme d'objet).
 */
export default function Languages() {
  // Persisté en localStorage (voir demoStore) : survit au refresh, sans backend.
  const { languages, levels, setLanguages } = useDemoStore()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [error, setError] = useState(null)

  const filtered = languages.filter((language) => {
    const term = search.trim().toLowerCase()
    const matchesSearch =
      !term ||
      language.name.toLowerCase().includes(term) ||
      language.code.toLowerCase().includes(term)
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && language.isActive) ||
      (statusFilter === 'inactive' && !language.isActive)
    return matchesSearch && matchesStatus
  })

  const openCreate = () => {
    setEditing(null)
    setError(null)
    setShowForm(true)
  }

  const openEdit = (language) => {
    setEditing(language)
    setError(null)
    setShowForm(true)
  }

  const handleSubmit = (values) => {
    const code = values.code.trim().toUpperCase()
    const duplicate = languages.some(
      (language) => language.code.toUpperCase() === code && language.id !== editing?.id
    )
    if (duplicate) {
      setError('Ce code est déjà utilisé par une autre langue.')
      return
    }
    const payload = {
      name: values.name.trim(),
      code,
      description: values.description?.trim() || '',
      isActive: values.isActive === true || values.isActive === 'true'
    }
    if (editing) {
      setLanguages((prev) => prev.map((l) => (l.id === editing.id ? { ...l, ...payload } : l)))
    } else {
      nextId += 1
      setLanguages((prev) => [...prev, { id: nextId, flag: '🌐', ...payload }])
    }
    setShowForm(false)
    setEditing(null)
    setError(null)
  }

  const toggleActive = (language) => {
    setLanguages((prev) =>
      prev.map((l) => (l.id === language.id ? { ...l, isActive: !l.isActive } : l))
    )
  }

  const confirmDelete = () => {
    if (countLevelsForLanguage(levels, deleting.id) > 0) {
      setError(
        `Impossible de supprimer « ${deleting.name} » : ${countLevelsForLanguage(levels, deleting.id)} niveaux y sont rattachés.`
      )
      setDeleting(null)
      return
    }
    setLanguages((prev) => prev.filter((l) => l.id !== deleting.id))
    setDeleting(null)
  }

  const fields = [
    { name: 'name', label: 'Nom de la langue', required: true, placeholder: 'Ex : Anglais' },
    { name: 'code', label: 'Code de la langue', required: true, placeholder: 'Ex : EN' },
    {
      name: 'isActive',
      label: 'Statut',
      type: 'select',
      required: true,
      options: [
        { value: 'true', label: 'Actif' },
        { value: 'false', label: 'Inactif' }
      ]
    },
    { name: 'description', label: 'Description (optionnel)', type: 'textarea', colSpan: 2, rows: 2 }
  ]

  const initialValues = editing
    ? {
        name: editing.name,
        code: editing.code,
        isActive: editing.isActive ? 'true' : 'false',
        description: editing.description || ''
      }
    : { isActive: 'true' }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Langues</h1>
          <p className="text-gray-600">Gérez les langues proposées par le centre.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-5 h-5" />
          Ajouter une langue
        </Button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card>
        <div className="mb-4 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Rechercher une langue..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              aria-label="Rechercher une langue"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input md:w-56"
            aria-label="Filtrer par statut"
          >
            <option value="all">Tous les statuts</option>
            <option value="active">Actif</option>
            <option value="inactive">Inactif</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Globe}
            title="Aucune langue trouvée"
            description={
              search || statusFilter !== 'all'
                ? 'Aucune langue ne correspond à votre recherche.'
                : 'Ajoutez votre première langue pour commencer.'
            }
            action={
              <Button onClick={openCreate}>
                <Plus className="w-5 h-5" />
                Ajouter une langue
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Langue</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Code</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Niveaux</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Statut</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((language) => (
                  <tr key={language.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <span className="mr-2 text-xl" aria-hidden="true">
                        {language.flag || '🌐'}
                      </span>
                      <span className="font-medium text-gray-900">{language.name}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono font-semibold text-gray-700">{language.code}</span>
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {countLevelsForLanguage(levels, language.id)}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={language.isActive ? 'success' : 'default'}>
                        {language.isActive ? 'Actif' : 'Inactif'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(language)}
                          aria-label={`Modifier ${language.name}`}
                          title="Modifier"
                          className="p-2 text-gray-400 hover:text-primary-600 transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => toggleActive(language)}
                          aria-label={`${language.isActive ? 'Désactiver' : 'Activer'} ${language.name}`}
                          title={language.isActive ? 'Désactiver' : 'Activer'}
                          className="p-2 text-gray-400 hover:text-yellow-600 transition-colors"
                        >
                          <Power className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setError(null)
                            setDeleting(language)
                          }}
                          aria-label={`Supprimer ${language.name}`}
                          title="Supprimer"
                          className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showForm && (
        <Modal
          title={editing ? `Modifier ${editing.name}` : 'Ajouter une langue'}
          onClose={() => {
            setShowForm(false)
            setEditing(null)
            setError(null)
          }}
          fields={fields}
          initialValues={initialValues}
          onSubmit={handleSubmit}
          error={error}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(deleting)}
        title="Supprimer la langue"
        message={
          deleting
            ? `Supprimer « ${deleting.name} » (${deleting.code}) ? Cette action est irréversible.`
            : ''
        }
        confirmText="Supprimer"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
