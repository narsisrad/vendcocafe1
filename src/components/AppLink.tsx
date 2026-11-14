import React from 'react';
import { useStore } from '../context/StoreContext';

interface AppLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string;
  children: React.ReactNode;
}

export function AppLink({ to, onClick, className = '', children, ...rest }: AppLinkProps) {
  const { navigate } = useStore();

  return (
    <a
      href={to}
      onClick={(e) => {
        onClick?.(e);
        if (
          e.defaultPrevented ||
          e.button !== 0 ||
          e.metaKey ||
          e.ctrlKey ||
          e.shiftKey ||
          e.altKey
        ) {
          return;
        }
        e.preventDefault();
        navigate(to);
      }}
      className={`cursor-pointer ${className}`}
      {...rest}
    >
      {children}
    </a>
  );
}
