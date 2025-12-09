import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-kap-surface disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'bg-kap-accent hover:bg-kap-accent-hover text-white focus:ring-kap-accent shadow-lg shadow-kap-accent/25',
    secondary: 'bg-kap-surface-light hover:bg-kap-border text-zinc-200 border border-kap-border focus:ring-zinc-500',
    ghost: 'text-zinc-400 hover:text-white hover:bg-white/5 focus:ring-zinc-500',
    danger: 'bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 focus:ring-red-500',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 size={size === 'sm' ? 14 : size === 'md' ? 16 : 18} className="animate-spin" />
      ) : icon ? (
        icon
      ) : null}
      {children}
    </button>
  );
}

