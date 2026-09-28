import React from 'react';

interface ChartCardProps {
  title: string;
  children: React.ReactNode;
  viewMoreHref?: string;
  onViewMore?: () => void;
  subtitle?: string;
  headerAction?: React.ReactNode;
}

export const ChartCard: React.FC<ChartCardProps> = ({
  title,
  children,
  viewMoreHref,
  onViewMore,
  subtitle,
  headerAction,
}) => {
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-5 shadow-xs">
      <div className="flex justify-between items-center mb-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text)]">{title}</h3>
          {subtitle && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{subtitle}</p>}
        </div>
        {headerAction || viewMoreHref ? (
          <div className="flex items-center gap-3">
            {headerAction}
            {viewMoreHref && (
              <a href={viewMoreHref} className="text-xs font-medium text-[var(--accent)] hover:underline">
                View more
              </a>
            )}
          </div>
        ) : viewMoreHref ? (
          <a href={viewMoreHref} className="text-xs font-medium text-[var(--accent)] hover:underline">
            View more
          </a>
        ) : onViewMore ? (
          <button onClick={onViewMore} className="text-xs font-medium text-[var(--accent)] hover:underline cursor-pointer">
            View more
          </button>
        ) : null}
      </div>
      <div className="h-[260px] w-full">{children}</div>
    </div>
  );
};
