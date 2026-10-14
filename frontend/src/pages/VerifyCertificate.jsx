import { useState } from 'react'
import { Award, Search, CheckCircle, XCircle } from 'lucide-react'
import api from '../utils/api'

/**
 * Public certificate verification page.
 * Intentionally not wrapped in PrivateRoute: anyone holding a certificate
 * number must be able to confirm its authenticity.
 */
export default function VerifyCertificate() {
  const [code, setCode] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await api.get(`/certificates/verify/${encodeURIComponent(code.trim())}`)
      setResult(res.data.data)
    } catch (err) {
      const message =
        err.response?.data?.error?.message ||
        (err.response?.status === 404
          ? 'Certificat introuvable'
          : 'Erreur de vérification')
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-4">
            <Award className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Vérification de certificat</h1>
          <p className="text-gray-600 mt-2">
            Saisissez le numéro de certificat pour confirmer son authenticité
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label" htmlFor="cert-code">
                Numéro de certificat
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="cert-code"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="input pl-10"
                  placeholder="CERT-2024-001"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-3 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
              ) : (
                'Vérifier'
              )}
            </button>
          </form>

          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-800">Certificat non valide</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          )}

          {result && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-green-800">Certificat authentique</p>
                  <dl className="mt-3 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-green-700">Numéro</dt>
                      <dd className="font-mono font-medium text-green-900">
                        {result.certificateNumber}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-green-700">Candidat</dt>
                      <dd className="font-medium text-green-900">{result.studentName}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-green-700">Niveau</dt>
                      <dd className="font-medium text-green-900">{result.level}</dd>
                    </div>
                    {result.score != null && (
                      <div className="flex justify-between">
                        <dt className="text-green-700">Score</dt>
                        <dd className="font-medium text-green-900">{result.score}</dd>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <dt className="text-green-700">Délivré le</dt>
                      <dd className="font-medium text-green-900">
                        {new Date(result.issueDate).toLocaleDateString('fr-FR')}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}