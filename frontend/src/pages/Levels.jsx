import { useState } from 'react'
import { Layers, Plus, Search, Pencil, Power, Trash2 } from 'lucide-react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Input from '../components/ui/Input'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { initialLanguages, initialLevels } from '../data/demoAdministration'
import { useDemoStore } from '../data/demoStore'

let nextId = 1000

/**
 * Page Niveaux — DÉMO.
 * Données 100 % locales (voir `src/data/demoAdministration.js`).
 * Chaque niveau appartient à une langue (`languageId`) : Anglais →
 * A1 → A2 → B1 → B2 → C1 → C2. Pour brancher le backend : remplacer les
 * setState par les appels `GET/POST/PUT/DELETE /levels` (même forme d'objet).
 */
export default function Levels() {
  // Persisté en localStorage (voir demoStore) : survit au refresh, sans backend.
  const { languages, levels, setLevels } = useDemoStore()
  const [search, setSearch] = useState('')
  const [languageFilter, setLanguageFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [error, setError] = useState(null)

  const languageName = (languageId) =>
    languages.find((language) => language.id === Number(languageId))?.name || '-'

  // Partout où l'on choisit ou affiche une langue : uniquement les actives.
  // (Les niveaux des langues inactives sont déjà masqués du tableau ci-dessus.)
  const selectableLanguages = languages.filter((language) => language.isActive)

  // Règle démo : seuls les niveaux des langues ACTIVES sont affichés.
  // Les niveaux d'une langue inactive existent toujours (conservés pour une
  // réactivation), mais restent masqués tant que la langue est inactive.
  const activeLanguageIds = new Set(
    languages.filter((language) => language.isActive).map((language) => language.id)
  )

  const filtered = levels
    .filter((level) => {
      if (!activeLanguageIds.has(level.languageId)) return false
      const term = search.trim().toLowerCase()
      const matchesSearch =
        !term ||
        level.code.toLowerCase().includes(term) ||
        (level.description || '').toLowerCase().includes(term)
      const matchesLanguage =
        languageFilter === 'all' || level.languageId === Number(languageFilter)
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && level.isActive) ||
        (statusFilter === 'inactive' && !level.isActive)
      return matchesSearch && matchesLanguage && matchesStatus
    })
    .sort((a, b) => a.languageId - b.languageId || a.order - b.order)

  const hiddenCount = levels.filter((level) => !activeLanguageIds.has(level.languageId)).length

  const openCreate = () => {
    setEditing(null)
    setError(null)
    setShowForm(true)
  }

  const openEdit = (level) => {
    setEditing(level)
    setError(null)
    setShowForm(true)
  }

  const handleSubmit = (values) => {
    const order = Number(values.order)
    if (!Number.isInteger(order) || order < 1) {
      setError("L'ordre doit être un nombre entier positif.")
      return
    }
    const payload = {
      code: values.code.trim().toUpperCase(),
      languageId: Number(values.languageId),
      description: values.description?.trim() || '',
      order,
      isActive: values.isActive === true || values.isActive === 'true'
    }
    if (editing) {
      setLevels((prev) => prev.map((l) => (l.id === editing.id ? { ...l, ...payload } : l)))
    } else {
      nextId += 1
      setLevels((prev) => [...prev, { id: nextId, ...payload }])
    }
    setShowForm(false)
    setEditing(null)
    setError(null)
  }

  const toggleActive = (level) => {
    setLevels((prev) =>
      prev.map((l) => (l.id === level.id ? { ...l, isActive: !l.isActive } : l))
    )
  }

  const confirmDelete = () => {
    setLevels((prev) => prev.filter((l) => l.id !== deleting.id))
    setDeleting(null)
  }

  const fields = [
    { name: 'code', label: 'Niveau', required: true, placeholder: 'Ex : B1' },
    {
      name: 'languageId',
      label: 'Langue',
      type: 'select',
      required: true,
      options: selectableLanguages.map((language) => ({ value: language.id, label: language.name }))
    },
    { name: 'description', label: 'Description', required: true, placeholder: 'Ex : Intermédiaire', colSpan: 2 },
    { name: 'order', label: 'Ordre', type: 'number', required: true, placeholder: 'Ex : 3' },
    {
      name: 'isActive',
      label: 'Statut',
      type: 'select',
      required: true,
      options: [
        { value: 'true', label: 'Actif' },
        { value: 'false', label: 'Inactif' }
      ]
    }
  ]

  const initialValues = editing
    ? {
        code: editing.code,
        languageId: editing.languageId,
        description: editing.description || '',
        order: editing.order,
        isActive: editing.isActive ? 'true' : 'false'
      }
    : { isActive: 'true' }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Niveaux</h1>
          <p className="text-gray-600">Gérez les niveaux disponibles pour chaque langue.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-5 h-5" />
          Ajouter un niveau
        </Button>
      </div>

      <Card>
        <div className="mb-4 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Rechercher un niveau..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              aria-label="Rechercher un niveau"
            />
          </div>
          <select
            value={languageFilter}
            onChange={(e) => setLanguageFilter(e.target.value)}
            className="input md:w-56"
            aria-label="Filtrer par langue"
          >
            <option value="all">Toutes les langues</option>
            {selectableLanguages.map((language) => (
              <option key={language.id} value={language.id}>
                {language.name}
              </option>
            ))}
          </select>
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
            icon={Layers}
            title="Aucun niveau trouvé"
            description="Aucun niveau ne correspond à votre recherche."
            action={
              <Button onClick={openCreate}>
                <Plus className="w-5 h-5" />
                Ajouter un niveau
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Niveau</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Langue</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Description</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Ordre</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Statut</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((level) => (
                  <tr key={level.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <Badge variant="primary">{level.code}</Badge>
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-900">
                      {languageName(level.languageId)}
                    </td>
                    <td className="py-3 px-4 text-gray-600">{level.description || '-'}</td>
                    <td className="py-3 px-4 text-gray-600">{level.order}</td>
                    <td className="py-3 px-4">
                      <Badge variant={level.isActive ? 'success' : 'default'}>
                        {level.isActive ? 'Actif' : 'Inactif'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(level)}
                          aria-label={`Modifier le niveau ${level.code}`}
                          title="Modifier"
                          className="p-2 text-gray-400 hover:text-primary-600 transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => toggleActive(level)}
                          aria-label={`${level.isActive ? 'Désactiver' : 'Activer'} le niveau ${level.code}`}
                          title={level.isActive ? 'Désactiver' : 'Activer'}
                          className="p-2 text-gray-400 hover:text-yellow-600 transition-colors"
                        >
                          <Power className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleting(level)}
                          aria-label={`Supprimer le niveau ${level.code}`}
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
        {hiddenCount > 0 && (
          <p className="mt-3 text-xs text-gray-500">
            {hiddenCount} niveau{hiddenCount > 1 ? 'x' : ''} masqué{hiddenCount > 1 ? 's' : ''} :{' '}
            leur langue est inactive. Réactivez la langue pour les afficher.
          </p>
        )}
      </Card>

      {showForm && (
        <Modal
          title={editing ? `Modifier le niveau ${editing.code}` : 'Ajouter un niveau'}
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
        title="Supprimer le niveau"
        message={
          deleting
            ? `Supprimer le niveau « ${deleting.code} » (${languageName(deleting.languageId)}) ? Cette action est irréversible.`
            : ''
        }
        confirmText="Supprimer"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
