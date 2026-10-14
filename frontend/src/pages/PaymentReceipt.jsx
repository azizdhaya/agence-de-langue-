import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../utils/api'
import { formatMillimes } from '../utils/money'
import { Printer, ArrowLeft } from 'lucide-react'
import Spinner from '../components/ui/Spinner'

const METHOD_LABELS = {
  cash: 'Espèces',
  card: 'Carte',
  transfer: 'Virement',
  check: 'Chèque',
  other: 'Autre'
}

/**
 * Printable payment receipt (browser print, no server-side PDF). Standalone
 * page, outside the app layout, so printing shows the receipt and nothing else.
 */
export default function PaymentReceipt() {
  const { id } = useParams()
  const [payment, setPayment] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    api.get(`/payments/${id}`)
      .then((res) => { if (!cancelled) setPayment(res.data?.data ?? res.data) })
      .catch((err) => {
        if (!cancelled) {
          setError(err.response?.data?.error?.message || err.response?.data?.error || 'Reçu introuvable')
        }
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error || !payment) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-gray-600">
        <p>{error || 'Reçu introuvable'}</p>
        <Link to="/students" className="btn-secondary">Retour</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8 print:bg-white print:py-0">
      <div className="mx-auto max-w-3xl bg-white p-8 shadow print:max-w-none print:shadow-none">
        <div className="mb-6 flex items-center justify-between print:hidden">
          <Link to="/students" className="btn-secondary flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Retour
          </Link>
          <button onClick={() => window.print()} className="btn-primary flex items-center gap-2">
            <Printer className="w-4 h-4" />
            Imprimer
          </button>
        </div>

        <header className="mb-8 flex items-start justify-between border-b border-gray-200 pb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Centre de Langue</h1>
            <p className="text-sm text-gray-500">Reçu de paiement</p>
          </div>
          <div className="text-right text-sm text-gray-600">
            <p className="font-semibold text-gray-900">Reçu n° {String(payment.id).padStart(5, '0')}</p>
            <p>{payment.paid_at ? new Date(payment.paid_at).toLocaleDateString('fr-FR') : '-'}</p>
          </div>
        </header>

        <section className="mb-6 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Reçu de</p>
            <p className="font-medium text-gray-900">{payment.student_name || '-'}</p>
            {payment.student_email && <p className="text-gray-500">{payment.student_email}</p>}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Moyen de paiement</p>
            <p className="font-medium text-gray-900">{METHOD_LABELS[payment.method] || payment.method}</p>
            {payment.reference && <p className="text-gray-500">Réf. {payment.reference}</p>}
          </div>
        </section>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="py-2 font-medium">Cours</th>
              <th className="py-2 font-medium">Module</th>
              <th className="py-2 font-medium">Sous-module</th>
              <th className="py-2 text-right font-medium">Montant</th>
            </tr>
          </thead>
          <tbody>
            {(payment.allocations || []).map((allocation) => (
              <tr key={allocation.id} className="border-b border-gray-100">
                <td className="py-2 text-gray-700">{allocation.course_name || '-'}</td>
                <td className="py-2 text-gray-700">{allocation.module_name}</td>
                <td className="py-2 text-gray-700">{allocation.submodule_name}</td>
                <td className="py-2 text-right text-gray-900">{formatMillimes(allocation.amount_millimes)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="py-3 text-right font-semibold text-gray-900">Total payé</td>
              <td className="py-3 text-right font-bold text-gray-900">{formatMillimes(payment.amount_millimes)}</td>
            </tr>
          </tfoot>
        </table>

        {payment.recorded_by_name && (
          <p className="mt-6 text-xs text-gray-500">Encaissé par {payment.recorded_by_name}.</p>
        )}
        <p className="mt-2 text-xs text-gray-400">
          Ce reçu atteste du paiement ci-dessus. Aucun frais annexe n'est appliqué.
        </p>
      </div>
    </div>
  )
}
