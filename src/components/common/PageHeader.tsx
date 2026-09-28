import React from "react";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  desc?: string;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  eyebrow,
  title,
  desc,
  actions,
  className = "",
}) => {
  return (
    <div className={`flex items-end justify-between gap-4 mb-5 ${className}`}>
      <div className="min-w-0">
        {eyebrow && (
          <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">
            {eyebrow}
          </div>
        )}
        <h1 className="text-[22px] font-bold text-[var(--text)] leading-tight tracking-tight">
          {title}
        </h1>
        {desc && (
          <p className="text-[11px] text-[var(--text-muted)] mt-1">{desc}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-wrap shrink-0">{actions}</div>
      )}
    </div>
  );
};
