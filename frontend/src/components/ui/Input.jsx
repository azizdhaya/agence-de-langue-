import { forwardRef, useId } from 'react'

/**
 * Text input with an accessible label.
 * The label is wired to the control with htmlFor/id so screen readers and
 * `getByLabelText` both work.
 */
const Input = forwardRef(function Input(
  { label, error, id, className = '', ...props },
  ref
) {
  const generatedId = useId()
  const inputId = id || `input-${generatedId}`
  const errorId = `${inputId}-error`

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-colors ${
          error ? 'border-red-500' : 'border-gray-300'
        } ${className}`}
        {...props}
      />
      {error && (
        <p id={errorId} className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  )
})

export default Input