import { FolderOpen } from 'lucide-react'
import CrudPage from '../components/CrudPage'
import Badge from '../components/ui/Badge'
import api from '../utils/api'
import { useAuth } from '../context/AuthContext'

const formatSize = (bytes) => {
  if (!bytes) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function Documents() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const fields = [
    { name: 'name', label: 'Nom du document', required: true, colSpan: 2 },
    {
      name: 'type',
      label: 'Type',
      type: 'select',
      required: true,
      options: [
        { value: 'contract', label: 'Contrat' },
        { value: 'id', label: "Pièce d'identité" },
        { value: 'certificate', label: 'Certificat' },
        { value: 'transcript', label: 'Relevé' },
        { value: 'other', label: 'Autre' }
      ]
    },
    { name: 'userId', label: 'Propriétaire (ID)', type: 'number', required: true },
    { name: 'filePath', label: 'Chemin du fichier', required: true, colSpan: 2 },
    { name: 'fileSize', label: 'Taille (octets)', type: 'number' },
    { name: 'mimeType', label: 'Type MIME', placeholder: 'application/pdf' }
  ]

  return (
    <CrudPage
      title="Documents"
      subtitle="Contrats, justificatifs et pièces administratives"
      createLabel="Nouveau document"
      searchPlaceholder="Rechercher un document..."
      emptyIcon={FolderOpen}
      canCreate={() => isAdmin}
      canEdit={() => isAdmin}
      canDelete={() => isAdmin}
      fetchData={async ({ page, limit, search }) => {
        const params = new URLSearchParams({ page, limit })
        if (search) params.set('search', search)
        const res = await api.get(`/documents?${params}`)
        // L'API renvoie du snake_case : mapping vers les clés camelCase.
        const data = (res.data.data || []).map((row) => ({
          ...row,
          userName: row.user_name ?? row.userName,
          fileSize: row.file_size ?? row.fileSize,
          mimeType: row.mime_type ?? row.mimeType,
          uploadedAt: row.uploaded_at ?? row.uploadedAt,
          userId: row.user_id ?? row.userId,
          studentId: row.student_id ?? row.studentId,
          filePath: row.file_path ?? row.filePath
        }))
        return { data, pagination: res.data.pagination }
      }}
      onCreate={(values) => api.post('/documents', values)}
      onUpdate={(id, values) => api.put(`/documents/${id}`, values)}
      onDelete={(id) => api.delete(`/documents/${id}`)}
      fields={fields}
      columns={[
        { key: 'name', label: 'Nom', render: (item) => <span className="font-medium">{item.name}</span> },
        {
          key: 'type',
          label: 'Type',
          render: (item) => <Badge variant="info">{item.type}</Badge>
        },
        { key: 'userName', label: 'Propriétaire', render: (item) => item.userName || '-' },
        { key: 'fileSize', label: 'Taille', render: (item) => formatSize(item.fileSize) },
        { key: 'mimeType', label: 'MIME', render: (item) => item.mimeType || '-' },
        {
          key: 'uploadedAt',
          label: 'Ajouté le',
          render: (item) => (item.uploadedAt ? new Date(item.uploadedAt).toLocaleDateString('fr-FR') : '-')
        }
      ]}
    />
  )
}