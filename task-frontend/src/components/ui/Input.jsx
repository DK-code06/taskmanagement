import React, { useId } from 'react';

/**
 * Reusable Input Primitive (M4.1)
 * Accessible with label, helperText, error, required, disabled
 */
export const Input = React.forwardRef(({
  label,
  helperText,
  error,
  id: customId,
  type = 'text',
  placeholder = '',
  value,
  onChange,
  disabled = false,
  required = false,
  className = '',
  style = {},
  ...props
}, ref) => {
  const generatedId = useId();
  const inputId = customId || generatedId;
  const helperId = `${inputId}-helper`;
  const errorId = `${inputId}-error`;

  const inputStyle = {
    width: '100%',
    padding: '0.625rem 0.875rem',
    fontSize: 'var(--font-size-md)',
    fontFamily: 'inherit',
    color: 'var(--color-text-primary)',
    backgroundColor: disabled ? 'var(--color-bg-subtle)' : 'var(--color-surface)',
    border: `1px solid ${error ? 'var(--color-danger)' : 'var(--color-border-strong)'}`,
    borderRadius: 'var(--radius-md)',
    outline: 'none',
    transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
    minHeight: '44px',
  };

  return (
    <div className={`ui-input-field ${className}`} style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', width: '100%', ...style }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            fontSize: 'var(--font-size-sm)',
            fontWeight: '500',
            color: 'var(--color-text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
          }}
        >
          {label}
          {required && <span style={{ color: 'var(--color-danger)' }} aria-hidden="true">*</span>}
        </label>
      )}

      <input
        ref={ref}
        id={inputId}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : helperText ? helperId : undefined}
        style={inputStyle}
        {...props}
      />

      {error ? (
        <span id={errorId} style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-danger)', fontWeight: '500' }} role="alert">
          {error}
        </span>
      ) : helperText ? (
        <span id={helperId} style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
          {helperText}
        </span>
      ) : null}
    </div>
  );
});

Input.displayName = 'Input';
