import React, { useId } from 'react';

/**
 * Reusable Textarea Primitive (M4.1)
 */
export const Textarea = React.forwardRef(({
  label,
  helperText,
  error,
  id: customId,
  placeholder = '',
  value,
  onChange,
  rows = 4,
  disabled = false,
  required = false,
  className = '',
  style = {},
  ...props
}, ref) => {
  const generatedId = useId();
  const textareaId = customId || generatedId;
  const helperId = `${textareaId}-helper`;
  const errorId = `${textareaId}-error`;

  const textareaStyle = {
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
    resize: 'vertical',
    minHeight: '80px',
  };

  return (
    <div className={`ui-textarea-field ${className}`} style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', width: '100%', ...style }}>
      {label && (
        <label
          htmlFor={textareaId}
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

      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : helperText ? helperId : undefined}
        style={textareaStyle}
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

Textarea.displayName = 'Textarea';
