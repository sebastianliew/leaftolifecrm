import { useState, useCallback, useMemo } from 'react'
import { z } from 'zod'
import { getErrorMessages } from '@/lib/validation/schemas'

interface ValidationState {
  errors: Record<string, string>
  isValid: boolean
  isValidating: boolean
}

interface UseValidationOptions {
  mode?: 'onChange' | 'onBlur' | 'onSubmit'
  revalidateOn?: 'onChange' | 'onBlur'
  debounceMs?: number
}

export function useValidation<T>(
  schema: z.ZodSchema<T>,
  options: UseValidationOptions = {}
) {
  const {
    mode = 'onChange',
    revalidateOn = 'onChange',
    debounceMs = 300
  } = options

  const [state, setState] = useState<ValidationState>({
    errors: {},
    isValid: true,
    isValidating: false
  })

  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [debounceTimers, setDebounceTimers] = useState<Record<string, NodeJS.Timeout>>({})

  // Validate entire form
  const validate = useCallback(
    async (data: unknown): Promise<{ isValid: boolean; errors: Record<string, string> }> => {
      setState(prev => ({ ...prev, isValidating: true }))

      try {
        await schema.parseAsync(data)
        setState({
          errors: {},
          isValid: true,
          isValidating: false
        })
        return { isValid: true, errors: {} }
      } catch (error) {
        if (error instanceof z.ZodError) {
          const errors = getErrorMessages(error)
          setState({
            errors,
            isValid: false,
            isValidating: false
          })
          return { isValid: false, errors }
        }
        throw error
      }
    },
    [schema]
  )

  // Validate single field
  const validateField = useCallback(
    async (fieldName: string, value: unknown, allData: unknown): Promise<string | undefined> => {
      try {
        // Create a partial schema for the field
        const fieldPath = fieldName.split('.')
        let fieldSchema: z.ZodSchema = schema

        // Navigate to the field schema
        for (const path of fieldPath) {
          if (fieldSchema instanceof z.ZodObject) {
            fieldSchema = fieldSchema.shape[path]
          }
        }

        await fieldSchema.parseAsync(value)

        // Also validate the entire form to check for dependencies
        const fullValidation = await schema.safeParseAsync(allData)
        if (!fullValidation.success) {
          const errors = getErrorMessages(fullValidation.error)
          if (errors[fieldName]) {
            return errors[fieldName]
          }
        }

        return undefined
      } catch (error) {
        if (error instanceof z.ZodError) {
          return error.issues[0]?.message
        }
        return 'Validation error'
      }
    },
    [schema]
  )

  // Handle field change with debouncing
  const handleFieldChange = useCallback(
    (fieldName: string, value: unknown, allData: unknown) => {
      // Clear existing timer
      if (debounceTimers[fieldName]) {
        clearTimeout(debounceTimers[fieldName])
      }

      if (mode === 'onChange' || (touched[fieldName] && revalidateOn === 'onChange')) {
        const timer = setTimeout(async () => {
          const error = await validateField(fieldName, value, allData)
          setState(prev => ({
            ...prev,
            errors: {
              ...prev.errors,
              [fieldName]: error || ''
            }
          }))
          
          // Remove error if valid
          if (!error) {
            setState(prev => {
              const newErrors = { ...prev.errors }
              delete newErrors[fieldName]
              return {
                ...prev,
                errors: newErrors,
                isValid: Object.keys(newErrors).length === 0
              }
            })
          }
        }, debounceMs)

        setDebounceTimers(prev => ({
          ...prev,
          [fieldName]: timer
        }))
      }
    },
    [mode, touched, revalidateOn, debounceMs, validateField, debounceTimers]
  )

  // Handle field blur
  const handleFieldBlur = useCallback(
    async (fieldName: string, value: unknown, allData: unknown) => {
      setTouched(prev => ({ ...prev, [fieldName]: true }))

      if (mode === 'onBlur' || revalidateOn === 'onBlur') {
        const error = await validateField(fieldName, value, allData)
        setState(prev => ({
          ...prev,
          errors: {
            ...prev.errors,
            [fieldName]: error || ''
          }
        }))

        // Remove error if valid
        if (!error) {
          setState(prev => {
            const newErrors = { ...prev.errors }
            delete newErrors[fieldName]
            return {
              ...prev,
              errors: newErrors,
              isValid: Object.keys(newErrors).length === 0
            }
          })
        }
      }
    },
    [mode, revalidateOn, validateField]
  )

  // Clear errors
  const clearErrors = useCallback((fieldNames?: string[]) => {
    if (fieldNames) {
      setState(prev => {
        const newErrors = { ...prev.errors }
        fieldNames.forEach(field => delete newErrors[field])
        return {
          ...prev,
          errors: newErrors,
          isValid: Object.keys(newErrors).length === 0
        }
      })
    } else {
      setState({
        errors: {},
        isValid: true,
        isValidating: false
      })
    }
  }, [])

  // Reset validation state
  const reset = useCallback(() => {
    setState({
      errors: {},
      isValid: true,
      isValidating: false
    })
    setTouched({})
    
    // Clear all timers
    Object.values(debounceTimers).forEach(timer => clearTimeout(timer))
    setDebounceTimers({})
  }, [debounceTimers])

  // Get field error
  const getFieldError = useCallback(
    (fieldName: string): string | undefined => {
      return touched[fieldName] || mode === 'onChange' ? state.errors[fieldName] : undefined
    },
    [touched, mode, state.errors]
  )

  // Check if field is touched
  const isFieldTouched = useCallback(
    (fieldName: string): boolean => {
      return touched[fieldName] || false
    },
    [touched]
  )

  // Cleanup timers on unmount
  useMemo(() => {
    return () => {
      Object.values(debounceTimers).forEach(timer => clearTimeout(timer))
    }
  }, [debounceTimers])

  return {
    errors: state.errors,
    isValid: state.isValid,
    isValidating: state.isValidating,
    touched,
    validate,
    validateField,
    handleFieldChange,
    handleFieldBlur,
    clearErrors,
    reset,
    getFieldError,
    isFieldTouched
  }
}