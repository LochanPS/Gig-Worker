import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/* ---------- Button ---------- */
type Variant = 'primary' | 'default' | 'quiet' | 'danger';
type Size = 'sm' | 'md';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-[#0A0A0B] border border-accent hover:bg-accent-hover hover:border-accent-hover font-medium',
  default: 'bg-transparent text-text border border-line hover:border-line-strong',
  quiet: 'bg-transparent text-muted border border-transparent hover:text-text',
  danger: 'bg-transparent text-danger border border-danger/60 hover:border-danger',
};

const SIZE: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-[12px]',
  md: 'h-9 px-3.5 text-[13px]',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors duration-150',
        'disabled:opacity-40 disabled:pointer-events-none',
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = 'Button';

/* ---------- Input ---------- */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-9 w-full bg-bg border border-line px-2.5 text-[13px] text-text',
        'placeholder:text-faint transition-colors duration-150',
        'hover:border-line-strong focus:border-line-strong focus:outline-none',
        'disabled:opacity-40',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

/* ---------- Select ---------- */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'h-9 w-full bg-bg border border-line px-2.5 text-[13px] text-text',
        'transition-colors duration-150 hover:border-line-strong focus:border-line-strong focus:outline-none',
        'disabled:opacity-40',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = 'Select';

/* ---------- Field ---------- */
export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="label">
        {label}
      </label>
      {children}
      {hint && !error ? <span className="text-[12px] text-faint">{hint}</span> : null}
      {error ? (
        <span role="alert" className="text-[12px] text-danger">
          {error}
        </span>
      ) : null}
    </div>
  );
}

/* ---------- Panel ---------- */
export function Panel({
  className,
  children,
  ...rest
}: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('border border-line bg-surface', className)} {...rest}>
      {children}
    </div>
  );
}

export function PanelHead({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-line px-4 h-11">
      <h2 className="text-[13px] font-medium text-text">{title}</h2>
      {action}
    </div>
  );
}

/* ---------- Textarea ---------- */
export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'w-full bg-bg border border-line px-2.5 py-2 text-[13px] text-text min-h-[80px]',
        'placeholder:text-faint transition-colors duration-150',
        'hover:border-line-strong focus:border-line-strong focus:outline-none',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';
