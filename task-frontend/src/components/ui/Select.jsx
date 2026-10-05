import React, { useId } from 'react';

/**
 * Reusable Select Primitive (M4.1)
 */
export const Select = React.forwardRef(({
  label,
  helperText,
  error,
  id: customId,
  value,
  onChange,
  options = [],
  children,
  disabled = false,
  required = false,
  className = '',
  style = {},
  ...props
}, ref) => {
  const generatedId = useId();
  const selectId = customId || generatedId;
  const helperId = `${selectId}-helper`;
  const errorId = `${selectId}-error`;

  const selectStyle = {
    width: '100%',
    padding: '0.625rem 2rem 0.625rem 0.875rem',
    fontSize: 'var(--font-size-md)',
    fontFamily: 'inherit',
    color: 'var(--color-text-primary)',
    backgroundColor: disabled ? 'var(--color-bg-subtle)' : 'var(--color-surface)',
    border: `1px solid ${error ? 'var(--color-danger)' : 'var(--color-border-strong)'}`,
    borderRadius: 'var(--radius-md)',
    outline: 'none',
    transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
    minHeight: '44px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23475569%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 0.875rem top 50%',
    backgroundSize: '0.65rem auto',
  };

  return (
    <div className={`ui-select-field ${className}`} style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', width: '100%', ...style }}>
      {label && (
        <label
          htmlFor={selectId}
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

      <select
        ref={ref}
        id={selectId}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : helperText ? helperId : undefined}
        style={selectStyle}
        {...props}
      >
        {options.length > 0
          ? options.map((opt) => (
              <option key={opt.value ?? opt.id} value={opt.value ?? opt.id}>
                {opt.label ?? opt.name}
              </option>
            ))
          : children}
      </select>

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

Select.displayName = 'Select';
