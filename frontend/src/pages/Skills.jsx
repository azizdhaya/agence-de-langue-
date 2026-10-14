import { Target } from 'lucide-react'
import CrudPage from '../components/CrudPage'
import Badge from '../components/ui/Badge'
import api from '../utils/api'
import { useAuth } from '../context/AuthContext'

const fields = [
  { name: 'code', label: 'Code', required: true, placeholder: 'Ex: listening' },
  { name: 'name', label: 'Nom', required: true, placeholder: 'Ex: Compréhension orale' },
  { name: 'description', label: 'Description', type: 'textarea', colSpan: 2 },
  { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true, colSpan: 2 }
]

export default function Skills() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  return (
    <CrudPage
      title="Compétences"
      subtitle="Compétences évaluées par skill"
      createLabel="Nouvelle compétence"
      searchPlaceholder="Rechercher une compétence..."
      emptyIcon={Target}
      canCreate={() => isAdmin}
      canEdit={() => isAdmin}
      canDelete={() => isAdmin}
      fetchData={async ({ page, limit, search }) => {
        const params = new URLSearchParams({ page, limit })
        if (search) params.set('search', search)
        const res = await api.get(`/skills?${params}`)
        return { data: res.data.data || [], pagination: res.data.pagination }
      }}
      onCreate={(values) => api.post('/skills', values)}
      onUpdate={(id, values) => api.put(`/skills/${id}`, values)}
      onDelete={(id) => api.delete(`/skills/${id}`)}
      fields={fields}
      columns={[
        {
          key: 'code',
          label: 'Code',
          render: (item) => <span className="font-mono font-semibold">{item.code}</span>
        },
        { key: 'name', label: 'Nom', render: (item) => <span className="font-medium">{item.name}</span> },
        { key: 'description', label: 'Description' },
        {
          key: 'isActive',
          label: 'Statut',
          render: (item) => (
            <Badge variant={item.isActive ? 'success' : 'default'}>
              {item.isActive ? 'Active' : 'Inactive'}
            </Badge>
          )
        }
      ]}
    />
  )
}