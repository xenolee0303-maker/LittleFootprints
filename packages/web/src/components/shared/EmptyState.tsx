interface EmptyStateProps {
  icon?: string;
  message: string;
}

export function EmptyState({ icon = '📭', message }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
      <span className="text-4xl mb-3">{icon}</span>
      <p className="text-sm">{message}</p>
    </div>
  );
}
