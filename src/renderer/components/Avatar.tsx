import React from 'react';

interface AvatarProps {
  name: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  status?: 'online' | 'offline' | 'away' | 'busy';
  className?: string;
}

export function Avatar({ name, src, size = 'md', status, className = '' }: AvatarProps) {
  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-xl',
  };

  const statusSizes = {
    sm: 'w-2.5 h-2.5',
    md: 'w-3 h-3',
    lg: 'w-3.5 h-3.5',
    xl: 'w-4 h-4',
  };

  const statusColors = {
    online: 'bg-emerald-500',
    away: 'bg-amber-500',
    busy: 'bg-red-500',
    offline: 'bg-zinc-500',
  };

  const initial = name?.charAt(0).toUpperCase() || '?';

  // Generate consistent color from name
  const colors = [
    'from-violet-500 to-purple-500',
    'from-cyan-500 to-blue-500',
    'from-emerald-500 to-teal-500',
    'from-orange-500 to-amber-500',
    'from-pink-500 to-rose-500',
    'from-indigo-500 to-violet-500',
  ];
  const colorIndex = name?.charCodeAt(0) % colors.length || 0;

  return (
    <div className={`relative inline-flex ${className}`}>
      {src ? (
        <img
          src={src}
          alt={name}
          className={`${sizes[size]} rounded-xl object-cover`}
        />
      ) : (
        <div className={`
          ${sizes[size]} rounded-xl
          bg-gradient-to-br ${colors[colorIndex]}
          flex items-center justify-center
          text-white font-semibold
        `}>
          {initial}
        </div>
      )}
      {status && (
        <div className={`
          absolute -bottom-0.5 -right-0.5 
          ${statusSizes[size]} ${statusColors[status]}
          rounded-full border-2 border-kap-surface
        `} />
      )}
    </div>
  );
}

